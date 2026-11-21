//! `social.grain.sync.refreshRecords` against the reference PDS: an account
//! writes to its own PDS, then names the records, which grain-serve reads
//! back with their proofs and keeps at their revision, so the read path
//! answers the write at once and Jetstream's copy of it, or of an older
//! version, changes nothing.

#[path = "../../grain/tests/common/mod.rs"]
mod net;

mod common;

use axum::Router;
use axum::http::StatusCode;
use axum::routing::get;
use grain::env::Ctx;
use grain::jetstream::{Event, Op, What};
use grain::session::{self, Session};
use grain::xrpc::Xrpc;
use grain_serve::App;
use grain_serve::index::Index;
use grain_serve::index::records::{Follow, Gallery};
use grain_serve::sync::{LXM, Proof, Repo, proved};
use serde_json::{Value, json};
use std::sync::Arc;

const PATH: &str = "/xrpc/social.grain.sync.refreshRecords";
/// The DID the server takes service tokens for. Nothing resolves it: a
/// PDS signs a token for any `aud`.
const AUD: &str = "did:web:grain.test";
const NOW: &str = "2026-10-31T12:00:00.000Z";
const RKEY: &str = "3l3qo2vuowo2a";

struct Caller {
    ctx: Ctx,
    me: Session,
    index: Arc<Index>,
    served: common::Served,
    _dir: tempfile::TempDir,
}

/// A fresh account on the reference PDS, logged in, and grain-serve with
/// an index of its own, taking tokens for [`AUD`], its context set with
/// `extra` too.
async fn caller(extra: &[(&str, &str)]) -> Caller {
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

/// What a write to the PDS made: the record's URI and CID, and the
/// revision of the commit.
struct Wrote {
    uri: String,
    cid: String,
    rev: String,
}

impl Caller {
    fn pds(&self) -> Xrpc {
        Xrpc::new(self.ctx.http.clone(), &self.me.service)
    }

    async fn call(&self, nsid: &str, input: Value) -> Value {
        self.pds()
            .procedure(nsid, Some(&input), Some(&self.me.auth()))
            .await
            .unwrap()
    }

    /// Puts `record` at `rkey` in `collection`.
    async fn put_in(&self, collection: &str, rkey: &str, record: Value) -> Wrote {
        let input = json!({"repo": self.me.did, "collection": collection,
            "rkey": rkey, "record": record});
        let out = self.call("com.atproto.repo.putRecord", input).await;
        let field = |name: &str| out[name].as_str().unwrap().to_string();
        Wrote {
            uri: field("uri"),
            cid: field("cid"),
            rev: out["commit"]["rev"].as_str().unwrap().to_string(),
        }
    }

    async fn put(&self, record: Value) -> Wrote {
        self.put_in("social.grain.gallery", RKEY, record).await
    }

    /// Deletes the gallery at [`RKEY`]: the commit's revision.
    async fn delete(&self) -> String {
        let input = json!({"repo": self.me.did, "collection": "social.grain.gallery",
            "rkey": RKEY});
        let out = self.call("com.atproto.repo.deleteRecord", input).await;
        out["commit"]["rev"].as_str().unwrap().to_string()
    }

    async fn token(&self) -> String {
        grain::auth::service_token(&self.ctx, &self.me, AUD, LXM)
            .await
            .unwrap()
    }

    async fn refresh(&self, uris: &[&str]) -> (u16, Value) {
        let token = self.token().await;
        self.served
            .post_as(PATH, &token, &json!({ "uris": uris }))
            .await
    }

    async fn read(&self, uri: &str) -> (u16, Value) {
        let path = format!("/xrpc/social.grain.gallery.getGallery?gallery={uri}");
        self.served.get(&path).await
    }

    /// Jetstream bringing the gallery at [`RKEY`]: `action`, with `record`
    /// as its CID and value unless a delete, at `rev`.
    fn stream(&self, action: &str, record: Option<(&str, Value)>, rev: &str) {
        let (cid, record) = record.map(|(c, r)| (c.to_string(), r)).unzip();
        let op = Op {
            action: action.into(),
            collection: "social.grain.gallery".into(),
            rkey: RKEY.into(),
            cid,
            record,
            rev: Some(rev.into()),
        };
        let what = What::Commit {
            did: self.me.did.clone(),
            op,
        };
        grain_serve::jetstream::apply(&self.index, Event { seq: None, what }).unwrap();
    }

    /// The caller's repo, as its DID document names it.
    async fn repo(&self) -> Repo {
        Repo::of(&self.ctx, &self.me.did).await.unwrap()
    }
}

fn gallery(title: &str) -> Value {
    json!({"$type": "social.grain.gallery", "title": title, "createdAt": NOW})
}

#[tokio::test]
async fn a_write_refreshed_is_read_back_at_once() {
    let c = caller(&[]).await;
    let (to, mut arrived) = tokio::sync::mpsc::channel(8);
    assert!(c.index.push_to(to));
    let first = c.put(gallery("Fog")).await;
    assert_eq!(c.read(&first.uri).await.0, 400, "not yet indexed");

    // Named twice, answered once.
    let (status, body) = c.refresh(&[&first.uri, &first.uri]).await;
    assert_eq!(status, 200, "{body}");
    assert_eq!(
        body,
        json!({"records": [{"uri": first.uri, "cid": first.cid}]})
    );
    let (status, view) = c.read(&first.uri).await;
    assert_eq!(status, 200, "{view}");
    assert_eq!(view["gallery"]["cid"], first.cid.as_str());
    assert!(c.index.tracks(&c.me.did));
    assert_eq!(arrived.try_recv().ok(), Some(first.uri.clone()));

    // Updated: the new version at once, and Jetstream's copy of the old
    // one, or of this one, changes nothing.
    let second = c.put(gallery("Fog, later")).await;
    let (status, _) = c.refresh(&[&second.uri]).await;
    assert_eq!(status, 200);
    let held = c.index.get::<Gallery>(&second.uri).unwrap().unwrap();
    assert_eq!(
        (held.cid.as_str(), held.record.title.as_str()),
        (second.cid.as_str(), "Fog, later")
    );
    c.stream("create", Some((&first.cid, gallery("Fog"))), &first.rev);
    c.stream(
        "update",
        Some((&second.cid, gallery("Fog, later"))),
        &second.rev,
    );
    assert_eq!(c.index.get::<Gallery>(&second.uri).unwrap().unwrap(), held);
    assert_eq!(
        c.read(&second.uri).await.1["gallery"]["cid"],
        second.cid.as_str()
    );
    assert!(arrived.try_recv().is_err(), "an update is not new");

    // Deleted: gone at once, answered with no CID; Jetstream bringing the
    // writes before it late puts nothing back, its own delete changes
    // nothing, and the record stays gone however often it is refreshed.
    let gone = c.delete().await;
    for _ in 0..2 {
        let (status, body) = c.refresh(&[&second.uri]).await;
        assert_eq!(
            (status, body),
            (200, json!({"records": [{"uri": second.uri}]}))
        );
    }
    assert_eq!(c.read(&second.uri).await.0, 400);
    c.stream("create", Some((&first.cid, gallery("Fog"))), &first.rev);
    c.stream(
        "update",
        Some((&second.cid, gallery("Fog, later"))),
        &second.rev,
    );
    c.stream("delete", None, &gone);
    assert!(c.index.get::<Gallery>(&second.uri).unwrap().is_none());
    assert_eq!(c.read(&second.uri).await.0, 400);

    // Made again since: a later revision, so kept.
    let again = c.put(gallery("Fog, again")).await;
    c.stream(
        "create",
        Some((&again.cid, gallery("Fog, again"))),
        &again.rev,
    );
    assert_eq!(
        c.read(&again.uri).await.1["gallery"]["cid"],
        again.cid.as_str()
    );
}

#[tokio::test]
async fn a_record_grain_does_not_keep_is_answered_and_left_alone() {
    let c = caller(&[]).await;
    let input = json!({"repo": c.me.did, "collection": "app.bsky.feed.like",
        "record": {"$type": "app.bsky.feed.like", "createdAt": NOW,
            "subject": {"uri": "at://did:plc:a/app.bsky.feed.post/3l3qo2vuowo2a",
                "cid": "bafyreie5737gdxlw5i64vzichcalba3z2v5n6icifvx5xytvske7mr3hpm"}}});
    let out = c.call("com.atproto.repo.createRecord", input).await;
    let like = out["uri"].as_str().unwrap();
    let (status, body) = c.refresh(&[like]).await;
    assert_eq!(status, 200, "{body}");
    assert_eq!(body, json!({"records": [{"uri": like, "cid": out["cid"]}]}));
    assert!(!c.index.tracks(&c.me.did));

    // Nor is one that does not fit its lexicon, in the same call as one
    // that does: a follow of no one, which the reference PDS keeps, as it
    // bundles no schema for follows.
    let follow = json!({"$type": "social.grain.graph.follow", "createdAt": NOW});
    let unfit = c.put_in("social.grain.graph.follow", RKEY, follow).await;
    let fit = c.put(gallery("Fit")).await;
    let (status, body) = c.refresh(&[like, &unfit.uri, &fit.uri]).await;
    assert_eq!(status, 200, "{body}");
    assert_eq!(
        body["records"],
        json!([
            {"uri": like, "cid": out["cid"]},
            {"uri": unfit.uri, "cid": unfit.cid},
            {"uri": fit.uri, "cid": fit.cid},
        ])
    );
    assert!(c.index.get::<Follow>(&unfit.uri).unwrap().is_none());
    assert!(c.index.get::<Gallery>(&fit.uri).unwrap().is_some());
}

#[tokio::test]
async fn only_the_callers_own_records_by_their_token_are_refreshed() {
    let c = caller(&[]).await;
    let mine = c.put(gallery("Mine")).await;
    let theirs = "at://did:plc:someoneelse/social.grain.gallery/3l3qo2vuowo2a";
    let (status, body) = c.refresh(&[&mine.uri, theirs]).await;
    assert_eq!(
        (status, body["error"].as_str()),
        (400, Some("NotYours")),
        "{body}"
    );
    // Refused before anything was read, the caller's own record too.
    assert!(c.index.get::<Gallery>(&mine.uri).unwrap().is_none());

    let no_key = format!("at://{}/social.grain.gallery", c.me.did);
    let (status, body) = c.refresh(&[&no_key]).await;
    assert_eq!(
        (status, body["error"].as_str()),
        (400, Some("InvalidRequest"))
    );
    let token = c.token().await;
    let many = vec![mine.uri.as_str(); 26];
    for input in [
        json!({ "uris": many }),
        json!({"records": [{"uri": mine.uri}]}),
        json!("no"),
    ] {
        let (status, body) = c.served.post_as(PATH, &token, &input).await;
        assert_eq!(
            (status, body["error"].as_str()),
            (400, Some("InvalidRequest")),
            "{input}: {body}"
        );
    }
    // None named, none answered.
    let (status, body) = c.served.post_as(PATH, &token, &json!({"uris": []})).await;
    assert_eq!((status, body), (200, json!({"records": []})));

    let (status, body) = c.served.post(PATH, &json!({ "uris": [mine.uri] })).await;
    assert_eq!(
        (status, body["error"].as_str()),
        (401, Some("AuthenticationRequired"))
    );
    let indexing = grain::auth::service_token(&c.ctx, &c.me, AUD, grain_serve::sync::INDEX_LXM)
        .await
        .unwrap();
    let (status, body) = c
        .served
        .post_as(PATH, &indexing, &json!({ "uris": [mine.uri] }))
        .await;
    assert_eq!(
        (status, body["error"].as_str()),
        (401, Some("InvalidToken")),
        "a token for indexRecords is not one for this"
    );
}

/// The reference PDS is on loopback, over http, as any DID document may
/// name one: unless private hosts are allowed, it is not asked.
#[tokio::test]
async fn a_caller_whose_pds_is_not_asked_is_unreachable() {
    let c = caller(&[("GRAIN_ALLOW_PRIVATE", "0")]).await;
    let wrote = c.put(gallery("Inward")).await;
    let (status, body) = c.refresh(&[&wrote.uri]).await;
    assert_eq!(
        (status, body["error"].as_str()),
        (400, Some("Unreachable")),
        "{body}"
    );
    assert!(c.index.get::<Gallery>(&wrote.uri).unwrap().is_none());
}

#[tokio::test]
async fn a_proof_the_accounts_key_did_not_sign_is_refused() {
    let c = caller(&[]).await;
    c.put(gallery("Forged")).await;
    let repo = Repo {
        key: grain::crypto::P256Key::generate().public(),
        ..c.repo().await
    };
    let refused = proved(&c.ctx, &repo, "social.grain.gallery", RKEY)
        .await
        .unwrap_err();
    assert!(
        format!("{refused:#}").contains("a commit the account's key did not sign"),
        "{refused:#}"
    );
    // Nor is a PDS that does not answer.
    let nowhere = Repo {
        pds: "http://127.0.0.1:1".into(),
        ..c.repo().await
    };
    assert!(proved(&c.ctx, &nowhere, "a.b", "c").await.is_err());
}

/// A PDS of `routes`, on loopback: its URL.
async fn pds_of(routes: Router) -> String {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let at = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, routes).await });
    format!("http://{at}")
}

#[tokio::test]
async fn a_proof_tampered_with_is_refused() {
    let c = caller(&[]).await;
    let wrote = c.put(gallery("Tampered")).await;
    let repo = c.repo().await;
    let url = format!(
        "{}/xrpc/com.atproto.sync.getRecord?did={}&collection=social.grain.gallery&rkey={RKEY}",
        repo.pds, repo.did
    );
    let car = c.ctx.http.get(url).send().await.unwrap().bytes().await;
    let mut car = car.unwrap().to_vec();
    let proof = proved(&c.ctx, &repo, "social.grain.gallery", RKEY)
        .await
        .unwrap();
    assert_eq!(proof.rev, wrote.rev);
    // A byte of its last block changed: no longer what its CID says.
    *car.last_mut().unwrap() ^= 1;
    let served = Router::new().route(
        "/xrpc/com.atproto.sync.getRecord",
        get(move || {
            let car = car.clone();
            async move { car }
        }),
    );
    let tampered = Repo {
        pds: pds_of(served).await,
        ..c.repo().await
    };
    let refused = proved(&c.ctx, &tampered, "social.grain.gallery", RKEY)
        .await
        .unwrap_err();
    assert!(
        format!("{refused:#}").contains("does not hash to its CID"),
        "{refused:#}"
    );
}

/// A PDS that proves only what it has, as pds.js does, answering
/// `RecordNotFound` for a record it has not and `rev` as its latest.
fn proving_only_what_it_has(rev: &'static str) -> Router {
    let not_found = || async {
        let said = json!({"error": "RecordNotFound", "message": "no such record"});
        (StatusCode::BAD_REQUEST, axum::Json(said))
    };
    let latest = move || async move { axum::Json(json!({"cid": "bafy", "rev": rev})) };
    Router::new()
        .route("/xrpc/com.atproto.sync.getRecord", get(not_found))
        .route("/xrpc/com.atproto.sync.getLatestCommit", get(latest))
}

#[tokio::test]
async fn a_pds_that_proves_only_what_it_has_says_gone_as_of_its_latest_revision() {
    let c = caller(&[]).await;
    let repo = Repo {
        pds: pds_of(proving_only_what_it_has("3l3qo2vuowo2a")).await,
        ..c.repo().await
    };
    let proof = proved(&c.ctx, &repo, "social.grain.gallery", RKEY)
        .await
        .unwrap();
    assert_eq!(
        proof,
        Proof {
            rev: "3l3qo2vuowo2a".into(),
            record: None
        }
    );
    // A latest revision that is not one is not taken.
    let repo = Repo {
        pds: pds_of(proving_only_what_it_has("now")).await,
        ..c.repo().await
    };
    let refused = proved(&c.ctx, &repo, "social.grain.gallery", RKEY)
        .await
        .unwrap_err();
    assert!(
        format!("{refused:#}").contains("not one: now"),
        "{refused:#}"
    );
    // Nor one that fails otherwise.
    let failing = Router::new().route(
        "/xrpc/com.atproto.sync.getRecord",
        get(|| async { StatusCode::INTERNAL_SERVER_ERROR }),
    );
    let repo = Repo {
        pds: pds_of(failing).await,
        ..c.repo().await
    };
    let refused = proved(&c.ctx, &repo, "social.grain.gallery", RKEY)
        .await
        .unwrap_err();
    assert!(format!("{refused:#}").contains("500"), "{refused:#}");
}

#[tokio::test]
async fn a_server_with_no_index_does_not_serve_it() {
    let s = common::served().await;
    let input = json!({"uris": ["at://did:plc:a/social.grain.gallery/3l3qo2vuowo2a"]});
    let (status, body) = s.post_as(PATH, "token", &input).await;
    assert_eq!(
        (status, body["error"].as_str()),
        (501, Some("MethodNotImplemented"))
    );
}
