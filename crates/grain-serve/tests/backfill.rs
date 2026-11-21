//! Backfill against the reference PDS, with a stand-in for the collection
//! directory (lightrail) and the mirror (hubble) on a local port: repos read
//! from the mirror as STAR-lite, from the PDS as a CAR when the mirror has
//! no good copy, newer writes standing, and failures waited on or given up.

#[path = "../../grain/tests/common/mod.rs"]
mod pds;

use axum::extract::{Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use grain_serve::backfill::{Backfill, Config};
use grain_serve::index::records::{Gallery, Profile};
use grain_serve::index::{Applied, Index};
use pds::{Account, account, ctx, net};
use serde_json::{Value, json};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;

const CID: &str = "bafyreia4w4bbvc5lqzkvexqlbwbagz5yfjfzzrqhfwqkhkk2xgekh4c6ai";
const NOW: &str = "2026-10-31T12:00:00.000Z";

/// What the stand-in mirror answers for a repo.
#[derive(Clone)]
enum Mirror {
    /// This archive.
    Has(Vec<u8>),
    /// This status, and nothing.
    Status(u16),
    /// 429, to wait this many seconds.
    Busy(u64),
    /// Nothing, for a minute.
    Slow,
    /// Headers, then a body that never comes.
    Stalls,
    /// A little of a body, then the connection dropped.
    Cuts,
}

#[derive(Clone, Default)]
struct Stand {
    mirror: Arc<Mutex<HashMap<String, Mirror>>>,
    /// The repos asked of the mirror, and what each asked to accept.
    asked: Arc<Mutex<Vec<(String, String)>>>,
    /// Who the directory says writes grain profiles.
    writers: Arc<Mutex<Vec<String>>>,
}

impl Stand {
    fn set(&self, did: &str, mirror: Mirror) {
        self.mirror.lock().unwrap().insert(did.into(), mirror);
    }

    fn asked(&self, did: &str) -> usize {
        let asked = self.asked.lock().unwrap();
        asked.iter().filter(|(d, _)| d == did).count()
    }
}

async fn get_repo(
    State(stand): State<Stand>,
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
) -> Response {
    let did = q["did"].clone();
    let accept = headers.get("accept").map_or("", |v| v.to_str().unwrap());
    stand
        .asked
        .lock()
        .unwrap()
        .push((did.clone(), accept.into()));
    let mirror = stand.mirror.lock().unwrap().get(&did).cloned();
    match mirror.unwrap_or(Mirror::Status(404)) {
        Mirror::Has(bytes) => bytes.into_response(),
        Mirror::Status(code) => StatusCode::from_u16(code).unwrap().into_response(),
        Mirror::Busy(secs) => {
            let after = [("retry-after", secs.to_string())];
            (StatusCode::TOO_MANY_REQUESTS, after).into_response()
        }
        Mirror::Slow => {
            tokio::time::sleep(Duration::from_secs(60)).await;
            StatusCode::OK.into_response()
        }
        Mirror::Stalls => {
            let never = futures::stream::pending::<Result<Vec<u8>, std::io::Error>>();
            axum::body::Body::from_stream(never).into_response()
        }
        Mirror::Cuts => {
            let cut = futures::stream::iter([
                Ok(vec![0x2a, 0x6c, 0x00]),
                Err(std::io::Error::other("cut")),
            ]);
            axum::body::Body::from_stream(cut).into_response()
        }
    }
}

/// The directory, a writer a page.
async fn list_repos(
    State(stand): State<Stand>,
    Query(q): Query<HashMap<String, String>>,
) -> axum::Json<Value> {
    let writers = stand.writers.lock().unwrap().clone();
    if q["collection"] != "social.grain.actor.profile" {
        return axum::Json(json!({"repos": []}));
    }
    let at: usize = q.get("cursor").map_or(0, |c| c.parse().unwrap());
    let page: Vec<Value> = writers
        .iter()
        .skip(at)
        .take(1)
        .map(|d| json!({"did": d}))
        .collect();
    axum::Json(json!({"repos": page, "cursor": (at + 1).to_string()}))
}

/// The stand-in, serving until the test's runtime ends: its URL.
async fn serve(stand: Stand) -> String {
    let app = axum::Router::new()
        .route(
            "/xrpc/com.atproto.sync.getRepo",
            axum::routing::get(get_repo),
        )
        .route(
            "/xrpc/com.atproto.sync.listReposByCollection",
            axum::routing::get(list_repos),
        )
        .with_state(stand);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    tokio::spawn(async move { axum::serve(listener, app).await });
    url
}

/// Backfill reading from the stand-in, the mirror too if `mirror`.
fn config(stand: &str, mirror: bool) -> Config {
    Config {
        directories: vec!["http://127.0.0.1:1".into(), stand.into()],
        mirror: mirror.then(|| stand.to_string()),
        concurrency: 3,
        per_host: 2,
        attempts: 3,
        retry: Duration::from_secs(60),
        skip: vec![],
        idle: Duration::from_secs(2),
        total: Duration::from_secs(60),
        rediscover: Duration::from_secs(3600),
        poll: Duration::from_millis(50),
    }
}

async fn session(a: &Account) -> String {
    let res: Value = reqwest::Client::new()
        .post(format!(
            "{}/xrpc/com.atproto.server.createSession",
            net().pds
        ))
        .json(&json!({"identifier": a.did, "password": a.password}))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    res["accessJwt"].as_str().unwrap().to_string()
}

/// An account with `n` galleries, a profile, and a record of a collection
/// the index does not keep; its session token, and its galleries' URIs.
async fn writer(n: usize) -> (Account, String, Vec<String>) {
    let a = account().await;
    let token = session(&a).await;
    let create = |collection: &str, rkey: Option<&str>, value: Value| {
        let mut write = json!({"$type": "com.atproto.repo.applyWrites#create",
            "collection": collection, "value": value});
        if let Some(rkey) = rkey {
            write["rkey"] = rkey.into();
        }
        write
    };
    let mut writes: Vec<Value> = (0..n)
        .map(|i| {
            let value = json!({"$type": "social.grain.gallery", "title": format!("roll {i}"),
                "createdAt": NOW});
            create("social.grain.gallery", None, value)
        })
        .collect();
    let profile = json!({"$type": "social.grain.actor.profile", "displayName": "Film"});
    writes.push(create("social.grain.actor.profile", Some("self"), profile));
    let other = json!({"$type": "app.example.other", "text": "not grain's"});
    writes.push(create("app.example.other", None, other));
    let res: Value = reqwest::Client::new()
        .post(format!("{}/xrpc/com.atproto.repo.applyWrites", net().pds))
        .bearer_auth(&token)
        .json(&json!({"repo": a.did, "writes": writes}))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    let uris = res["results"].as_array().unwrap()[..n]
        .iter()
        .map(|r| r["uri"].as_str().unwrap().to_string())
        .collect();
    (a, token, uris)
}

async fn latest_rev(did: &str) -> String {
    let url = format!(
        "{}/xrpc/com.atproto.sync.getLatestCommit?did={did}",
        net().pds
    );
    let res: Value = reqwest::get(url).await.unwrap().json().await.unwrap();
    res["rev"].as_str().unwrap().to_string()
}

/// `did`'s repo as STAR-lite, zstd'd, as the mirror serves it: from the
/// PDS's CAR, with the title `roll 0` forged if `forge`.
async fn star_lite(did: &str, forge: bool) -> Vec<u8> {
    let url = format!("{}/xrpc/com.atproto.sync.getRepo?did={did}", net().pds);
    let car = reqwest::get(url)
        .await
        .unwrap()
        .bytes()
        .await
        .unwrap()
        .to_vec();
    let dir = tempfile::tempdir().unwrap();
    let doc = grain::identity::document(&ctx(dir.path(), &[]), did)
        .await
        .unwrap();
    let key = atproto::did::signing_key(&doc).unwrap();
    let spill = Box::new(tempfile::tempfile().unwrap());
    let mut archive = grain::repo::open(std::io::Cursor::new(car), did, &key, spill).unwrap();
    let mut records = Vec::new();
    while let Some(record) = archive.record().unwrap() {
        records.push(record);
    }
    let commit = archive.finish().unwrap();
    let records = records.iter().map(|(k, r)| (k.as_str(), &r[..]));
    let mut out = atproto::star_lite::write(&commit, records);
    if forge {
        let at = out.windows(6).position(|w| w == b"roll 0").unwrap();
        out[at + 5] = b'X';
    }
    zstd::encode_all(&out[..], 3).unwrap()
}

fn galleries(index: &Index, did: &str) -> i64 {
    index.read(|db| {
        let sql = "SELECT count(*) FROM gallery WHERE did = ?1";
        db.query_row(sql, [did], |r| r.get(0)).unwrap()
    })
}

fn now() -> i64 {
    grain::keys::now_secs() as i64
}

#[tokio::test]
async fn repos_read_from_the_mirror_or_else_the_pds() {
    let stand = Stand::default();
    let url = serve(stand.clone()).await;
    let ((a, _, a_uris), (b, _, _), (c, _, _)) = tokio::join!(writer(3), writer(2), writer(2));
    stand.set(&a.did, Mirror::Has(star_lite(&a.did, false).await));
    // b's the mirror lacks; c's it has forged.
    stand.set(&c.did, Mirror::Has(star_lite(&c.did, true).await));
    *stand.writers.lock().unwrap() = vec![a.did.clone(), b.did.clone(), c.did.clone()];

    let index = Arc::new(Index::memory().unwrap());
    let dir = tempfile::tempdir().unwrap();
    let backfill = Backfill::new(index.clone(), ctx(dir.path(), &[]), config(&url, true));
    // The first directory is down: the next is asked.
    assert_eq!(backfill.discover().await.unwrap(), 3);
    assert_eq!(backfill.discover().await.unwrap(), 0);
    let mut pending = index.pending(now(), 10).unwrap();
    pending.sort();
    let mut all = vec![a.did.clone(), b.did.clone(), c.did.clone()];
    all.sort();
    assert_eq!(pending, all);

    let done = backfill.backfill(&a.did).await.unwrap().unwrap();
    assert!(done.mirrored);
    assert_eq!((done.written, done.deleted, done.refused), (4, 0, 0));
    assert_eq!(done.rev, latest_rev(&a.did).await);
    assert_eq!(galleries(&index, &a.did), 3);
    let held = index.get::<Gallery>(&a_uris[0]).unwrap().unwrap();
    assert_eq!(held.record.title, "roll 0");
    let profile = format!("at://{}/social.grain.actor.profile/self", a.did);
    let profile = index.get::<Profile>(&profile).unwrap().unwrap();
    assert_eq!(profile.record.display_name.as_deref(), Some("Film"));
    let queued = index.queued(&a.did).unwrap().unwrap();
    assert_eq!(
        (queued.state.as_str(), queued.rev),
        ("active", Some(done.rev))
    );
    // Its handle is the one its document claims, which names it back.
    let (handle, _) = index.repo(&a.did).unwrap().unwrap();
    assert_eq!(handle.as_deref(), Some(a.handle.as_str()));
    let (_, accept) = stand.asked.lock().unwrap()[0].clone();
    assert!(
        accept.starts_with("application/x.microcosm.star-lite"),
        "{accept}"
    );

    for (who, galleries_of) in [(&b, 2), (&c, 2)] {
        let done = backfill.backfill(&who.did).await.unwrap().unwrap();
        assert!(!done.mirrored, "{} is read from its PDS", who.did);
        assert_eq!(galleries(&index, &who.did), galleries_of);
    }
    let titles: Vec<String> = index.read(|db| {
        let mut stmt = db
            .prepare("SELECT title FROM gallery WHERE did = ?1")
            .unwrap();
        let rows = stmt.query_map([&c.did], |r| r.get(0)).unwrap();
        rows.map(Result::unwrap).collect()
    });
    assert!(titles.iter().all(|t| !t.contains('X')), "{titles:?}");
    // Read again, nothing changes.
    let again = backfill.backfill(&a.did).await.unwrap().unwrap();
    assert_eq!((again.written, again.deleted), (0, 0));
    assert_eq!(stand.asked(&a.did), 2);
}

#[tokio::test]
async fn what_is_newer_than_the_repo_stands() {
    let stand = Stand::default();
    let url = serve(stand.clone()).await;
    let (d, _, uris) = writer(3).await;
    let index = Arc::new(Index::memory().unwrap());
    let dir = tempfile::tempdir().unwrap();
    let backfill = Backfill::new(index.clone(), ctx(dir.path(), &[]), config(&url, false));
    assert_eq!(
        backfill
            .add_repos(&[d.did.clone(), "not a did".into()])
            .unwrap(),
        1
    );
    // The stream, after the repo was written: the first gallery edited,
    // the second deleted.
    let edited = json!({"$type": "social.grain.gallery", "title": "edited", "createdAt": NOW});
    assert_eq!(index.put(&uris[0], CID, &edited).unwrap(), Applied::Created);
    index.delete(&uris[1]).unwrap();
    // One the index had from long before, that the repo no longer has.
    let before = format!("at://{}/social.grain.gallery/3jzfcijpj2z2a", d.did);
    let old = json!({"$type": "social.grain.gallery", "title": "old", "createdAt": NOW});
    index.put_rev(&before, CID, &old, "2222222222222").unwrap();

    let done = backfill.backfill(&d.did).await.unwrap().unwrap();
    assert!(!done.mirrored);
    assert_eq!(
        (done.written, done.deleted),
        (2, 1),
        "the third gallery and the profile"
    );
    let title = |uri: &str| index.get::<Gallery>(uri).unwrap().map(|g| g.record.title);
    assert_eq!(title(&uris[0]).as_deref(), Some("edited"));
    assert_eq!(title(&uris[1]), None);
    assert_eq!(title(&uris[2]).as_deref(), Some("roll 2"));
    assert_eq!(title(&before), None);
}

#[tokio::test]
async fn failures_are_tried_again_or_given_up() {
    let stand = Stand::default();
    let url = serve(stand.clone()).await;
    let index = Arc::new(Index::memory().unwrap());
    let dir = tempfile::tempdir().unwrap();
    let ctx = || ctx(dir.path(), &[]);
    let backfill = Backfill::new(index.clone(), ctx(), config(&url, true));

    // No such account: tried again later, each time after longer, then
    // given up on.
    let nobody = "did:plc:aaaaaaaaaaaaaaaaaaaaaaaa";
    backfill.add_repos(&[nobody.into()]).unwrap();
    assert!(backfill.backfill(nobody).await.is_err());
    let queued = index.queued(nobody).unwrap().unwrap();
    assert_eq!((queued.state.as_str(), queued.retry_count), ("pending", 1));
    assert!(queued.retry_after >= now() + 59, "{}", queued.retry_after);
    assert!(queued.last_error.is_some());
    assert!(index.pending(now(), 10).unwrap().is_empty());
    assert!(backfill.backfill(nobody).await.is_err());
    let second = index.queued(nobody).unwrap().unwrap();
    assert!(second.retry_after >= now() + 119, "{}", second.retry_after);
    assert!(backfill.backfill(nobody).await.is_err());
    assert_eq!(index.queued(nobody).unwrap().unwrap().state, "failed");
    // Asked for again, it is tried afresh.
    backfill.resync(nobody).unwrap();
    assert_eq!(index.pending(now(), 10).unwrap(), [nobody]);

    // Deactivated, its PDS will not give it out: given up on at once.
    let (e, token, _) = writer(1).await;
    let res = reqwest::Client::new()
        .post(format!(
            "{}/xrpc/com.atproto.server.deactivateAccount",
            net().pds
        ))
        .bearer_auth(&token)
        .json(&json!({}))
        .send()
        .await
        .unwrap();
    assert!(res.status().is_success());
    index.track(&e.did).unwrap();
    assert!(backfill.backfill(&e.did).await.is_err());
    let queued = index.queued(&e.did).unwrap().unwrap();
    assert_eq!((queued.state.as_str(), queued.retry_count), ("failed", 1));

    // A mirror that fails in each way: the repo is read from its PDS.
    let (f, _, _) = writer(1).await;
    index.track(&f.did).unwrap();
    for mirror in [
        Mirror::Status(500),
        Mirror::Slow,
        Mirror::Stalls,
        Mirror::Cuts,
    ] {
        stand.set(&f.did, mirror);
        let done = backfill.backfill(&f.did).await.unwrap().unwrap();
        assert!(!done.mirrored);
    }
    // One that asks to be left alone is, before it is asked again.
    stand.set(&f.did, Mirror::Busy(1));
    assert!(!backfill.backfill(&f.did).await.unwrap().unwrap().mirrored);
    stand.set(&f.did, Mirror::Has(star_lite(&f.did, false).await));
    let asked = std::time::Instant::now();
    assert!(backfill.backfill(&f.did).await.unwrap().unwrap().mirrored);
    assert!(
        asked.elapsed() >= Duration::from_millis(500),
        "{:?}",
        asked.elapsed()
    );

    // A host skipped is never read.
    let mut skipping = config(&url, true);
    skipping.skip = vec!["localhost".into()];
    let skipper = Backfill::new(index.clone(), ctx(), skipping);
    assert_eq!(skipper.backfill(&f.did).await.unwrap(), None);
    let queued = index.queued(&f.did).unwrap().unwrap();
    assert_eq!(queued.state, "skipped");
    assert!(queued.last_error.unwrap().contains("localhost"));

    // Unless private hosts are allowed, a PDS on loopback over http, as a
    // DID document may name, is given up on at once and never asked.
    let public = pds::ctx(dir.path(), &[("GRAIN_ALLOW_PRIVATE", "0")]);
    let public = Backfill::new(index.clone(), public, config(&url, false));
    index.resync(&f.did).unwrap();
    let why = public.backfill(&f.did).await.unwrap_err().to_string();
    assert!(why.ends_with("is not on https"), "{why}");
    assert_eq!(index.queued(&f.did).unwrap().unwrap().state, "failed");
}

/// Waits until `did`'s queue says `state`.
async fn until(index: &Index, did: &str, state: &str) {
    for _ in 0..600 {
        if index.queued(did).unwrap().is_some_and(|q| q.state == state) {
            return;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    panic!("{did} never came to {state}");
}

#[tokio::test]
async fn the_worker_reads_what_is_queued() {
    let stand = Stand::default();
    let url = serve(stand.clone()).await;
    let ((g, _, _), (h, _, _)) = tokio::join!(writer(2), writer(1));
    *stand.writers.lock().unwrap() = vec![g.did.clone()];
    let index = Arc::new(Index::memory().unwrap());
    let dir = tempfile::tempdir().unwrap();
    let backfill = Backfill::new(index.clone(), ctx(dir.path(), &[]), config(&url, false));
    let worker = tokio::spawn(backfill.clone().run());
    // Found by the directory, it is read.
    until(&index, &g.did, "active").await;
    assert_eq!(galleries(&index, &g.did), 2);
    // Added, it is read; one that cannot be is failed in turn.
    backfill
        .add_repos(&[h.did.clone(), "did:plc:bbbbbbbbbbbbbbbbbbbbbbbb".into()])
        .unwrap();
    until(&index, &h.did, "active").await;
    // Asked for again, it is read again.
    backfill.resync(&g.did).unwrap();
    until(&index, &g.did, "active").await;
    worker.abort();

    // With no directory that answers, it still reads what is queued.
    let mut lost = config(&url, false);
    lost.directories = vec!["http://127.0.0.1:1".into()];
    let alone = Backfill::new(index.clone(), ctx(dir.path(), &[]), lost);
    index.resync(&h.did).unwrap();
    let worker = tokio::spawn(alone.run());
    until(&index, &h.did, "active").await;
    worker.abort();
}

#[test]
fn settings() {
    let vars = |pairs: &'static [(&str, &str)]| {
        move |name: &str| {
            let found = pairs.iter().find(|(k, _)| *k == name);
            found.map(|(_, v)| v.to_string())
        }
    };
    assert_eq!(Config::given(vars(&[])), Ok(None));
    assert_eq!(Config::given(vars(&[("--backfill", "")])), Ok(None));
    let named = Config::given(vars(&[("--backfill", "https://a.example")]));
    let named = named.unwrap().unwrap();
    assert_eq!(named.directories, ["https://a.example"]);
    assert_eq!(
        (named.mirror, named.skip),
        (Config::default().mirror, Config::default().skip)
    );
    let set = Config::given(vars(&[
        ("--backfill", "https://a.example/, ,https://b.example"),
        ("--backfill-mirror", ""),
        ("--backfill-skip", ""),
        ("--backfill-concurrency", "0"),
    ]))
    .unwrap()
    .unwrap();
    assert_eq!(set.directories, ["https://a.example", "https://b.example"]);
    assert_eq!((set.mirror, set.skip.len(), set.concurrency), (None, 0, 1));
    let wrong = vars(&[
        ("--backfill", "https://a.example"),
        ("--backfill-concurrency", "many"),
    ]);
    assert_eq!(
        Config::given(wrong),
        Err("--backfill-concurrency takes a number".into())
    );
    let defaults = Config::default().directories.join(",");
    let args = [
        "grain-serve",
        "--index",
        "/data/index.db",
        "--backfill",
        &defaults,
    ];
    let args: Vec<String> = args.iter().map(|a| a.to_string()).collect();
    let settings = grain_serve::Settings::parse(&args, |_| None).unwrap();
    assert_eq!(settings.index.unwrap().to_str(), Some("/data/index.db"));
    assert_eq!(settings.backfill, Some(Config::default()));
}

#[tokio::test]
async fn started_as_set() {
    let ctx = || grain::env::Ctx::new(grain::env::Env::from_vars(|_| None));
    let backfill = Some(Config {
        directories: vec![],
        mirror: None,
        ..Config::default()
    });
    let no_index = grain_serve::Settings {
        backfill: backfill.clone(),
        ..Default::default()
    };
    let app = no_index.app(ctx()).unwrap();
    let why = no_index.backfill(&app).err().unwrap().to_string();
    assert_eq!(why, "--backfill needs --index");
    let unset = grain_serve::Settings::default();
    assert!(
        unset
            .backfill(&unset.app(ctx()).unwrap())
            .unwrap()
            .is_none()
    );
    let dir = tempfile::tempdir().unwrap();
    let settings = grain_serve::Settings {
        index: Some(dir.path().join("index.db")),
        backfill,
        ..Default::default()
    };
    let app = settings.app(ctx()).unwrap();
    let worker = tokio::spawn(settings.backfill(&app).unwrap().unwrap().run());
    // It asks no directory, as none is set, and waits.
    tokio::time::sleep(Duration::from_millis(100)).await;
    assert!(app.index.unwrap().pending(now(), 1).unwrap().is_empty());
    worker.abort();
}
