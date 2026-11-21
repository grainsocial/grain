//! Whom the viewer blocked and muted, called as the apps call them: with a
//! service token from the viewer's own PDS, the reference PDS. Every
//! answer goes through `common`, so `harness/answers.mjs` holds it to its
//! lexicon.

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
const NOW: &str = "2026-10-31T12:00:00.000Z";
const BLOB: &str = "bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy";
const ALICE: &str = "did:plc:alice";
const BOB: &str = "did:plc:bob";
const CAROL: &str = "did:plc:carol";
const MUTE: &str = "/xrpc/social.grain.graph.muteActor";
const UNMUTE: &str = "/xrpc/social.grain.graph.unmuteActor";
const MUTES: &str = "/xrpc/social.grain.graph.getMutes";
const BLOCKS: &str = "/xrpc/social.grain.graph.getBlocks";

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

impl World {
    fn put(&self, did: &str, collection: &str, rkey: &str, mut record: Value) -> String {
        let uri = format!("at://{did}/{collection}/{rkey}");
        record["$type"] = collection.into();
        self.index.put_at(&uri, &cid(&uri), &record, NOW).unwrap();
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

fn dids(body: &Value) -> Vec<&str> {
    let items = body["items"].as_array().unwrap();
    items.iter().map(|i| i["did"].as_str().unwrap()).collect()
}

#[tokio::test]
async fn a_mute_is_the_viewers_alone_until_taken_back() {
    let w = world().await;
    let me = w.me.did.clone();
    let blob =
        json!({"$type": "blob", "ref": {"$link": BLOB}, "mimeType": "image/jpeg", "size": 1000});
    let profile = json!({"displayName": "Alice", "avatar": blob, "createdAt": NOW});
    w.put(ALICE, "social.grain.actor.profile", "self", profile);

    for (did, at) in [(ALICE, 0), (BOB, 1), (CAROL, 2)] {
        let (status, said) = w.post_as(MUTE, &json!({ "actor": did })).await;
        assert_eq!((status, said), (200, json!({})), "{did} at {at}");
    }
    // Again changes nothing.
    assert_eq!(w.post_as(MUTE, &json!({ "actor": BOB })).await.0, 200);

    let (status, body) = w.get_as(MUTES).await;
    assert_eq!(status, 200, "{body}");
    let mut listed = dids(&body);
    listed.sort();
    assert_eq!(listed, [ALICE, BOB, CAROL]);
    let alice = body["items"]
        .as_array()
        .unwrap()
        .iter()
        .find(|i| i["did"] == ALICE)
        .unwrap();
    assert_eq!(
        (alice["handle"].as_str(), alice["displayName"].as_str()),
        (Some("alice.test"), Some("Alice"))
    );
    assert!(alice["avatar"].is_string());
    let carol = body["items"]
        .as_array()
        .unwrap()
        .iter()
        .find(|i| i["did"] == CAROL)
        .unwrap();
    assert_eq!(carol["handle"], "handle.invalid");

    // Paged, each mute once.
    let (_, first) = w.get_as(&format!("{MUTES}?limit=2")).await;
    let cursor = first["cursor"].as_str().unwrap().to_string();
    let (_, rest) = w
        .get_as(&format!("{MUTES}?limit=2&cursor={}", urlencode(&cursor)))
        .await;
    let mut all = dids(&first);
    all.extend(dids(&rest));
    all.sort();
    assert_eq!(all, [ALICE, BOB, CAROL]);
    assert!(rest.get("cursor").is_none());

    // Kept for the viewer, once each.
    let held: i64 = w.index.read(|db| {
        db.query_row("SELECT count(*) FROM mute WHERE did = ?1", [&me], |r| {
            r.get(0)
        })
        .unwrap()
    });
    assert_eq!(held, 3);

    let (status, said) = w.post_as(UNMUTE, &json!({ "actor": BOB })).await;
    assert_eq!((status, said), (200, json!({})));
    assert_eq!(w.post_as(UNMUTE, &json!({ "actor": BOB })).await.0, 200);
    let (_, body) = w.get_as(MUTES).await;
    let mut listed = dids(&body);
    listed.sort();
    assert_eq!(listed, [ALICE, CAROL]);

    // Not oneself, not a handle, not without saying who.
    for wrong in [
        json!({ "actor": me }),
        json!({ "actor": "bob.test" }),
        json!({}),
    ] {
        let (status, said) = w.post_as(MUTE, &wrong).await;
        assert_eq!(
            (status, said["error"].as_str()),
            (400, Some("InvalidRequest")),
            "{wrong}"
        );
    }
    let (status, said) = w.served.post(MUTE, &json!({ "actor": BOB })).await;
    assert_eq!(
        (status, said["error"].as_str()),
        (401, Some("AuthenticationRequired"))
    );
    let (status, said) = w.served.get(MUTES).await;
    assert_eq!(
        (status, said["error"].as_str()),
        (401, Some("AuthenticationRequired"))
    );
    // Another's token is not this method's.
    let token = w.token(MUTES).await;
    let (status, _) = w
        .served
        .post_as(MUTE, &token, &json!({ "actor": BOB }))
        .await;
    assert_eq!(status, 401);
}

#[tokio::test]
async fn blocks_list_by_their_records_the_latest_first() {
    let w = world().await;
    let me = w.me.did.clone();
    let block = |rkey: &str, subject: &str, at: &str| {
        let record = json!({"subject": subject, "createdAt": at});
        w.put(&me, "social.grain.graph.block", rkey, record)
    };
    let older = block("b1", ALICE, "2026-10-31T12:00:00.000Z");
    let newer = block("b2", BOB, "2026-10-31T13:00:00.000Z");
    // Another's block is not the viewer's, and one taken down still lists,
    // so that it can be taken back.
    let record = json!({"subject": CAROL, "createdAt": NOW});
    w.put(ALICE, "social.grain.graph.block", "b3", record);
    w.index.take_down(ALICE).unwrap();

    let (status, body) = w.get_as(BLOCKS).await;
    assert_eq!(status, 200, "{body}");
    assert_eq!(dids(&body), [BOB, ALICE]);
    assert_eq!(body["items"][0]["blockUri"], newer.as_str());
    assert_eq!(body["items"][1]["blockUri"], older.as_str());
    assert_eq!(body["items"][1]["handle"], "alice.test");

    let (_, first) = w.get_as(&format!("{BLOCKS}?limit=1")).await;
    assert_eq!(dids(&first), [BOB]);
    let cursor = first["cursor"].as_str().unwrap().to_string();
    let (_, rest) = w
        .get_as(&format!("{BLOCKS}?limit=1&cursor={}", urlencode(&cursor)))
        .await;
    assert_eq!(dids(&rest), [ALICE]);
    assert!(rest.get("cursor").is_none());

    for wrong in ["?limit=0", "?limit=101", "?cursor=nonsense"] {
        let (status, said) = w.get_as(&format!("{BLOCKS}{wrong}")).await;
        assert_eq!(
            (status, said["error"].as_str()),
            (400, Some("InvalidRequest")),
            "{wrong}"
        );
    }
}

fn urlencode(s: &str) -> String {
    s.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                (b as char).to_string()
            }
            _ => format!("%{b:02X}"),
        })
        .collect()
}
