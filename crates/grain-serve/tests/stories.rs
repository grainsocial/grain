//! An account's stories, expired or not, and which the viewer watched,
//! called as the apps call them: with no token, and with a service token
//! from the viewer's own PDS, the reference PDS. Every answer goes through
//! `common`, so `harness/answers.mjs` holds it to its lexicon.

#[path = "../../grain/tests/common/mod.rs"]
mod net;

mod common;

use grain::env::Ctx;
use grain::session::{self, Session};
use grain_serve::App;
use grain_serve::index::Index;
use serde_json::{Value, json};
use std::sync::Arc;

const AUD: &str = "did:web:grain.test";
const BLOB: &str = "bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy";
const ALICE: &str = "did:plc:alice";
const BOB: &str = "did:plc:bob";
const ARCHIVE: &str = "/xrpc/social.grain.story.getArchive";
const MARK: &str = "/xrpc/social.grain.story.markViewed";
const STORIES: &str = "/xrpc/social.grain.story.getStories";
const AUTHORS: &str = "/xrpc/social.grain.story.getAuthors";

struct World {
    ctx: Ctx,
    me: Session,
    index: Arc<Index>,
    served: common::Served,
    _dir: tempfile::TempDir,
}

async fn world() -> World {
    let dir = tempfile::tempdir().unwrap();
    let ctx = net::ctx(dir.path(), &[]);
    let index = Arc::new(Index::memory().unwrap());
    let served = common::served_app(App {
        index: Some(index.clone()),
        did: Some(AUD.into()),
        ..App::bare(net::ctx(&dir.path().join("serve"), &[]))
    })
    .await;
    let account = net::account().await;
    let me = session::create(&ctx, &account.did, &account.password)
        .await
        .unwrap();
    for (did, handle) in [(ALICE, "alice.test"), (BOB, "bob.test")] {
        index.track(did).unwrap();
        index.set_handle(did, handle).unwrap();
    }
    World {
        ctx,
        me,
        index,
        served,
        _dir: dir,
    }
}

fn cid(uri: &str) -> String {
    atproto::Cid::of_cbor(uri.as_bytes()).to_string()
}

/// `secs` ago.
fn ago(secs: u64) -> String {
    grain::keys::iso(grain::keys::now_micros() - secs * 1_000_000)
}

impl World {
    /// A story by `did`, made `secs` ago; its URI.
    fn story(&self, did: &str, rkey: &str, secs: u64) -> String {
        let uri = format!("at://{did}/social.grain.story/{rkey}");
        let record = json!({
            "$type": "social.grain.story",
            "media": {"$type": "blob", "ref": {"$link": BLOB}, "mimeType": "image/jpeg", "size": 1000},
            "aspectRatio": {"width": 9, "height": 16},
            "createdAt": ago(secs),
        });
        self.index.put(&uri, &cid(&uri), &record).unwrap();
        uri
    }

    async fn token(&self, path: &str) -> String {
        let nsid = path["/xrpc/".len()..].split('?').next().unwrap();
        grain::auth::service_token(&self.ctx, &self.me, AUD, nsid)
            .await
            .unwrap()
    }

    async fn post_as(&self, path: &str, body: &Value) -> (u16, Value) {
        let token = self.token(path).await;
        self.served.post_as(path, &token, body).await
    }

    async fn get_as(&self, path: &str) -> (u16, Value) {
        let token = self.token(path).await;
        self.served.get_with(path, &format!("Bearer {token}")).await
    }
}

fn uris(body: &Value) -> Vec<&str> {
    let stories = body["stories"].as_array().unwrap();
    stories.iter().map(|s| s["uri"].as_str().unwrap()).collect()
}

fn encoded(s: &str) -> String {
    s.replace(':', "%3A").replace('/', "%2F")
}

#[tokio::test]
async fn the_archive_holds_every_story_the_latest_first() {
    let w = world().await;
    let old = w.story(ALICE, "s0", 3 * 24 * 3600);
    let yesterday = w.story(ALICE, "s1", 25 * 3600);
    let now = w.story(ALICE, "s2", 60);
    let labelled = w.story(ALICE, "s3", 30);
    let label = grain_serve::index::Label {
        src: "did:plc:labeler".into(),
        uri: labelled.clone(),
        val: "spam".into(),
        neg: false,
        cts: grain::keys::now_iso(),
        exp: None,
    };
    w.index.label(&label).unwrap();
    w.story(BOB, "s4", 10);

    let (status, body) = w.served.get(&format!("{ARCHIVE}?actor=alice.test")).await;
    assert_eq!(status, 200, "{body}");
    assert_eq!(
        uris(&body),
        [now.as_str(), yesterday.as_str(), old.as_str()]
    );
    assert_eq!(body["stories"][0]["expired"], false);
    assert_eq!(body["stories"][1]["expired"], true);
    assert!(body.get("cursor").is_none());

    let (_, first) = w
        .served
        .get(&format!("{ARCHIVE}?actor={ALICE}&limit=2"))
        .await;
    assert_eq!(uris(&first), [now.as_str(), yesterday.as_str()]);
    let cursor = first["cursor"].as_str().unwrap();
    let (_, rest) = w
        .served
        .get(&format!(
            "{ARCHIVE}?actor={ALICE}&limit=2&cursor={}",
            encoded(cursor)
        ))
        .await;
    assert_eq!(uris(&rest), [old.as_str()]);

    // Taken down, an account's archive is empty; one the index does not
    // know is not found.
    w.index.take_down(ALICE).unwrap();
    let (_, body) = w.served.get(&format!("{ARCHIVE}?actor={ALICE}")).await;
    assert_eq!(body, json!({ "stories": [] }));
    let (status, body) = w.served.get(&format!("{ARCHIVE}?actor=nobody.test")).await;
    assert_eq!(
        (status, body["error"].as_str()),
        (400, Some("InvalidRequest"))
    );
    let (status, _) = w.served.get(ARCHIVE).await;
    assert_eq!(status, 400);
}

#[tokio::test]
async fn what_the_viewer_watched_follows_them() {
    let w = world().await;
    let first = w.story(ALICE, "s1", 120);
    let second = w.story(ALICE, "s2", 60);
    let gone = format!("at://{ALICE}/social.grain.story/s9");

    let (_, body) = w.get_as(AUTHORS).await;
    assert_eq!(body["authors"][0]["unviewedCount"], 2);

    let marked = json!({ "stories": [first, first, gone] });
    let (status, said) = w.post_as(MARK, &marked).await;
    assert_eq!((status, said), (200, json!({})));
    assert_eq!(w.post_as(MARK, &marked).await.0, 200);

    let (_, body) = w.get_as(&format!("{STORIES}?actor={ALICE}")).await;
    assert_eq!(body["stories"][0]["uri"], first.as_str());
    assert_eq!(body["stories"][0]["viewer"], json!({ "viewed": true }));
    assert_eq!(body["stories"][1]["uri"], second.as_str());
    assert!(body["stories"][1].get("viewer").is_none());
    let (_, body) = w.get_as(&format!("{ARCHIVE}?actor={ALICE}")).await;
    assert_eq!(body["stories"][1]["viewer"], json!({ "viewed": true }));
    let (_, body) = w.get_as(AUTHORS).await;
    assert_eq!(body["authors"][0]["unviewedCount"], 1);
    // Not anyone else's: asked by no one, nothing is watched.
    let (_, body) = w.served.get(&format!("{STORIES}?actor={ALICE}")).await;
    assert!(body["stories"][0].get("viewer").is_none());
    let views: i64 = w.index.read(|db| {
        db.query_row(
            "SELECT count(*) FROM story_view -- scans: story_view, a test's own",
            [],
            |r| r.get(0),
        )
        .unwrap()
    });
    assert_eq!(views, 1, "the story not held is passed over");

    let many: Vec<String> = (0..101).map(|i| format!("{gone}{i}")).collect();
    for wrong in [
        json!({ "stories": [] }),
        json!({ "stories": many }),
        json!({ "stories": ["not a uri"] }),
        json!({}),
    ] {
        let (status, said) = w.post_as(MARK, &wrong).await;
        assert_eq!(
            (status, said["error"].as_str()),
            (400, Some("InvalidRequest")),
            "{wrong}"
        );
    }
    let (status, said) = w.served.post(MARK, &json!({ "stories": [first] })).await;
    assert_eq!(
        (status, said["error"].as_str()),
        (401, Some("AuthenticationRequired"))
    );
}
