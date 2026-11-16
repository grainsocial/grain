//! The devices an account's notifications are pushed to, registered as
//! the apps register them: with a service token from the account's own
//! PDS, the reference PDS. Every answer goes through `common`, so
//! `harness/answers.mjs` holds it to its lexicon.

#[path = "../../grain/tests/common/mod.rs"]
mod net;

mod common;

use grain::env::Ctx;
use grain::session::{self, Session};
use grain_serve::App;
use grain_serve::cdn::Cdn;
use grain_serve::index::Index;
use grain_serve::index::push::PushToken;
use serde_json::{Value, json};
use std::sync::Arc;

const AUD: &str = "did:web:grain.test";
const REGISTER: &str = "/xrpc/social.grain.notification.registerPush";
const UNREGISTER: &str = "/xrpc/social.grain.notification.unregisterPush";

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
        ctx: net::ctx(&dir.path().join("serve"), &[]),
        index: Some(index.clone()),
        did: Some(AUD.into()),
        cdn: Cdn::default(),
        bsky_appview: None,
        web: None,
        admins: Vec::new(),
        cards: Default::default(),
        pages: None,
        spaces: Default::default(),
    })
    .await;
    let account = net::account().await;
    let me = session::create(&ctx, &account.did, &account.password)
        .await
        .unwrap();
    World {
        ctx,
        me,
        index,
        served,
        _dir: dir,
    }
}

/// A device, as the apps name it.
fn device(token: &str, platform: &str) -> Value {
    json!({"serviceDid": AUD, "token": token, "platform": platform, "appId": "social.grain"})
}

fn kept(token: &str, platform: &str) -> PushToken {
    PushToken {
        token: token.into(),
        platform: platform.into(),
    }
}

impl World {
    /// `path`, a procedure, called with a service token for its method.
    async fn post_as(&self, path: &str, body: &Value) -> (u16, Value) {
        let nsid = &path["/xrpc/".len()..];
        let token = grain::auth::service_token(&self.ctx, &self.me, AUD, nsid)
            .await
            .unwrap();
        self.served.post_as(path, &token, body).await
    }

    fn tokens(&self) -> Vec<PushToken> {
        self.index.push_tokens(&self.me.did).unwrap()
    }
}

#[tokio::test]
async fn a_device_is_registered_and_unregistered() {
    let w = world().await;
    let ok = (200, json!({}));
    assert_eq!(w.post_as(REGISTER, &device("aa11", "ios")).await, ok);
    assert_eq!(w.post_as(REGISTER, &device("fcm-1", "android")).await, ok);
    // Again, as the apps register on every launch: kept once.
    assert_eq!(w.post_as(REGISTER, &device("aa11", "ios")).await, ok);
    assert_eq!(w.tokens(), [kept("aa11", "ios"), kept("fcm-1", "android")]);

    assert_eq!(w.post_as(UNREGISTER, &device("aa11", "ios")).await, ok);
    assert_eq!(w.tokens(), [kept("fcm-1", "android")]);
    // One it never registered, or no longer has, is no failure.
    assert_eq!(w.post_as(UNREGISTER, &device("aa11", "ios")).await, ok);
    // Another account's device is not the caller's to unregister.
    w.index
        .register_push("did:plc:other", "web-1", "web", "2026-01-01T00:00:00.000Z")
        .unwrap();
    assert_eq!(w.post_as(UNREGISTER, &device("web-1", "web")).await, ok);
    let other = w.index.push_tokens("did:plc:other").unwrap();
    assert_eq!(other, [kept("web-1", "web")]);
}

#[tokio::test]
async fn a_device_is_named_in_full_by_an_account() {
    let w = world().await;
    for path in [REGISTER, UNREGISTER] {
        let (status, body) = w.served.post(path, &device("aa11", "ios")).await;
        assert_eq!(
            (status, body["error"].as_str()),
            (401, Some("AuthenticationRequired")),
            "{path}"
        );
    }
    let too_long = "a".repeat(grain_serve::push::MOST_TOKEN_BYTES + 1);
    let mut elsewhere = device("aa11", "ios");
    elsewhere["serviceDid"] = "did:web:api.bsky.app".into();
    for wrong in [
        json!({}),
        json!({"token": "aa11", "platform": "ios", "appId": "social.grain"}),
        elsewhere,
        device("aa11", "windows"),
        device("", "ios"),
        device(&too_long, "ios"),
    ] {
        for path in [REGISTER, UNREGISTER] {
            let (status, body) = w.post_as(path, &wrong).await;
            assert_eq!(
                (status, body["error"].as_str()),
                (400, Some("InvalidRequest")),
                "{path} {wrong}"
            );
        }
    }
    assert_eq!(w.tokens(), []);
    // A server with no index keeps no devices.
    let bare = common::served().await;
    let (status, body) = bare.post(REGISTER, &device("aa11", "ios")).await;
    assert_eq!(
        (status, body["error"].as_str()),
        (501, Some("MethodNotImplemented"))
    );
}
