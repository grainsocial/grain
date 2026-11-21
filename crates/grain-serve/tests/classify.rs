//! The classifiers, scoring against a Clef of the test's own, which keeps
//! every request it is sent and answers each with the next reply it was
//! given, or else with the scores it was set to give, and a CDN that
//! serves every image as a large red PNG.

use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode, header};
use grain::env::{Ctx, Env};
use grain_serve::cdn::Cdn;
use grain_serve::classify::classifiers::{ALL, Classifier};
use grain_serve::classify::clef::{self, Config, Tries};
use grain_serve::classify::{Classify, Scored, Timing};
use grain_serve::index::moderation::NewReport;
use grain_serve::index::{Index, Label};
use serde_json::{Value, json};
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use std::time::Duration;

const NOW: &str = "2026-10-31T12:00:00.000Z";
const ALICE: &str = "did:plc:alice";
const LABELER: &str = "did:web:grain.test";
const TOKEN: &str = "workers-ai-token";

// Blobs' CIDs, each the raw CID of its name: real ones, as the index
// takes a blob only with a CID in its $link.
const PHOTO: &str = "bafkreicvyzgq7tlptvpxzauasocx4p673juepc5u5g6sjveb544ry6ae5a";
const MISSING: &str = "bafkreih7uy2yhx5gobvypuuexbvq22j2cypeqqfk2lc46225e7b3syq7pu";
const OTHER: &str = "bafkreigzfgfbbunqonmdpxcl3bo2yza3b46o6j5epzovhjkpf47vwl6p7i";
const TWO: &str = "bafkreib7ytgp45cyodrmbwm7ohzq74dfnsg63va4yhl5hu3wwdn6nbpc6m";
const THREE: &str = "bafkreielloo3bqj5wjbfnsbjvi3evkimnuxlummlsizkjk4tco4vju2vl4";
const STORY: &str = "bafkreigepa3b42djv4szobuculctsz5nxsfen2kct364ms4wguop2uxbh4";

/// What the fake Clef was sent, and what it answers.
#[derive(Default)]
struct Fake {
    /// Each request: its `authorization` header and its body.
    asked: Mutex<Vec<(String, Value)>>,
    /// Replies to give first, in order: a status, a `retry-after`, a body.
    replies: Mutex<VecDeque<(u16, Option<&'static str>, Value)>>,
    /// The score every question is answered with once `replies` is empty.
    score: Mutex<f64>,
}

impl Fake {
    fn asked(&self) -> Vec<(String, Value)> {
        self.asked.lock().unwrap().clone()
    }

    fn reply(&self, status: u16, after: Option<&'static str>, body: Value) {
        self.replies
            .lock()
            .unwrap()
            .push_back((status, after, body));
    }

    fn scores(&self, score: f64) {
        *self.score.lock().unwrap() = score;
    }
}

async fn answer(
    State(fake): State<Arc<Fake>>,
    headers: HeaderMap,
    body: String,
) -> axum::response::Response {
    use axum::response::IntoResponse;
    let body: Value = serde_json::from_str(&body).unwrap();
    let auth = headers[header::AUTHORIZATION].to_str().unwrap().to_string();
    fake.asked.lock().unwrap().push((auth, body.clone()));
    if let Some((status, after, reply)) = fake.replies.lock().unwrap().pop_front() {
        let mut res = (StatusCode::from_u16(status).unwrap(), axum::Json(reply)).into_response();
        if let Some(after) = after {
            res.headers_mut()
                .insert("retry-after", after.parse().unwrap());
        }
        return res;
    }
    let score = *fake.score.lock().unwrap();
    let answers: serde_json::Map<String, Value> = body["questions"]
        .as_object()
        .unwrap()
        .keys()
        .map(|k| (k.clone(), json!({"type": "noul", "noul": score})))
        .collect();
    let result = json!({"answers": answers, "model": "clef-test", "usage": {"input_tokens": 12}});
    axum::Json(json!({"result": result, "success": true, "errors": []})).into_response()
}

/// A PNG `w` by `h`, all red.
fn png(w: u32, h: u32) -> Vec<u8> {
    let mut out = std::io::Cursor::new(Vec::new());
    let image = image::RgbImage::from_pixel(w, h, image::Rgb([255, 0, 0]));
    image.write_to(&mut out, image::ImageFormat::Png).unwrap();
    out.into_inner()
}

async fn serve(app: axum::Router) -> String {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    tokio::spawn(async move { axum::serve(listener, app).await });
    url
}

struct World {
    index: Arc<Index>,
    fake: Arc<Fake>,
    /// The images the CDN was asked for, by preset and CID.
    drawn: Arc<Mutex<Vec<(String, String)>>>,
    clef: Config,
    cdn: Cdn,
    /// Resolves DIDs at a PLC directory of the test's own.
    ctx: Ctx,
    /// The DIDs it was asked for.
    resolved: Asked,
}

/// A DID hosted by Bridgy Fed, by its DID document alone.
const HOSTED: &str = "did:plc:hosted";
/// A DID the PLC directory has never heard of.
const UNKNOWN: &str = "did:plc:unknown";
/// A DID hosted by Bridgy Fed whose document fails to be read once.
const FLAKY: &str = "did:plc:flaky";
/// A DID whose document is never answered.
const HANGING: &str = "did:plc:hanging";

/// The DIDs a PLC directory was asked for.
type Asked = Arc<Mutex<Vec<String>>>;

/// A PLC directory: every DID is on bsky.social, but for [`HOSTED`] and
/// [`FLAKY`], on Bridgy Fed's PDS, [`UNKNOWN`], which it has no document
/// for, and [`HANGING`], which it never answers for.
async fn plc(asked: Asked) -> String {
    let app = axum::Router::new().route(
        "/{did}",
        axum::routing::get(move |Path(did): Path<String>| async move {
            let times = {
                let mut asked = asked.lock().unwrap();
                asked.push(did.clone());
                asked.iter().filter(|d| **d == did).count()
            };
            let pds = match did.as_str() {
                UNKNOWN => return Err(StatusCode::NOT_FOUND),
                FLAKY if times == 1 => return Err(StatusCode::BAD_GATEWAY),
                HANGING => std::future::pending().await,
                HOSTED | FLAKY => "https://atproto.brid.gy",
                _ => "https://bsky.social",
            };
            let service = json!({"id": "#atproto_pds", "type": "AtprotoPersonalDataServer", "serviceEndpoint": pds});
            Ok(axum::Json(json!({"id": did, "service": [service]})))
        }),
    );
    serve(app).await
}

async fn world() -> World {
    let fake = Arc::new(Fake::default());
    let clef_url = serve(
        axum::Router::new()
            .route("/clef", axum::routing::post(answer))
            .with_state(fake.clone()),
    )
    .await;
    let drawn: Arc<Mutex<Vec<(String, String)>>> = Arc::default();
    let seen = drawn.clone();
    let cdn = axum::Router::new().route(
        "/{sig}/{preset}/plain/{did}/{cid}",
        axum::routing::get(
            move |Path((_, preset, _, cid)): Path<(String, String, String, String)>| async move {
                seen.lock().unwrap().push((preset, cid.clone()));
                match cid.as_str() {
                    MISSING => Err(StatusCode::NOT_FOUND),
                    _ => Ok(([(header::CONTENT_TYPE, "image/png")], png(1000, 750))),
                }
            },
        ),
    );
    let cdn_url = serve(cdn).await;
    let resolved: Asked = Arc::default();
    let plc_url = plc(resolved.clone()).await;
    let ctx = Ctx::new(Env::from_vars(|name| {
        (name == "GRAIN_PLC_URL").then(|| plc_url.clone())
    }));
    let index = Arc::new(Index::memory().unwrap());
    index.track(ALICE).unwrap();
    index.set_handle(ALICE, "alice.test").unwrap();
    World {
        index,
        fake,
        drawn,
        clef: Config {
            url: format!("{clef_url}/clef"),
            model: "clef".into(),
            token: TOKEN.into(),
        },
        cdn: Cdn::new(Some(&cdn_url), Some("00"), Some("00")).unwrap(),
        ctx,
        resolved,
    }
}

/// Timing for tests: an account settles at once, and nothing waits long.
fn quick() -> Timing {
    Timing {
        settle: Duration::from_millis(20),
        retry: Duration::from_millis(1),
        attempts: 2,
        clef: Tries {
            attempts: 2,
            backoff: Duration::from_millis(1),
        },
    }
}

fn classifier(name: &str) -> &'static Classifier {
    ALL.iter().find(|c| c.name == name).unwrap()
}

fn blob(cid: &str) -> Value {
    json!({"$type": "blob", "ref": {"$link": cid}, "mimeType": "image/png", "size": 1000})
}

impl World {
    fn classify(&self, clef: Option<Config>, labeler: Option<&str>) -> Classify {
        Classify {
            index: self.index.clone(),
            ctx: self.ctx.clone(),
            cdn: self.cdn.clone(),
            clef,
            labeler: labeler.map(Into::into),
            timing: quick(),
        }
    }

    fn put(&self, did: &str, collection: &str, rkey: &str, mut record: Value) -> String {
        let uri = format!("at://{did}/{collection}/{rkey}");
        record["$type"] = collection.into();
        record["createdAt"] = NOW.into();
        let cid = atproto::Cid::of_cbor(record.to_string().as_bytes()).to_string();
        self.index.put_at(&uri, &cid, &record, NOW).unwrap();
        uri
    }

    fn photo(&self, rkey: &str, cid: &str) -> String {
        let record = json!({"photo": blob(cid), "aspectRatio": {"width": 4, "height": 3}});
        self.put(ALICE, "social.grain.photo", rkey, record)
    }

    fn gallery(&self, rkey: &str, title: &str) -> String {
        let record = json!({"title": title, "description": "Fog over the bay at dawn"});
        self.put(ALICE, "social.grain.gallery", rkey, record)
    }

    fn profile(&self, did: &str, bio: &str) {
        let record = json!({"displayName": "Alice", "description": bio});
        self.put(did, "social.grain.actor.profile", "self", record);
    }

    fn label(&self, uri: &str, val: &str, neg: bool) {
        let label = Label {
            src: LABELER.into(),
            uri: uri.into(),
            val: val.into(),
            neg,
            cts: NOW.into(),
            exp: None,
        };
        self.index.label(&label).unwrap();
    }

    /// The reports filed, each as its subject, label, reason and reporter.
    fn reports(&self) -> Vec<(String, String, String, String)> {
        self.index.read(|db| {
            let sql = "SELECT subject_uri, label, reason, reported_by FROM report ORDER BY id -- scans: report, a test's own";
            let mut stmt = db.prepare(sql).unwrap();
            let rows = stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)));
            rows.unwrap().map(Result::unwrap).collect()
        })
    }

    fn report(&self, subject: &str, label: &str) {
        self.index.read(|db| {
            let sql =
                "INSERT INTO report (subject_uri, subject_did, label, reported_by, created_at)
                       VALUES (?1, ?2, ?3, 'did:plc:someone', ?4)";
            db.execute(sql, [subject, ALICE, label, NOW]).unwrap();
        });
    }

    /// The values of the labels on `uri`, and who gave each.
    fn labels(&self, uri: &str) -> Vec<(String, String)> {
        let labels = self.index.labels(uri).unwrap();
        labels.into_iter().map(|l| (l.src, l.val)).collect()
    }

    /// Waits, a while at most, for `done` to hold.
    async fn until(&self, done: impl Fn(&World) -> bool) {
        for _ in 0..500 {
            if done(self) {
                return;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
        panic!("never happened");
    }
}

#[tokio::test]
async fn with_no_labeler_to_report_as_nothing_is_reported() {
    let w = world().await;
    let photo = w.photo("p1", PHOTO);
    w.fake.scores(0.9);
    let classify = w.classify(Some(w.clef.clone()), None);
    let scored = classify.score(classifier("nsfw"), &photo, ALICE).await;
    assert_eq!(scored.unwrap(), Scored::Asked { filed: false });
    assert!(w.reports().is_empty());
    assert!(w.index.classification("nsfw", &photo).unwrap().is_some());
}

#[tokio::test]
async fn a_photo_past_its_threshold_is_reported_once() {
    let w = world().await;
    let photo = w.photo("p1", PHOTO);
    w.fake.scores(0.9);
    let classify = w.classify(Some(w.clef.clone()), Some(LABELER));
    let nsfw = classifier("nsfw");
    let scored = classify.score(nsfw, &photo, ALICE).await.unwrap();
    assert_eq!(scored, Scored::Asked { filed: true });

    let asked = w.fake.asked();
    assert_eq!(asked.len(), 1);
    let (auth, body) = &asked[0];
    assert_eq!(auth, &format!("Bearer {TOKEN}"));
    assert_eq!(body["model"], "clef");
    assert_eq!(body["state"], json!({"did": ALICE, "cid": PHOTO}));
    assert_eq!(body["questions"], (nsfw.questions)());
    let image = body["images"][0].as_str().unwrap();
    let jpeg = image.strip_prefix("data:image/jpeg;base64,").unwrap();
    let jpeg = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, jpeg).unwrap();
    let jpeg = image::load_from_memory(&jpeg).unwrap();
    assert_eq!((jpeg.width(), jpeg.height()), (512, 384));
    assert_eq!(
        *w.drawn.lock().unwrap(),
        [("feed_thumbnail".to_string(), PHOTO.to_string())]
    );

    let reports = w.reports();
    assert_eq!(reports.len(), 1);
    let (subject, label, reason, by) = &reports[0];
    assert_eq!((subject.as_str(), by.as_str()), (photo.as_str(), LABELER));
    assert!(label == "nudity" || label == "sexual");
    assert!(
        reason.starts_with("nsfw: ") && reason.ends_with(" 0.90"),
        "{reason}"
    );
    let (signals, top, score) = w.index.classification("nsfw", &photo).unwrap().unwrap();
    assert_eq!(signals["nudity"], json!({"score": 0.9, "type": "noul"}));
    assert!(top.is_some());
    assert_eq!(score, 0.9);

    // The same photo is not asked about again; a changed one is, and the
    // report already open is not filed twice.
    assert_eq!(
        classify.score(nsfw, &photo, ALICE).await.unwrap(),
        Scored::Skipped
    );
    assert_eq!(w.fake.asked().len(), 1);
    w.photo("p1", OTHER);
    let scored = classify.score(nsfw, &photo, ALICE).await.unwrap();
    assert_eq!(scored, Scored::Asked { filed: false });
    assert_eq!(w.fake.asked().len(), 2);
    assert_eq!(w.reports().len(), 1);
}

#[tokio::test]
async fn scores_under_their_threshold_file_nothing() {
    let w = world().await;
    let gallery = w.gallery("g1", "Morning walk");
    w.fake.scores(0.59);
    let classify = w.classify(Some(w.clef.clone()), Some(LABELER));
    let scored = classify
        .score(classifier("gallery-spam"), &gallery, ALICE)
        .await;
    assert_eq!(scored.unwrap(), Scored::Asked { filed: false });
    assert!(w.reports().is_empty());
    let kept = w.index.classification("gallery-spam", &gallery).unwrap();
    assert_eq!(kept.unwrap().2, 0.59);
    let body = &w.fake.asked()[0].1;
    assert_eq!(body["state"]["title"], "Morning walk");
    assert!(body.get("images").is_none());
}

#[tokio::test]
async fn nothing_with_nothing_to_judge_is_asked() {
    let w = world().await;
    let classify = w.classify(Some(w.clef.clone()), Some(LABELER));
    // Too little text, a record gone, an account with too few galleries,
    // and no Clef at all.
    let short = w.gallery("g1", "x");
    w.index
        .read(|db| {
            db.execute(
                "UPDATE gallery SET description = NULL -- scans: gallery, a test's own",
                [],
            )
        })
        .unwrap();
    let gone = format!("at://{ALICE}/social.grain.gallery/gone");
    let gallery_spam = classifier("gallery-spam");
    for subject in [&short, &gone] {
        let scored = classify.score(gallery_spam, subject, ALICE).await.unwrap();
        assert_eq!(scored, Scored::Skipped);
    }
    assert_eq!(
        classify
            .score(classifier("spam"), ALICE, ALICE)
            .await
            .unwrap(),
        Scored::Skipped
    );
    let off = w.classify(None, None);
    assert_eq!(
        off.score(classifier("impersonation"), ALICE, ALICE)
            .await
            .unwrap(),
        Scored::Skipped
    );
    assert!(w.fake.asked().is_empty());
}

#[tokio::test]
async fn nothing_about_the_safety_of_children_reaches_a_model() {
    let classify_all = |w: &World| {
        let classify = w.classify(Some(w.clef.clone()), Some(LABELER));
        let photo = format!("at://{ALICE}/social.grain.photo/p1");
        async move {
            let photo = classify
                .score(classifier("nsfw"), &photo, ALICE)
                .await
                .unwrap();
            let account = classify
                .score(classifier("impersonation"), ALICE, ALICE)
                .await
                .unwrap();
            (photo, account)
        }
    };
    let skipped = (Scored::Skipped, Scored::Skipped);
    // A label on the account, a label on another of its records, negated
    // since, a report on the account, a report on a record, a report
    // filed under another label for a child-safety reason, and a label its
    // author gave a record of its own.
    let cases: [&dyn Fn(&World); 6] = [
        &|w| w.label(ALICE, "csae", false),
        &|w| {
            let other = w.photo("p2", TWO);
            w.label(&other, "csae", false);
            w.label(&other, "csae", true);
        },
        &|w| w.report(ALICE, "csae"),
        &|w| w.report(&format!("at://{ALICE}/social.grain.gallery/g9"), "csae"),
        &|w| {
            let report = NewReport {
                subject: ALICE,
                subject_did: ALICE,
                label: "other",
                reason_type: Some("tools.ozone.report.defs#reasonChildSafetyGroom"),
                reason: None,
                reported_by: "did:plc:someone",
                created_at: NOW,
            };
            w.index.file_report(&report).unwrap();
        },
        &|w| {
            let record = json!({
                "photo": blob(THREE), "aspectRatio": {"width": 1, "height": 1},
                "labels": {"$type": "com.atproto.label.defs#selfLabels", "values": [{"val": "csae"}]},
            });
            w.put(ALICE, "social.grain.photo", "p3", record);
        },
    ];
    for case in cases {
        let w = world().await;
        w.photo("p1", PHOTO);
        w.profile(ALICE, "Photos of the coast");
        case(&w);
        assert_eq!(classify_all(&w).await, skipped);
        assert!(w.fake.asked().is_empty());
        assert!(w.drawn.lock().unwrap().is_empty());
    }

    // Another account's, or another label's, stops nothing.
    let w = world().await;
    w.photo("p1", PHOTO);
    w.label("did:plc:bob", "csae", false);
    w.label(ALICE, "spam", false);
    w.report(ALICE, "spam");
    let (photo, account) = classify_all(&w).await;
    assert!(matches!(photo, Scored::Asked { .. }) && matches!(account, Scored::Asked { .. }));

    // Nor is an account taken down, or one gone from its host.
    for gone in [0, 1] {
        let w = world().await;
        w.photo("p1", PHOTO);
        match gone {
            0 => w.index.take_down(ALICE).unwrap(),
            _ => w.index.set_host_status(ALICE, Some("deleted")).unwrap(),
        }
        assert_eq!(classify_all(&w).await, skipped);
        assert!(w.fake.asked().is_empty());
    }
}

#[tokio::test]
async fn clef_is_asked_again_when_it_is_busy() {
    let w = world().await;
    let http = reqwest::Client::new();
    let tries = Tries {
        attempts: 3,
        backoff: Duration::from_millis(1),
    };
    let ask = |images: &'static [String]| {
        let (http, clef) = (http.clone(), w.clef.clone());
        async move {
            clef::ask(
                &http,
                &clef,
                &json!({"a": 1}),
                &json!({"q": {"type": "noul"}}),
                images,
                tries,
            )
            .await
        }
    };
    w.fake.reply(503, Some("0"), json!({}));
    w.fake.reply(429, None, json!({}));
    let answers = ask(&[]).await.unwrap();
    assert_eq!(answers.model, "clef-test");
    assert_eq!(answers.input_tokens, 12);
    assert_eq!(answers.signals[0].0, "q");
    assert_eq!(w.fake.asked().len(), 3);

    // Refused outright, it is not.
    w.fake
        .reply(400, None, json!({"errors": [{"message": "bad questions"}]}));
    let refused = ask(&[]).await.unwrap_err().to_string();
    assert!(
        refused.starts_with("Clef 400: ") && refused.contains("bad questions"),
        "{refused}"
    );
    assert_eq!(w.fake.asked().len(), 4);

    // Nor when Workers AI says it failed.
    w.fake.reply(
        200,
        None,
        json!({"success": false, "errors": [{"message": "no"}]}),
    );
    assert!(ask(&[]).await.unwrap_err().to_string().contains("no"));

    // Busy every time, it gives up, and says what it last heard; the
    // token is never in it.
    for _ in 0..3 {
        w.fake.reply(502, Some("soon"), json!({"why": "busy"}));
    }
    let busy = ask(&[]).await.unwrap_err().to_string();
    assert!(busy.contains("502") && !busy.contains(TOKEN), "{busy}");

    // A result Workers AI does not wrap is read as it is.
    w.fake.reply(
        200,
        None,
        json!({"answers": {"q": {"type": "noul", "noul": 0.3}}}),
    );
    let bare = ask(&[]).await.unwrap();
    assert_eq!(
        (bare.model.as_str(), bare.signals[0].1.score),
        ("clef", 0.3)
    );

    // A Clef that is not there is tried each time, then given up on.
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let nowhere = Config {
        url: format!("http://{}/clef", listener.local_addr().unwrap()),
        ..w.clef.clone()
    };
    drop(listener);
    let state = json!({});
    let err = clef::ask(&http, &nowhere, &state, &state, &[], tries)
        .await
        .unwrap_err();
    assert!(err.to_string().starts_with("Clef: "), "{err}");
}

#[tokio::test]
async fn an_image_the_cdn_cannot_draw_fails_the_score() {
    let w = world().await;
    let photo = w.photo("p1", MISSING);
    let classify = w.classify(Some(w.clef.clone()), Some(LABELER));
    assert!(
        classify
            .score(classifier("nsfw"), &photo, ALICE)
            .await
            .is_err()
    );
    assert!(w.fake.asked().is_empty());
    assert!(w.index.classification("nsfw", &photo).unwrap().is_none());
}

#[tokio::test]
async fn what_arrives_is_scored_and_its_author_once_they_settle() {
    let w = world().await;
    w.fake.scores(0.8);
    let classify = w.classify(Some(w.clef.clone()), Some(LABELER));
    assert!(classify.start());
    assert!(!w.classify(None, None).start());

    w.profile(ALICE, "Photos of the coast");
    let mut galleries = vec![];
    for i in 0..5 {
        let gallery = w.gallery(&format!("g{i}"), &format!("Coast walk number {i}"));
        w.index.arrived(&gallery);
        galleries.push(gallery);
    }
    let photo = w.photo("p1", PHOTO);
    w.index.arrived(&photo);
    // Records of no classifier's, and what is not a record, ask nothing.
    w.index
        .arrived(&format!("at://{ALICE}/social.grain.favorite/f1"));
    w.index.arrived("not a uri");

    let scored = |w: &World, name: &str, subject: &str| {
        w.index.classification(name, subject).unwrap().is_some()
    };
    w.until(|w| {
        galleries.iter().all(|g| scored(w, "gallery-spam", g))
            && scored(w, "nsfw", &photo)
            && ["impersonation", "scam", "spam"]
                .iter()
                .all(|c| scored(w, c, ALICE))
    })
    .await;
    // The account was asked about once, not once a record.
    let asked = w.fake.asked();
    let about_alice = asked
        .iter()
        .filter(|(_, b)| b["questions"] == (classifier("spam").questions)());
    assert_eq!(about_alice.count(), 1);
    assert_eq!(asked.len(), 5 + 1 + 3);
    let filed = w.reports();
    assert!(filed.iter().all(|(_, _, _, by)| by == LABELER), "{filed:?}");
    for name in ["gallery-spam", "nsfw", "impersonation", "scam"] {
        let said = format!("{name}: ");
        assert!(
            filed
                .iter()
                .any(|(_, _, reason, _)| reason.starts_with(&said)),
            "{name} filed nothing: {filed:?}"
        );
    }
    // `scam` asked for `spam` on the account, crossing on financial_scam,
    // so `spam`'s report on it, open beside that one, was not filed.
    let on_alice: Vec<_> = w
        .reports()
        .into_iter()
        .filter(|(s, _, _, _)| s == ALICE)
        .collect();
    let spam: Vec<_> = on_alice.iter().filter(|(_, l, _, _)| l == "spam").collect();
    assert_eq!(spam.len(), 1);
    assert_eq!(spam[0].3, LABELER);
    assert!(
        spam[0].2.starts_with("scam: financial_scam 0.80"),
        "{}",
        spam[0].2
    );
}

#[tokio::test]
async fn a_score_that_fails_is_tried_again() {
    let w = world().await;
    w.fake.scores(0.1);
    // Busy twice, which the request's own tries do not get past, then
    // answered when the subject is tried again.
    w.fake.reply(503, None, json!({}));
    w.fake.reply(503, None, json!({}));
    let classify = w.classify(Some(w.clef.clone()), Some(LABELER));
    assert!(classify.start());
    let photo = w.photo("p1", PHOTO);
    w.index.arrived(&photo);
    w.until(|w| w.index.classification("nsfw", &photo).unwrap().is_some())
        .await;

    // One that fails every time is dropped after its attempts.
    let missing = w.photo("p2", MISSING);
    w.index.arrived(&missing);
    w.until(|w| {
        w.drawn
            .lock()
            .unwrap()
            .iter()
            .filter(|(_, c)| c == MISSING)
            .count()
            == 2
    })
    .await;
    tokio::time::sleep(Duration::from_millis(50)).await;
    assert_eq!(
        w.drawn
            .lock()
            .unwrap()
            .iter()
            .filter(|(_, c)| c == MISSING)
            .count(),
        2
    );
    assert!(w.index.classification("nsfw", &missing).unwrap().is_none());
}

#[tokio::test]
async fn bridged_posts_are_labeled_spam_as_they_arrive() {
    let w = world().await;
    let classify = w.classify(None, Some(LABELER));
    assert!(classify.start());
    let bridged = "did:plc:bridged";
    w.index.track(bridged).unwrap();
    w.index
        .set_handle(bridged, "someone.mastodon.social.ap.brid.gy")
        .unwrap();
    let footer = "did:plc:footer";
    w.index.track(footer).unwrap();
    w.index.set_handle(footer, "someone.example").unwrap();
    w.profile(
        footer,
        "Painter.\n\n🌉 bridged from someone@example.social by https://fed.brid.gy/",
    );

    let post = |did: &str, collection: &str, rkey: &str| {
        let record = match collection {
            "social.grain.gallery" => json!({"title": "Bridged"}),
            "social.grain.story" => {
                json!({"media": blob(STORY), "aspectRatio": {"width": 1, "height": 1}})
            }
            "social.grain.photo" => {
                json!({"photo": blob(PHOTO), "aspectRatio": {"width": 1, "height": 1}})
            }
            _ => json!({"subject": format!("at://{ALICE}/social.grain.gallery/g1"), "text": "hi"}),
        };
        let uri = w.put(did, collection, rkey, record);
        w.index.arrived(&uri);
        uri
    };
    let gallery = post(bridged, "social.grain.gallery", "g1");
    let story = post(bridged, "social.grain.story", "s1");
    let comment = post(footer, "social.grain.comment", "c1");
    // Someone of their own, and a bridged account's photo, are not.
    let own = post(ALICE, "social.grain.gallery", "g1");
    let photo = post(bridged, "social.grain.photo", "p1");
    // A label of `spam` a moderator took off stays off.
    let cleared = format!("at://{bridged}/social.grain.gallery/g2");
    w.label(&cleared, "spam", false);
    w.label(&cleared, "spam", true);
    post(bridged, "social.grain.gallery", "g2");
    // One new to the index, with no handle or profile here yet, is known
    // by the PDS its DID document names; one whose document cannot be
    // read is tried again, then left alone. One whose document never
    // comes holds up nothing after it.
    for did in [HOSTED, UNKNOWN, FLAKY, HANGING] {
        w.index.track(did).unwrap();
    }
    post(HANGING, "social.grain.gallery", "g1");
    let hosted = post(HOSTED, "social.grain.gallery", "g1");
    let unknown = post(UNKNOWN, "social.grain.gallery", "g1");
    let flaky = post(FLAKY, "social.grain.gallery", "g1");

    let all = [&gallery, &story, &comment, &hosted, &flaky];
    w.until(|w| all.iter().all(|uri| !w.labels(uri).is_empty()))
        .await;
    let tries = |w: &World, did: &str| {
        w.resolved
            .lock()
            .unwrap()
            .iter()
            .filter(|d| *d == did)
            .count()
    };
    // Alice's own was looked up, found on bsky.social, and left alone.
    w.until(|w| tries(w, UNKNOWN) == 2 && tries(w, ALICE) == 1)
        .await;
    tokio::time::sleep(Duration::from_millis(20)).await;
    assert_eq!(tries(&w, UNKNOWN), 2);
    assert_eq!(tries(&w, FLAKY), 2);
    assert!(w.labels(&unknown).is_empty());
    for uri in all {
        assert_eq!(
            w.labels(uri),
            [(LABELER.to_string(), "spam".to_string())],
            "{uri}"
        );
    }
    for uri in [&own, &photo] {
        assert!(w.labels(uri).is_empty(), "{uri}");
    }
    assert_eq!(w.labels(&cleared).len(), 2);
    assert!(w.fake.asked().is_empty());
}

#[tokio::test]
async fn without_a_labeler_bridged_posts_are_not_labeled() {
    let w = world().await;
    let classify = w.classify(Some(w.clef.clone()), None);
    assert!(classify.start());
    w.index.set_handle(ALICE, "alice.ap.brid.gy").unwrap();
    let gallery = w.gallery("g1", "A long enough title");
    w.index.arrived(&gallery);
    w.until(|w| {
        w.index
            .classification("gallery-spam", &gallery)
            .unwrap()
            .is_some()
    })
    .await;
    assert!(w.labels(&gallery).is_empty());
}
