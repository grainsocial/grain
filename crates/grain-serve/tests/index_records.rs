//! `social.grain.sync.indexRecords`, deprecated for `refreshRecords` and
//! answered from the same read-back, against the reference PDS: an account
//! writes grain's records to its own PDS, asks that PDS for a service token
//! for grain-serve, and names the records, which grain-serve reads back
//! from the PDS, proved, into its index.
//!
//! The reference PDS resolves no lexicon over the network: it validates a
//! record only against the schemas it bundles, and keeps one of a `$type`
//! it has none for with `validationStatus: "unknown"` when `validate` is
//! unset, as the apps leave it. It bundles copies of `social.grain.gallery`,
//! `social.grain.photo` and `social.grain.favorite`, which it holds those
//! to; grain's other collections it keeps unchecked. So the tests write as
//! the apps do, and nothing reaches for grain.social.

#[path = "../../grain/tests/common/mod.rs"]
mod net;

mod common;

use grain::auth;
use grain::env::Ctx;
use grain::session::{self, Session};
use grain::xrpc::Xrpc;
use grain_serve::App;
use grain_serve::index::Index;
use grain_serve::index::records::{Follow, Gallery};
use grain_serve::sync::{INDEX_LXM as LXM, Method, ReadBackError, Repo, named, read_back};
use serde_json::{Value, json};
use std::sync::Arc;

const PATH: &str = "/xrpc/social.grain.sync.indexRecords";
/// The DID the server takes service tokens for. Nothing resolves it: a
/// PDS signs a token for any `aud`.
const AUD: &str = "did:web:grain.test";
const NOW: &str = "2026-10-31T12:00:00.000Z";

struct Caller {
    ctx: Ctx,
    me: Session,
    index: Arc<Index>,
    served: common::Served,
    _dir: tempfile::TempDir,
}

/// A fresh account on the reference PDS, logged in, and grain-serve with
/// an index of its own, taking tokens for [`AUD`].
async fn caller() -> Caller {
    caller_with(&[]).await
}

/// [`caller`], with grain-serve's context set with `extra` too.
async fn caller_with(extra: &[(&str, &str)]) -> Caller {
    let dir = tempfile::tempdir().unwrap();
    let ctx = net::ctx(dir.path(), &[]);
    let index = Arc::new(Index::memory().unwrap());
    let served = common::served_app(App {
        ctx: net::ctx(&dir.path().join("serve"), extra),
        index: Some(index.clone()),
        did: Some(AUD.into()),
        cdn: Default::default(),
        bsky_appview: None,
        web: None,
        admins: Vec::new(),
        cards: Default::default(),
        rankings: Default::default(),
        pages: None,
        spaces: Default::default(),
    })
    .await;
    let account = net::account().await;
    let me = session::create(&ctx, &account.did, &account.password)
        .await
        .unwrap();
    Caller {
        ctx,
        me,
        index,
        served,
        _dir: dir,
    }
}

impl Caller {
    fn pds(&self) -> Xrpc {
        Xrpc::new(self.ctx.http.clone(), &self.me.service)
    }

    /// Writes `record` to `collection` in the caller's repo, as the apps
    /// do: its URI and CID.
    async fn write(&self, collection: &str, record: Value) -> (String, String) {
        let input = json!({"repo": self.me.did, "collection": collection, "record": record});
        self.written("com.atproto.repo.createRecord", input).await
    }

    /// Writes `record` over the one at `uri`.
    async fn rewrite(&self, uri: &str, record: Value) -> (String, String) {
        let (collection, rkey) = parts(uri);
        let input =
            json!({"repo": self.me.did, "collection": collection, "rkey": rkey, "record": record});
        self.written("com.atproto.repo.putRecord", input).await
    }

    async fn written(&self, nsid: &str, input: Value) -> (String, String) {
        let out: Value = self
            .pds()
            .procedure(nsid, Some(&input), Some(&self.me.auth()))
            .await
            .unwrap();
        let field = |name: &str| out[name].as_str().unwrap().to_string();
        (field("uri"), field("cid"))
    }

    async fn delete(&self, uri: &str) {
        let (collection, rkey) = parts(uri);
        let input = json!({"repo": self.me.did, "collection": collection, "rkey": rkey});
        let _: Value = self
            .pds()
            .procedure(
                "com.atproto.repo.deleteRecord",
                Some(&input),
                Some(&self.me.auth()),
            )
            .await
            .unwrap();
    }

    /// A token from the caller's PDS for `lxm` on `aud`.
    async fn token_for(&self, aud: &str, lxm: &str) -> String {
        auth::service_token(&self.ctx, &self.me, aud, lxm)
            .await
            .unwrap()
    }

    async fn token(&self) -> String {
        self.token_for(AUD, LXM).await
    }

    /// indexRecords on `uris`, with a token as the apps ask for one.
    async fn index_records(&self, uris: &[&str]) -> (u16, Value) {
        let token = self.token().await;
        self.served
            .post_as(PATH, &token, &json!({ "uris": uris }))
            .await
    }
}

fn parts(uri: &str) -> (&str, &str) {
    let mut parts = uri.rsplitn(3, '/');
    let rkey = parts.next().unwrap();
    (parts.next().unwrap(), rkey)
}

fn gallery(title: &str) -> Value {
    json!({"$type": "social.grain.gallery", "title": title, "createdAt": NOW})
}

#[tokio::test]
async fn records_written_are_read_back_into_the_index() {
    let c = caller().await;
    // What it puts new in the index is said, for push.
    let (to, mut arrived) = tokio::sync::mpsc::channel(8);
    assert!(c.index.push_to(to));
    let (gallery_uri, cid) = c.write("social.grain.gallery", gallery("Fog")).await;
    let follow =
        json!({"$type": "social.grain.graph.follow", "subject": "did:plc:bob", "createdAt": NOW});
    let (follow_uri, _) = c.write("social.grain.graph.follow", follow).await;
    assert!(!c.index.tracks(&c.me.did));

    let (status, body) = c.index_records(&[&gallery_uri, &follow_uri]).await;
    assert_eq!(status, 200, "{body}");
    assert_eq!(
        body,
        json!({"indexed": [gallery_uri, follow_uri], "notFound": []})
    );
    let held = c.index.get::<Gallery>(&gallery_uri).unwrap().unwrap();
    assert_eq!(
        (held.cid.as_str(), held.did.as_str()),
        (cid.as_str(), c.me.did.as_str())
    );
    assert_eq!(held.record.title, "Fog");
    let follows = c.index.get::<Follow>(&follow_uri).unwrap().unwrap();
    assert_eq!(follows.record.subject, "did:plc:bob");
    // The caller is tracked, so Jetstream keeps what they write next.
    assert!(c.index.tracks(&c.me.did));
    assert_eq!(arrived.try_recv().ok(), Some(gallery_uri.clone()));
    assert_eq!(arrived.try_recv().ok(), Some(follow_uri.clone()));

    // Again, and named twice: the same record by its CID changes nothing.
    let (status, again) = c.index_records(&[&gallery_uri, &gallery_uri]).await;
    assert_eq!(status, 200, "{again}");
    assert_eq!(again, json!({"indexed": [gallery_uri], "notFound": []}));
    let still = c.index.get::<Gallery>(&gallery_uri).unwrap().unwrap();
    assert_eq!(still, held);

    // Edited: the PDS's new version replaces the one held.
    let (_, edited) = c.rewrite(&gallery_uri, gallery("Fog, later")).await;
    let (status, body) = c.index_records(&[&gallery_uri]).await;
    assert_eq!(status, 200, "{body}");
    let now = c.index.get::<Gallery>(&gallery_uri).unwrap().unwrap();
    assert_eq!(
        (now.cid.as_str(), now.record.title.as_str()),
        (edited.as_str(), "Fog, later")
    );
    assert_eq!(now.indexed_at, held.indexed_at);
    // Neither again nor edited is new.
    assert!(arrived.try_recv().is_err());
}

#[tokio::test]
async fn records_gone_from_the_pds_are_deleted() {
    let c = caller().await;
    let (uri, _) = c.write("social.grain.gallery", gallery("Gone")).await;
    let (status, _) = c.index_records(&[&uri]).await;
    assert_eq!(status, 200);
    assert!(c.index.get::<Gallery>(&uri).unwrap().is_some());

    c.delete(&uri).await;
    let never = format!("at://{}/social.grain.gallery/3l3qo2vuowo2a", c.me.did);
    let (status, body) = c.index_records(&[&uri, &never]).await;
    assert_eq!(status, 200, "{body}");
    assert_eq!(body, json!({"indexed": [], "notFound": [uri, never]}));
    assert!(c.index.get::<Gallery>(&uri).unwrap().is_none());
    // Gone is gone however often it is said.
    let (status, again) = c.index_records(&[&uri]).await;
    assert_eq!(
        (status, again),
        (200, json!({"indexed": [], "notFound": [uri]}))
    );
}

#[tokio::test]
async fn uris_outside_the_callers_repo_or_the_index_are_refused() {
    let c = caller().await;
    let (mine, _) = c.write("social.grain.gallery", gallery("Mine")).await;
    let theirs = "at://did:plc:someoneelse/social.grain.gallery/3l3qo2vuowo2a";
    let like = format!("at://{}/app.bsky.feed.like/3l3qo2vuowo2a", c.me.did);
    let no_key = format!("at://{}/social.grain.gallery", c.me.did);
    for (uris, error) in [
        (vec![mine.as_str(), theirs], "RepoMismatch"),
        (vec![mine.as_str(), like.as_str()], "UnknownCollection"),
        (vec![no_key.as_str()], "InvalidRequest"),
    ] {
        let (status, body) = c.index_records(&uris).await;
        assert_eq!(
            (status, body["error"].as_str()),
            (400, Some(error)),
            "{body}"
        );
    }
    // Refused before anything was read, the caller's own record too.
    assert!(c.index.get::<Gallery>(&mine).unwrap().is_none());
    assert!(!c.index.tracks(&c.me.did));

    let token = c.token().await;
    let many: Vec<String> = (0..26).map(|_| mine.clone()).collect();
    for input in [
        json!({"uris": []}),
        json!({"uris": many}),
        json!({"uri": mine}),
        json!("not an object"),
    ] {
        let (status, body) = c.served.post_as(PATH, &token, &input).await;
        assert_eq!(
            (status, body["error"].as_str()),
            (400, Some("InvalidRequest")),
            "{input}: {body}"
        );
    }
}

#[tokio::test]
async fn a_record_that_does_not_fit_its_lexicon_is_not_indexed() {
    let c = caller().await;
    // A follow of no one: the reference PDS bundles no schema for follows,
    // so it keeps one, as a PDS that checks nothing would.
    let follow = json!({"$type": "social.grain.graph.follow", "createdAt": NOW});
    let (uri, _) = c.write("social.grain.graph.follow", follow).await;
    let (status, body) = c.index_records(&[&uri]).await;
    assert_eq!(
        (status, body["error"].as_str()),
        (400, Some("InvalidRequest")),
        "{body}"
    );
    assert!(
        body["message"]
            .as_str()
            .unwrap()
            .contains("does not fit its lexicon")
    );
    assert!(c.index.get::<Follow>(&uri).unwrap().is_none());
}

#[tokio::test]
async fn only_a_service_token_for_this_method_on_this_server_lets_a_call_in() {
    let c = caller().await;
    let (uri, _) = c.write("social.grain.gallery", gallery("Locked")).await;
    let input = json!({ "uris": [uri] });

    let (status, body) = c.served.post(PATH, &input).await;
    assert_eq!(
        (status, body["error"].as_str()),
        (401, Some("AuthenticationRequired"))
    );

    let other_server = c.token_for("did:web:other.test", LXM).await;
    let other_method = c.token_for(AUD, "social.grain.sync.other").await;
    // Signed by a key that is not the account's.
    let stranger = grain::crypto::P256Key::generate().sign_jwt(
        &json!({"typ": "JWT"}),
        &json!({"iss": c.me.did, "aud": AUD, "lxm": LXM, "exp": grain::keys::now_secs() + 60}),
    );
    // Good for two seconds.
    let exp = grain::keys::now_secs() + 2;
    let expired = auth::lasting_token(&c.ctx, &c.me, AUD, LXM, exp)
        .await
        .unwrap();
    while grain::keys::now_secs() <= exp {
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }
    for token in [
        other_server,
        other_method,
        stranger,
        expired,
        "not.a.token".into(),
    ] {
        let (status, body) = c.served.post_as(PATH, &token, &input).await;
        assert_eq!(
            (status, body["error"].as_str()),
            (401, Some("InvalidToken")),
            "{body}"
        );
    }
    assert!(c.index.get::<Gallery>(&uri).unwrap().is_none());
}

#[tokio::test]
async fn a_server_with_no_index_or_did_does_not_serve_it() {
    let s = common::served().await;
    let (status, body) = s
        .post_as(
            PATH,
            "token",
            &json!({"uris": ["at://did:plc:a/social.grain.gallery/3l3qo2vuowo2a"]}),
        )
        .await;
    assert_eq!(
        (status, body["error"].as_str()),
        (501, Some("MethodNotImplemented"))
    );
}

#[tokio::test]
async fn a_pds_that_does_not_answer_fails_the_read_back() {
    let c = caller().await;
    let (uri, _) = c.write("social.grain.gallery", gallery("Elsewhere")).await;
    let repo = Repo {
        pds: "http://127.0.0.1:1".into(),
        ..Repo::of(&c.ctx, &c.me.did).await.unwrap()
    };
    let uris = std::slice::from_ref(&uri);
    let named = named(&c.me.did, uris, Method::Index).unwrap();
    let failed = read_back(&c.ctx, &c.index, &repo, &named, Method::Index).await;
    match failed {
        Err(ReadBackError::Unreachable { uri: failed, .. }) => assert_eq!(failed, uri),
        other => panic!("{other:?}"),
    }
}

/// The reference PDS is on loopback, over http, as any DID document may
/// name one: unless private hosts are allowed, it is not asked.
#[tokio::test]
async fn a_caller_whose_pds_is_not_public_is_refused() {
    let c = caller_with(&[("GRAIN_ALLOW_PRIVATE", "0")]).await;
    let (uri, _) = c.write("social.grain.gallery", gallery("Inward")).await;
    let (status, body) = c.index_records(&[&uri]).await;
    assert_eq!(
        (status, body["error"].as_str()),
        (400, Some("InvalidRequest")),
        "{body}"
    );
    let why = body["message"].as_str().unwrap();
    assert!(why.ends_with("is not on https"), "{why}");
    assert!(c.index.get::<Gallery>(&uri).unwrap().is_none());

    // Named outright, a PDS on https at loopback is not asked, nor one
    // whose name resolves to it.
    let dir = tempfile::tempdir().unwrap();
    let guarded = net::ctx(dir.path(), &[("GRAIN_ALLOW_PRIVATE", "0")]);
    let uris = std::slice::from_ref(&uri);
    let named = named(&c.me.did, uris, Method::Index).unwrap();
    let read = |pds: &'static str| {
        let c = &c;
        let (guarded, named) = (&guarded, &named);
        async move {
            let repo = Repo {
                pds: pds.into(),
                ..Repo::of(&c.ctx, &c.me.did).await.unwrap()
            };
            read_back(guarded, &c.index, &repo, named, Method::Index).await
        }
    };
    match read("https://127.0.0.1:2583").await {
        Err(ReadBackError::Unaskable(why)) => assert_eq!(
            why.to_string(),
            "https://127.0.0.1:2583 is not at a public address"
        ),
        other => panic!("{other:?}"),
    }
    match read("https://localhost:2583").await {
        Err(ReadBackError::Unreachable { error, .. }) => {
            let why = format!("{error:?}");
            assert!(why.contains("localhost has no public address"), "{why}");
        }
        other => panic!("{other:?}"),
    }
    assert!(c.index.get::<Gallery>(&uri).unwrap().is_none());
}
