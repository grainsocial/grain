//! APNs and FCM, pushed to as stand-ins for them answer: what each is
//! sent, and what grain-serve makes of each answer.

use super::*;
use crate::index::Index;
use axum::Router;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode, Uri, Version};
use axum::routing::post;
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use grain::crypto::PublicKey;
use p256::pkcs8::{EncodePrivateKey, LineEnding};
use ring::signature::{KeyPair, RSA_PKCS1_2048_8192_SHA256, RsaKeyPair, UnparsedPublicKey};
use std::path::PathBuf;
use std::sync::Mutex;

/// An RSA key made for these tests, as a service account's would be.
const RSA_KEY: &str = include_str!("test-rsa-key.pem");

/// A request a stand-in was sent.
#[derive(Debug, Clone)]
struct Seen {
    path: String,
    version: Version,
    headers: HeaderMap,
    body: String,
}

/// A stand-in for a service: what it was sent, and the answers it gives
/// in turn, `200 {}` once they run out.
#[derive(Default)]
struct Fake {
    seen: Mutex<Vec<Seen>>,
    answers: Mutex<Vec<(u16, String)>>,
}

impl Fake {
    fn answer(&self, status: u16, body: &str) {
        self.answers.lock().unwrap().push((status, body.into()));
    }

    fn seen(&self) -> Vec<Seen> {
        self.seen.lock().unwrap().clone()
    }
}

async fn heard(
    State(fake): State<Arc<Fake>>,
    uri: Uri,
    version: Version,
    headers: HeaderMap,
    body: String,
) -> (StatusCode, String) {
    fake.seen.lock().unwrap().push(Seen {
        path: uri.path().into(),
        version,
        headers,
        body,
    });
    let mut answers = fake.answers.lock().unwrap();
    let (status, body) = match answers.is_empty() {
        true => (200, "{}".into()),
        false => answers.remove(0),
    };
    (StatusCode::from_u16(status).unwrap(), body)
}

/// A stand-in on a port of its own, and its URL.
async fn fake() -> (Arc<Fake>, String) {
    let fake = Arc::new(Fake::default());
    let app = Router::new()
        .route("/{*path}", post(heard))
        .with_state(fake.clone());
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    tokio::spawn(async move { axum::serve(listener, app).await });
    (fake, url)
}

fn message() -> Message {
    Message {
        title: "New favorite".into(),
        body: "Bob favorited your gallery".into(),
        data: [
            ("type".to_string(), "gallery-favorite".to_string()),
            (
                "uri".to_string(),
                "at://did:plc:a/social.grain.gallery/1".into(),
            ),
        ]
        .into(),
        badge: Some(3),
    }
}

fn json_of(body: &str) -> Value {
    serde_json::from_str(body).unwrap()
}

/// APNs at `url`, its key in `dir`, and the key's public half.
fn apns_at(dir: &std::path::Path, url: &str) -> (apns::Apns, PublicKey) {
    let key = p256_key();
    let pem = key.to_pkcs8_pem(LineEnding::LF).unwrap();
    let path = dir.join("AuthKey.p8");
    std::fs::write(&path, pem.as_bytes()).unwrap();
    let public = PublicKey::P256(*key.verifying_key());
    let config = apns::Config {
        key_file: path,
        key_id: "KEY123".into(),
        team_id: "TEAM456".into(),
        topic: "social.grain.grain".into(),
        url: url.into(),
    };
    (apns::Apns::new(config).unwrap(), public)
}

/// A P-256 key made now.
fn p256_key() -> p256::ecdsa::SigningKey {
    let key = grain::crypto::P256Key::generate();
    p256::ecdsa::SigningKey::from_slice(&key.to_bytes()).unwrap()
}

#[tokio::test]
async fn apns_is_sent_an_alert_signed_by_the_team() {
    let dir = tempfile::tempdir().unwrap();
    let (fake, url) = fake().await;
    let (apns, public) = apns_at(dir.path(), &url);
    assert_eq!(apns.send("ab12", &message()).await, Outcome::Sent);
    assert_eq!(apns.send("ab12", &message()).await, Outcome::Sent);

    let seen = fake.seen();
    let first = &seen[0];
    assert_eq!(first.path, "/3/device/ab12");
    assert_eq!(first.version, Version::HTTP_2);
    assert_eq!(first.headers["apns-topic"], "social.grain.grain");
    assert_eq!(first.headers["apns-push-type"], "alert");
    assert_eq!(
        json_of(&first.body),
        json!({
            "aps": {
                "alert": {"title": "New favorite", "body": "Bob favorited your gallery"},
                "sound": "default",
                "badge": 3,
            },
            "type": "gallery-favorite",
            "uri": "at://did:plc:a/social.grain.gallery/1",
        })
    );
    let bearer = |s: &Seen| {
        let auth = s.headers["authorization"].to_str().unwrap().to_string();
        auth.strip_prefix("Bearer ").unwrap().to_string()
    };
    let jwt = bearer(first);
    let (signed, sig) = jwt.rsplit_once('.').unwrap();
    let sig = URL_SAFE_NO_PAD.decode(sig).unwrap();
    public.verify(signed.as_bytes(), &sig).unwrap();
    let (header, claims) = grain::crypto::jwt_parts(&jwt).unwrap();
    assert_eq!(claims["iss"], "TEAM456");
    assert!(claims["iat"].as_u64().unwrap() > 0);
    assert_eq!(header, json!({"alg": "ES256", "kid": "KEY123"}));
    // One JWT serves every push in its fifty minutes.
    assert_eq!(bearer(&seen[1]), jwt);

    // No badge, no badge.
    let unbadged = Message {
        badge: None,
        ..message()
    };
    assert!(apns::Apns::payload(&unbadged)["aps"].get("badge").is_none());
    // The notification's fields never stand in for the alert or the text.
    let mut sly = message();
    for k in ["aps", "title", "body"] {
        sly.data.insert(k.into(), "sly".into());
    }
    let apns = apns::Apns::payload(&sly);
    assert_eq!(apns["aps"]["alert"]["title"], "New favorite");
    let fcm = fcm::Fcm::payload("fcm-1", &sly);
    let data = &fcm["message"]["data"];
    assert_eq!(
        (data["title"].as_str(), data["body"].as_str()),
        (Some("New favorite"), Some("Bob favorited your gallery"))
    );
}

#[tokio::test]
async fn apns_answers_say_what_became_of_a_push() {
    let dir = tempfile::tempdir().unwrap();
    let (fake, url) = fake().await;
    let (apns, _) = apns_at(dir.path(), &url);
    let m = message();
    let send = || apns.send("ab12", &m);
    fake.answer(410, r#"{"reason":"Unregistered"}"#);
    assert_eq!(send().await, Outcome::Gone);
    fake.answer(400, r#"{"reason":"BadDeviceToken"}"#);
    assert_eq!(
        send().await,
        Outcome::Failed("APNs 400 BadDeviceToken".into())
    );
    fake.answer(429, r#"{"reason":"TooManyRequests"}"#);
    assert_eq!(
        send().await,
        Outcome::Retry("APNs 429 TooManyRequests".into())
    );
    fake.answer(503, "not json");
    assert_eq!(send().await, Outcome::Retry("APNs 503 ".into()));
    // A JWT APNs refuses is made again for the next push.
    let seen = fake.seen();
    assert_eq!(
        seen[0].headers["authorization"],
        seen[3].headers["authorization"]
    );
    assert!(apns.jwt.lock().unwrap().is_some());
    fake.answer(403, r#"{"reason":"ExpiredProviderToken"}"#);
    assert_eq!(
        send().await,
        Outcome::Retry("APNs 403 ExpiredProviderToken".into())
    );
    assert!(
        apns.jwt.lock().unwrap().is_none(),
        "made again for the next"
    );
    fake.answer(403, r#"{"reason":"BadCertificateEnvironment"}"#);
    let other = Outcome::Failed("APNs 403 BadCertificateEnvironment".into());
    assert_eq!(send().await, other);
    assert!(apns.jwt.lock().unwrap().is_some());

    // A token that is not one is sent nowhere.
    for wrong in ["", "../../3/other", "ab12?x=1"] {
        let failed = Outcome::Failed("not an APNs device token".into());
        assert_eq!(apns.send(wrong, &message()).await, failed);
    }
    assert_eq!(fake.seen().len(), 6);

    // One that cannot be reached is tried again.
    let (gone, _) = apns_at(dir.path(), "http://127.0.0.1:1");
    let Outcome::Retry(why) = gone.send("ab12", &message()).await else {
        panic!("not a retry");
    };
    assert!(why.starts_with("APNs: ") && !why.contains("ab12"), "{why}");
}

#[test]
fn apns_needs_its_key() {
    let dir = tempfile::tempdir().unwrap();
    let config = |key_file: std::path::PathBuf| apns::Config {
        key_file,
        key_id: "K".into(),
        team_id: "T".into(),
        topic: "social.grain.grain".into(),
        url: apns::PRODUCTION.into(),
    };
    let missing = apns::Apns::new(config(dir.path().join("none.p8")));
    assert!(
        missing
            .err()
            .unwrap()
            .to_string()
            .starts_with("reading the APNs key")
    );
    let rsa = dir.path().join("rsa.p8");
    std::fs::write(&rsa, RSA_KEY).unwrap();
    let wrong = apns::Apns::new(config(rsa)).err().unwrap().to_string();
    assert!(
        wrong.ends_with("is not a P-256 key in PKCS #8 PEM"),
        "{wrong}"
    );
}

/// A service account's key file in `dir`, its tokens traded at `url`.
fn account(dir: &std::path::Path, token_url: Option<&str>, project: Option<&str>) -> PathBuf {
    let mut account = json!({
        "type": "service_account",
        "client_email": "push@grain-test.iam.gserviceaccount.com",
        "private_key": RSA_KEY,
    });
    if let Some(url) = token_url {
        account["token_uri"] = url.into();
    }
    if let Some(project) = project {
        account["project_id"] = project.into();
    }
    let path = dir.join("service-account.json");
    std::fs::write(&path, account.to_string()).unwrap();
    path
}

/// FCM at `url`, its tokens traded at `token_url`.
fn fcm_at(dir: &std::path::Path, url: &str, token_url: &str) -> fcm::Fcm {
    let key_file = account(dir, Some(token_url), Some("grain-test"));
    let config = fcm::Config {
        key_file,
        project_id: None,
        url: url.into(),
    };
    fcm::Fcm::new(config).unwrap()
}

#[tokio::test]
async fn fcm_is_sent_data_with_a_token_the_account_earns() {
    let dir = tempfile::tempdir().unwrap();
    let (fcm, url) = fake().await;
    let (google, token_url) = fake().await;
    google.answer(200, r#"{"access_token":"ya29.one","expires_in":3600}"#);
    let token_url = format!("{token_url}/token");
    let sender = fcm_at(dir.path(), &url, &token_url);
    assert_eq!(sender.send("fcm-1", &message()).await, Outcome::Sent);
    assert_eq!(sender.send("fcm-2", &message()).await, Outcome::Sent);

    // One token is earned for the hour.
    let traded = google.seen();
    assert_eq!(traded.len(), 1);
    let form: Vec<(String, String)> = url_form(&traded[0].body);
    assert_eq!(form[0].0, "grant_type");
    assert_eq!(form[0].1, "urn:ietf:params:oauth:grant-type:jwt-bearer");
    let assertion = &form[1].1;
    let (header, claims) = grain::crypto::jwt_parts(assertion).unwrap();
    assert_eq!(header, json!({"alg": "RS256", "typ": "JWT"}));
    assert_eq!(claims["iss"], "push@grain-test.iam.gserviceaccount.com");
    assert_eq!(claims["scope"], fcm::SCOPE);
    assert_eq!(claims["aud"], token_url.as_str());
    assert_eq!(
        claims["exp"].as_u64().unwrap() - claims["iat"].as_u64().unwrap(),
        3600
    );
    let (signed, sig) = assertion.rsplit_once('.').unwrap();
    let der = der_of_pem(RSA_KEY).unwrap();
    let key = RsaKeyPair::from_pkcs8(&der).unwrap();
    let public = UnparsedPublicKey::new(&RSA_PKCS1_2048_8192_SHA256, key.public_key().as_ref());
    let sig = URL_SAFE_NO_PAD.decode(sig).unwrap();
    public.verify(signed.as_bytes(), &sig).unwrap();

    let sent = fcm.seen();
    assert_eq!(sent[0].path, "/v1/projects/grain-test/messages:send");
    assert_eq!(sent[0].headers["authorization"], "Bearer ya29.one");
    assert_eq!(
        json_of(&sent[0].body),
        json!({"message": {
            "token": "fcm-1",
            "data": {
                "title": "New favorite",
                "body": "Bob favorited your gallery",
                "type": "gallery-favorite",
                "uri": "at://did:plc:a/social.grain.gallery/1",
            },
            "android": {"priority": "HIGH"},
        }})
    );
}

/// The fields of a form, as `application/x-www-form-urlencoded` sends it.
fn url_form(body: &str) -> Vec<(String, String)> {
    let url = reqwest::Url::parse(&format!("http://form/?{body}")).unwrap();
    url.query_pairs()
        .map(|(k, v)| (k.into_owned(), v.into_owned()))
        .collect()
}

#[tokio::test]
async fn fcm_answers_say_what_became_of_a_push() {
    let dir = tempfile::tempdir().unwrap();
    let (fcm, url) = fake().await;
    let (google, token_url) = fake().await;
    let token_url = format!("{token_url}/token");
    let sender = fcm_at(dir.path(), &url, &token_url);
    let m = message();
    let send = || sender.send("fcm-1", &m);
    let granted = |token: &str| format!(r#"{{"access_token":"{token}","expires_in":3600}}"#);
    google.answer(200, &granted("ya29.one"));
    google.answer(200, &granted("ya29.two"));
    let unregistered = r#"{"error":{"code":404,"status":"NOT_FOUND",
      "details":[{"@type":"type.googleapis.com/google.firebase.fcm.v1.FcmError","errorCode":"UNREGISTERED"}]}}"#;
    fcm.answer(404, unregistered);
    assert_eq!(send().await, Outcome::Gone);
    // A 404 that does not say the token is unregistered is not taken as
    // gone: a project named wrong answers so for every token.
    fcm.answer(404, r#"{"error":{"status":"NOT_FOUND"}}"#);
    assert_eq!(send().await, Outcome::Failed("FCM 404".into()));
    fcm.answer(400, r#"{"error":{"status":"INVALID_ARGUMENT"}}"#);
    assert_eq!(send().await, Outcome::Failed("FCM 400".into()));
    fcm.answer(503, "");
    assert_eq!(send().await, Outcome::Retry("FCM 503".into()));
    // An access token refused is traded for another.
    fcm.answer(401, "");
    assert_eq!(send().await, Outcome::Retry("FCM 401".into()));
    assert_eq!(send().await, Outcome::Sent);
    let sent = fcm.seen();
    assert_eq!(sent[4].headers["authorization"], "Bearer ya29.one");
    assert_eq!(sent[5].headers["authorization"], "Bearer ya29.two");

    // A trade that fails is tried again, as is one that grants nothing.
    let (refusing, refusing_url) = fake().await;
    let sender = fcm_at(dir.path(), &url, &format!("{refusing_url}/token"));
    refusing.answer(400, r#"{"error":"invalid_grant"}"#);
    let failed = sender.send("fcm-1", &message()).await;
    let why = "FCM's token endpoint answered 400 Bad Request";
    assert_eq!(failed, Outcome::Retry(why.into()));
    refusing.answer(200, "{}");
    let Outcome::Retry(why) = sender.send("fcm-1", &message()).await else {
        panic!("not a retry");
    };
    assert!(
        why.starts_with("FCM's token endpoint granted no access_token"),
        "{why}"
    );
    let unreached = fcm_at(dir.path(), &url, "http://127.0.0.1:1/token");
    let Outcome::Retry(why) = unreached.send("fcm-1", &message()).await else {
        panic!("not a retry");
    };
    assert!(why.starts_with("FCM's token endpoint: "), "{why}");
    // As is a push that does not reach FCM.
    let (google, token_url) = fake().await;
    google.answer(200, r#"{"access_token":"ya29.three"}"#);
    let unreached = fcm_at(
        dir.path(),
        "http://127.0.0.1:1",
        &format!("{token_url}/token"),
    );
    let Outcome::Retry(why) = unreached.send("fcm-1", &message()).await else {
        panic!("not a retry");
    };
    assert!(why.starts_with("FCM: ") && !why.contains("fcm-1"), "{why}");
}

#[test]
fn fcm_needs_an_account_with_a_key_and_a_project() {
    let dir = tempfile::tempdir().unwrap();
    let config = |key_file, project_id: Option<&str>| fcm::Config {
        key_file,
        project_id: project_id.map(str::to_string),
        url: fcm::URL.into(),
    };
    let missing = fcm::Fcm::new(config(dir.path().join("none.json"), None));
    let why = missing.err().unwrap().to_string();
    assert!(why.starts_with("reading the FCM key file"), "{why}");
    // The project, from the key file or named apart from it.
    let unnamed = account(dir.path(), None, None);
    let why = fcm::Fcm::new(config(unnamed.clone(), None))
        .err()
        .unwrap()
        .to_string();
    assert!(why.ends_with("--fcm-project-id is not given"), "{why}");
    assert!(fcm::Fcm::new(config(unnamed, Some("grain-test"))).is_ok());
    let path = dir.path().join("wrong.json");
    std::fs::write(&path, "{}").unwrap();
    let why = fcm::Fcm::new(config(path.clone(), None))
        .err()
        .unwrap()
        .to_string();
    assert!(
        why.ends_with("is not a service account's key file"),
        "{why}"
    );
    let ec = p256_key().to_pkcs8_pem(LineEnding::LF).unwrap();
    let wrong = json!({"client_email": "a@b", "private_key": ec.as_str(), "project_id": "p"});
    std::fs::write(&path, wrong.to_string()).unwrap();
    let why = fcm::Fcm::new(config(path, None)).err().unwrap().to_string();
    assert!(why.ends_with("is not an RSA key in PKCS #8 PEM"), "{why}");
}

#[tokio::test]
async fn each_platform_goes_by_its_own_service() {
    let dir = tempfile::tempdir().unwrap();
    let none = Transports::new(&Config::default()).unwrap();
    for platform in ["ios", "android", "web", "later"] {
        assert_eq!(none.send(platform, "ab12", &message()).await, None);
    }
    let (apple, url) = fake().await;
    let (apns, _) = apns_at(dir.path(), &url);
    let only_apns = Transports {
        apns: Some(apns),
        fcm: None,
    };
    let sent = Some(Outcome::Sent);
    assert_eq!(only_apns.send("ios", "ab12", &message()).await, sent);
    assert_eq!(only_apns.send("android", "ab12", &message()).await, None);
    assert_eq!(only_apns.send("web", "ab12", &message()).await, None);
    assert_eq!(apple.seen().len(), 1);

    let key_file = account(dir.path(), None, Some("grain-test"));
    let config = Config {
        apns: None,
        fcm: Some(fcm::Config {
            key_file,
            project_id: None,
            url: fcm::URL.into(),
        }),
    };
    let transports = Transports::new(&config).unwrap();
    assert!(transports.apns.is_none() && transports.fcm.is_some());
}

/// The flags and environment `set` names.
fn vars<'a>(set: &'a [(&str, &str)]) -> impl Fn(&str) -> Option<String> + 'a {
    move |name| {
        set.iter()
            .find(|(k, _)| *k == name)
            .map(|(_, v)| v.to_string())
    }
}

#[test]
fn push_is_set_up_from_flags_and_the_environment() {
    assert_eq!(Config::given(vars(&[])), Config::default());
    let apns = [
        ("GRAIN_APNS_KEY_FILE", "/data/certs/AuthKey.p8"),
        ("--apns-key-id", "KEY123"),
        ("--apns-team-id", "TEAM456"),
        ("--apns-topic", "social.grain.grain"),
        ("GRAIN_FCM_KEY_FILE", "/data/certs/firebase.json"),
    ];
    let config = Config::given(vars(&apns));
    assert_eq!(
        config,
        Config {
            apns: Some(apns::Config {
                key_file: "/data/certs/AuthKey.p8".into(),
                key_id: "KEY123".into(),
                team_id: "TEAM456".into(),
                topic: "social.grain.grain".into(),
                url: apns::PRODUCTION.into(),
            }),
            fcm: Some(fcm::Config {
                key_file: "/data/certs/firebase.json".into(),
                project_id: None,
                url: fcm::URL.into(),
            }),
        }
    );
    let sandbox = [
        ("GRAIN_APNS_KEY_FILE", "k.p8"),
        ("--apns-key-id", "K"),
        ("--apns-team-id", "T"),
        ("--apns-topic", "t"),
        ("--apns-url", "https://api.sandbox.push.apple.com/"),
        ("GRAIN_FCM_KEY_FILE", "f.json"),
        ("--fcm-project-id", "grain-test"),
    ];
    let config = Config::given(vars(&sandbox));
    assert_eq!(config.apns.unwrap().url, apns::SANDBOX);
    assert_eq!(
        config.fcm.unwrap().project_id.as_deref(),
        Some("grain-test")
    );
    // APNs named in part is refused as it is set up.
    let partial = [("GRAIN_APNS_KEY_FILE", "k.p8"), ("--apns-key-id", "K")];
    let partial = Config::given(vars(&partial));
    let why = Transports::new(&partial).err().unwrap().to_string();
    assert_eq!(why, "GRAIN_APNS_KEY_FILE needs --apns-team-id too");
}

#[test]
fn pem_holds_der() {
    assert_eq!(
        der_of_pem("-----BEGIN X-----\nAAEC\n-----END X-----\n"),
        Some(vec![0, 1, 2])
    );
    assert_eq!(der_of_pem("not base64!"), None);
}

const ALICE: &str = "did:plc:alice";
const BOB: &str = "did:plc:bob";
const CAROL: &str = "did:plc:carol";

fn cid(of: &str) -> String {
    grain::drisl::cid_text(&grain::drisl::cid(of.as_bytes()))
}

/// Puts `record` of `collection` at `did`'s `rkey`, made now unless it
/// says, as a live path would; its URI.
fn put(index: &Index, did: &str, collection: &str, rkey: &str, mut record: Value) -> String {
    let uri = format!("at://{did}/{collection}/{rkey}");
    record["$type"] = collection.into();
    if record.get("createdAt").is_none() {
        record["createdAt"] = grain::keys::now_iso().into();
    }
    index.put(&uri, &cid(&record.to_string()), &record).unwrap();
    uri
}

/// Alice's gallery, Bob and Carol in the index, Bob named.
fn world() -> (Index, String) {
    let index = Index::memory().unwrap();
    for did in [ALICE, BOB, CAROL] {
        index.track(did).unwrap();
    }
    put(
        &index,
        BOB,
        "social.grain.actor.profile",
        "self",
        json!({"displayName": "Bob"}),
    );
    let gallery = put(
        &index,
        ALICE,
        "social.grain.gallery",
        "g1",
        json!({"title": "Fog"}),
    );
    (index, gallery)
}

fn pushes(index: &Index, uri: &str) -> Vec<(String, Message)> {
    index.read(|db| send::pushes(db, uri)).unwrap()
}

/// What a push says, as `(recipient, type, about, body, badge)`.
fn said(pushes: Vec<(String, Message)>) -> Vec<(String, String, String, String, i64)> {
    pushes
        .into_iter()
        .map(|(did, m)| {
            let about = m.data.get("uri").or(m.data.get("did")).unwrap().clone();
            (did, m.data["type"].clone(), about, m.body, m.badge.unwrap())
        })
        .collect()
}

fn one(
    did: &str,
    kind: &str,
    about: &str,
    body: &str,
    badge: i64,
) -> Vec<(String, String, String, String, i64)> {
    vec![(did.into(), kind.into(), about.into(), body.into(), badge)]
}

#[test]
fn each_new_record_pushes_what_it_notifies() {
    let (index, gallery) = world();
    let fav = put(
        &index,
        BOB,
        "social.grain.favorite",
        "f1",
        json!({"subject": gallery}),
    );
    let favorited = pushes(&index, &fav);
    assert_eq!(favorited[0].1.title, "New favorite");
    let want = one(
        ALICE,
        "gallery-favorite",
        &gallery,
        "Bob favorited your gallery",
        1,
    );
    assert_eq!(said(favorited), want);
    // Once only: delivered again, or deleted and made again.
    assert_eq!(pushes(&index, &fav), []);

    // Carol has no profile.
    let follow = put(
        &index,
        CAROL,
        "social.grain.graph.follow",
        "w1",
        json!({"subject": ALICE}),
    );
    let want = one(ALICE, "follow", CAROL, "Someone followed you", 2);
    assert_eq!(said(pushes(&index, &follow)), want);

    let comment = put(
        &index,
        ALICE,
        "social.grain.comment",
        "c1",
        json!({"text": "thanks", "subject": gallery}),
    );
    assert_eq!(pushes(&index, &comment), [], "her own gallery");
    let reply = put(
        &index,
        BOB,
        "social.grain.comment",
        "c2",
        json!({"text": "sure", "subject": gallery, "replyTo": comment}),
    );
    let want = one(
        ALICE,
        "comment-reply",
        &gallery,
        "Bob replied to your comment",
        3,
    );
    assert_eq!(said(pushes(&index, &reply)), want);
    let fav = put(
        &index,
        BOB,
        "social.grain.favorite",
        "f2",
        json!({"subject": comment}),
    );
    let want = one(
        ALICE,
        "comment-favorite",
        &comment,
        "Bob favorited your comment",
        4,
    );
    assert_eq!(said(pushes(&index, &fav)), want);

    let mention = json!([{
        "index": {"byteStart": 0, "byteEnd": 6},
        "features": [{"$type": "app.bsky.richtext.facet#mention", "did": CAROL}],
    }]);
    let mentioning = put(
        &index,
        BOB,
        "social.grain.gallery",
        "g2",
        json!({"title": "Walk", "description": "@carol", "facets": mention}),
    );
    let want = one(
        CAROL,
        "gallery-mention",
        &mentioning,
        "Bob mentioned you in a gallery",
        1,
    );
    assert_eq!(said(pushes(&index, &mentioning)), want);
    let commented = put(
        &index,
        BOB,
        "social.grain.comment",
        "c3",
        json!({"text": "@carol", "facets": mention, "subject": gallery}),
    );
    let mut both = said(pushes(&index, &commented));
    both.sort();
    assert_eq!(
        both,
        [
            one(
                ALICE,
                "gallery-comment",
                &gallery,
                "Bob commented on your gallery",
                5
            ),
            one(
                CAROL,
                "gallery-comment-mention",
                &gallery,
                "Bob mentioned you in a comment",
                2
            ),
        ]
        .concat()
    );
}

#[test]
fn only_what_is_new_and_wanted_is_pushed() {
    let (index, gallery) = world();
    let favorite = |rkey: &str, did: &str, made: Option<&str>| {
        let mut record = json!({"subject": gallery});
        if let Some(made) = made {
            record["createdAt"] = made.into();
        }
        put(&index, did, "social.grain.favorite", rkey, record)
    };
    // Old news, though the stream brings it now.
    let old = favorite("f1", BOB, Some("2020-01-01T00:00:00.000Z"));
    assert_eq!(pushes(&index, &old), []);
    // A clock set ahead is no reason not to.
    let ahead = favorite("f2", BOB, Some("2999-01-01T00:00:00.000Z"));
    assert_eq!(pushes(&index, &ahead).len(), 1);
    // What does not notify, or is not a record the index keeps.
    let own = put(
        &index,
        BOB,
        "social.grain.graph.follow",
        "w1",
        json!({"subject": BOB}),
    );
    assert_eq!(pushes(&index, &own), []);
    let profile = format!("at://{BOB}/social.grain.actor.profile/self");
    assert_eq!(pushes(&index, &profile), []);
    assert_eq!(
        pushes(&index, &format!("at://{BOB}/app.bsky.feed.like/1")),
        []
    );
    assert_eq!(pushes(&index, "not a uri"), []);
    assert_eq!(
        pushes(&index, &format!("at://{BOB}/social.grain.favorite/none")),
        []
    );

    // Alice's preference: no favorites pushed.
    index.read(|db| {
        db.execute(
            "INSERT INTO notification_pref VALUES (?1, 'favorites', 0, 1, 0)",
            [ALICE],
        )
        .unwrap()
    });
    assert_eq!(pushes(&index, &favorite("f3", BOB, None)), []);
    index.read(|db| db.execute("DELETE FROM notification_pref", []).unwrap());

    // An author she muted, one blocking her or blocked, one taken down.
    index.read(|db| {
        db.execute(
            "INSERT INTO mute VALUES (?1, ?2, '2026-01-01T00:00:00.000Z')",
            [ALICE, BOB],
        )
        .unwrap()
    });
    assert_eq!(pushes(&index, &favorite("f4", BOB, None)), []);
    put(
        &index,
        CAROL,
        "social.grain.graph.block",
        "b1",
        json!({"subject": ALICE}),
    );
    assert_eq!(pushes(&index, &favorite("f5", CAROL, None)), []);
    let dave = "did:plc:dave";
    index.take_down(dave).unwrap();
    assert_eq!(pushes(&index, &favorite("f6", dave, None)), []);
    let erin = "did:plc:erin";
    assert_eq!(pushes(&index, &favorite("f7", erin, None)).len(), 1);
}

#[test]
fn every_kind_of_notification_has_its_words() {
    let words = |reason| {
        let m = send::message(reason, "Bob").unwrap();
        (m.title, m.body, m.data["type"].clone())
    };
    let w = |t: &str, b: &str, k: &str| (t.to_string(), b.to_string(), k.to_string());
    assert_eq!(
        words("story-favorite"),
        w("New favorite", "Bob favorited your story", "story-favorite")
    );
    assert_eq!(
        words("story-comment"),
        w(
            "New comment",
            "Bob commented on your story",
            "story-comment"
        )
    );
    assert_eq!(send::message("later", "Bob"), None);
}

/// A sender at stand-ins for APNs and FCM, quick to try again.
async fn sender(index: &Arc<Index>, dir: &std::path::Path) -> (Arc<Fake>, Arc<Fake>) {
    let (apple, apple_url) = fake().await;
    let (google, url) = fake().await;
    google.answer(200, r#"{"access_token":"ya29.one"}"#);
    let (apns, _) = apns_at(dir, &apple_url);
    let fcm = fcm_at(dir, &url, &format!("{url}/token"));
    let transports = Transports {
        apns: Some(apns),
        fcm: Some(fcm),
    };
    let retry = send::Retry {
        tries: 3,
        wait: std::time::Duration::from_millis(5),
    };
    send::start(index.clone(), Arc::new(transports), retry);
    (apple, google)
}

/// Waits until `fake` has been sent `n` requests.
async fn sent(fake: &Fake, n: usize) -> Vec<Seen> {
    for _ in 0..500 {
        if fake.seen().len() >= n {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
    }
    fake.seen()
}

#[tokio::test]
async fn what_arrives_is_pushed_to_each_device() {
    let dir = tempfile::tempdir().unwrap();
    let (index, gallery) = world();
    let index = Arc::new(index);
    let now = "2026-01-01T00:00:00.000Z";
    index.register_push(ALICE, "aa01", "ios", now).unwrap();
    index.register_push(ALICE, "fcm-1", "android", now).unwrap();
    index.register_push(ALICE, "web-1", "web", now).unwrap();
    let (apple, google) = sender(&index, dir.path()).await;
    assert!(!index.push_to(tokio::sync::mpsc::channel(1).0), "once");
    // A second start leaves the first be.
    send::start(
        index.clone(),
        Arc::new(Transports::default()),
        send::Retry::default(),
    );

    let fav = put(
        &index,
        BOB,
        "social.grain.favorite",
        "f1",
        json!({"subject": gallery}),
    );
    index.arrived(&fav);
    let to_apple = sent(&apple, 1).await;
    assert_eq!(to_apple[0].path, "/3/device/aa01");
    assert_eq!(json_of(&to_apple[0].body)["aps"]["badge"], 1);
    // Google: the token traded, then the push.
    let to_google = sent(&google, 2).await;
    assert_eq!(to_google[1].path, "/v1/projects/grain-test/messages:send");
    assert_eq!(
        json_of(&to_google[1].body)["message"]["data"]["type"],
        "gallery-favorite"
    );

    // Apple busy, then gone: tried again, then forgotten. Google failing
    // each time is tried three times in all.
    apple.answer(503, "{}");
    apple.answer(410, r#"{"reason":"Unregistered"}"#);
    for _ in 0..3 {
        google.answer(500, "");
    }
    let fav = put(
        &index,
        CAROL,
        "social.grain.favorite",
        "f2",
        json!({"subject": gallery}),
    );
    index.arrived(&fav);
    sent(&apple, 3).await;
    sent(&google, 5).await;
    for _ in 0..500 {
        if index.push_tokens(ALICE).unwrap().len() == 2 {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
    }
    let left: Vec<String> = index
        .push_tokens(ALICE)
        .unwrap()
        .into_iter()
        .map(|t| t.token)
        .collect();
    assert_eq!(left, ["fcm-1", "web-1"]);
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    assert_eq!(google.seen().len(), 5, "three tries, no more");

    // Refused for good: not tried again.
    google.answer(400, "");
    let fav = put(
        &index,
        CAROL,
        "social.grain.favorite",
        "f3",
        json!({"subject": gallery}),
    );
    index.arrived(&fav);
    sent(&google, 6).await;
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    assert_eq!(google.seen().len(), 6);
    assert_eq!(apple.seen().len(), 3);
}

#[test]
fn the_stream_says_what_is_new() {
    use grain::jetstream::{Event, Op, What};
    let (index, gallery) = world();
    let (to, mut arrived) = tokio::sync::mpsc::channel(8);
    // None is said before it is asked for.
    index.arrived("at://did:plc:bob/social.grain.favorite/x");
    assert!(index.push_to(to));
    let favorite = json!({
        "$type": "social.grain.favorite",
        "subject": gallery,
        "createdAt": grain::keys::now_iso(),
    });
    let event = |rev: &str| Event {
        seq: Some(1),
        what: What::Commit {
            did: BOB.into(),
            op: Op {
                action: "create".into(),
                collection: "social.grain.favorite".into(),
                rkey: "f1".into(),
                cid: Some(cid(&favorite.to_string())),
                record: Some(favorite.clone()),
                rev: Some(rev.into()),
            },
        },
    };
    crate::jetstream::apply(&index, event("3l3qo2vuowo2a")).unwrap();
    let uri = format!("at://{BOB}/social.grain.favorite/f1");
    assert_eq!(arrived.try_recv().ok(), Some(uri));
    // Delivered again: not new.
    crate::jetstream::apply(&index, event("3l3qo2vuowo2b")).unwrap();
    assert!(arrived.try_recv().is_err());
    // Past what the sender holds, or once it stops, none is said.
    for n in 0..9 {
        index.arrived(&format!("at://{BOB}/social.grain.favorite/{n}"));
    }
    drop(arrived);
    index.arrived("at://did:plc:bob/social.grain.favorite/y");
}

#[tokio::test]
async fn a_record_whose_pushes_panic_does_not_stop_the_next() {
    let dir = tempfile::tempdir().unwrap();
    let (index, gallery) = world();
    let index = Arc::new(index);
    index
        .register_push(ALICE, "aa01", "ios", "2026-01-01T00:00:00.000Z")
        .unwrap();
    let (apple, url) = fake().await;
    let (apns, _) = apns_at(dir.path(), &url);
    let transports = Transports {
        apns: Some(apns),
        fcm: None,
    };
    fn find(db: &rusqlite::Connection, uri: &str) -> rusqlite::Result<Vec<(String, Message)>> {
        assert!(!uri.ends_with("/boom"), "a lookup that panics");
        send::pushes(db, uri)
    }
    send::start_finding(
        index.clone(),
        Arc::new(transports),
        send::Retry::default(),
        find,
    );

    let boom = put(
        &index,
        BOB,
        "social.grain.favorite",
        "boom",
        json!({"subject": gallery}),
    );
    index.arrived(&boom);
    let fav = put(
        &index,
        BOB,
        "social.grain.favorite",
        "f1",
        json!({"subject": gallery}),
    );
    index.arrived(&fav);
    let to_apple = sent(&apple, 1).await;
    assert_eq!(json_of(&to_apple[0].body)["type"], "gallery-favorite");
    // The next record is pushed, and the one that panicked is not.
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    assert_eq!(apple.seen().len(), 1);
    // The index's lock is not poisoned.
    assert_eq!(index.push_tokens(ALICE).unwrap().len(), 1);
}
