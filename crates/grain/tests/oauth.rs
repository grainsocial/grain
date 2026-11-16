//! Logging in with OAuth against the reference PDS's authorization server,
//! with `harness/authorize.mjs` as the user's browser: the command line's
//! loopback client, and a confidential client, as grain-serve is, behind
//! `harness/tls-proxy.mjs`. Each pushes its request (PAR), redeems the code,
//! calls the PDS with DPoP proofs under the nonces it hands out, refreshes
//! and revokes.

mod common;
use common::*;

use axum::Router;
use axum::extract::Query;
use axum::routing::get;
use grain::crypto::P256Key;
use grain::env::Ctx;
use grain::oauth::{self, Client};
use grain::session::{self, Session};
use grain::xrpc::{Auth, Xrpc};
use grain::{identity, keys};
use serde_json::{Value, json};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// A 1x1 PNG.
const PNG: &[u8] = &[
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0xf8, 0xcf, 0xc0, 0xf0,
    0x1f, 0x00, 0x05, 0x00, 0x01, 0xff, 0x89, 0x99, 0x3d, 0x1d, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
    0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
];

/// Creates a record of `collection` in `me`'s repo.
async fn create(ctx: &Ctx, me: &Session, collection: &str, record: Value) -> anyhow::Result<Value> {
    Xrpc::new(ctx.http.clone(), &me.service)
        .procedure(
            "com.atproto.repo.createRecord",
            Some(&json!({ "repo": me.did, "collection": collection, "record": record })),
            Some(&me.auth()),
        )
        .await
}

fn post() -> Value {
    json!({ "$type": "app.bsky.feed.post", "text": "from grain", "createdAt": "2026-10-31T00:00:00.000Z" })
}

/// What an OAuth session may do, and what its scope keeps it from: the
/// post grain cross-posts goes through, a like does not; a picture goes up,
/// a text file does not. Each call carries a DPoP proof, sent again with
/// the nonce the PDS asks for.
async fn scoped(ctx: &Ctx, me: &Session) {
    assert!(matches!(me.auth(), Auth::Dpop { .. }));
    create(ctx, me, "app.bsky.feed.post", post()).await.unwrap();
    let like = json!({
        "$type": "app.bsky.feed.like",
        "subject": { "uri": format!("at://{}/app.bsky.feed.post/3aaaaaaaaaaaa", me.did), "cid": "bafyreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
        "createdAt": "2026-10-31T00:00:00.000Z",
    });
    let why = create(ctx, me, "app.bsky.feed.like", like)
        .await
        .unwrap_err();
    assert!(oauth::out_of_scope(&why), "{why:#}");

    let pds = Xrpc::new(ctx.http.clone(), &me.service);
    let blob = pds
        .upload_blob(PNG.to_vec(), "image/png", &me.auth())
        .await
        .unwrap();
    assert_eq!(blob.mime_type, "image/png");
    let why = pds
        .upload_blob(b"words".to_vec(), "text/plain", &me.auth())
        .await
        .unwrap_err();
    assert!(oauth::out_of_scope(&why), "{why:#}");
}

#[tokio::test]
async fn a_command_line_login_refreshes_and_logs_out() {
    let a = account().await;
    let dir = tempfile::tempdir().unwrap();
    let browser = browser(&a, "");
    let ctx = ctx(dir.path(), &[("GRAIN_BROWSER", browser.as_str())]);

    let pending = oauth::start(&ctx, &format!("@{}", a.handle)).await.unwrap();
    assert!(pending.redirect_uri.starts_with("http://127.0.0.1:"));
    oauth::open(&ctx, &pending.url);
    let first = pending.finish(&ctx).await.unwrap();
    assert_eq!(
        (first.did.as_str(), first.handle.as_str()),
        (a.did.as_str(), a.handle.as_str())
    );
    let o = first.oauth.clone().unwrap();
    assert_eq!(o.loopback_id, Some(oauth::client_id()));
    assert_eq!(o.client_id, None);
    assert!(o.expires_at > keys::now_secs());
    assert!(!oauth::behind(&first, &oauth::loopback_scope()));
    assert_eq!(session::load(&ctx, &a.did), Some(first.clone()));
    scoped(&ctx, &first).await;

    // About to expire, it is refreshed in place, under the client it was
    // granted to.
    let mut expiring = first.clone();
    expiring.oauth.as_mut().unwrap().expires_at = 0;
    session::save(&ctx, &expiring).unwrap();
    let id = identity::resolve(&ctx, &a.handle).await.unwrap();
    let fresh = session::ensure(&ctx, &id).await.unwrap();
    assert_ne!(fresh.refresh_jwt, first.refresh_jwt);
    assert_ne!(fresh.access_jwt, first.access_jwt);
    create(&ctx, &fresh, "app.bsky.feed.post", post())
        .await
        .unwrap();
    // The refresh token it held is spent.
    let client = Client::granted(&o).unwrap();
    assert!(oauth::refresh(&ctx, &client, &first, &o).await.is_err());

    // Logging out revokes the tokens: put back, they no longer refresh.
    assert!(session::logout(&ctx, &a.handle).await.unwrap());
    let mut revoked = fresh;
    revoked.oauth.as_mut().unwrap().expires_at = 0;
    session::save(&ctx, &revoked).unwrap();
    let why = session::ensure(&ctx, &id).await.unwrap_err();
    assert!(why.to_string().contains("set GRAIN_PASSWORD"), "{why:#}");
}

#[tokio::test]
async fn a_refused_login_says_so() {
    let a = account().await;
    let dir = tempfile::tempdir().unwrap();
    let ctx = ctx(dir.path(), &[]);
    let pending = oauth::start(&ctx, &a.handle).await.unwrap();
    let url = pending.url.clone();
    let (finished, ()) = tokio::join!(pending.finish(&ctx), approve(&a, "--reject", &url));
    let why = finished.unwrap_err();
    assert!(why.to_string().contains("the login was refused"), "{why:#}");
    assert!(session::load(&ctx, &a.did).is_none());
}

/// A confidential client at the harness's client hostname, which serves
/// its metadata document and keeps the query the browser comes back with.
struct Confidential {
    client: Client,
    redirect_uri: String,
    back: Arc<Mutex<Option<HashMap<String, String>>>>,
    _proxy: TlsProxy,
}

async fn confidential() -> Confidential {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let proxy = tls_proxy(listener.local_addr().unwrap().port());
    let id = format!("{}/oauth-client-metadata.json", proxy.url);
    let redirect_uri = format!("{}/callback", proxy.url);
    let client = Client::confidential(&id, P256Key::generate());
    let metadata = client.metadata("grain tests", &[&redirect_uri], oauth::SCOPE);
    let back = Arc::new(Mutex::new(None));
    let kept = back.clone();
    let app = Router::new()
        .route(
            "/oauth-client-metadata.json",
            get(move || async move { axum::Json(metadata) }),
        )
        .route(
            "/callback",
            get(move |Query(q): Query<HashMap<String, String>>| async move {
                *kept.lock().unwrap() = Some(q);
                "back"
            }),
        );
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    Confidential {
        client,
        redirect_uri,
        back,
        _proxy: proxy,
    }
}

impl Confidential {
    fn came_back(&self) -> HashMap<String, String> {
        self.back
            .lock()
            .unwrap()
            .take()
            .expect("the browser came back")
    }
}

#[tokio::test]
async fn a_confidential_client_logs_in_refreshes_and_revokes() {
    let a = account().await;
    let dir = tempfile::tempdir().unwrap();
    let ctx = ctx(dir.path(), &[]);
    let c = confidential().await;

    let id = identity::resolve(&ctx, &a.handle).await.unwrap();
    let request = oauth::authorize(
        &ctx,
        &c.client,
        id,
        &a.handle,
        &c.redirect_uri,
        oauth::SCOPE,
    )
    .await
    .unwrap();
    approve(&a, "", &request.url).await;
    let params = c.came_back();
    let session = request.redeem(&ctx, &c.client, &params).await.unwrap();
    assert_eq!(session.did, a.did);
    assert_eq!(session.handle, "");
    let session = oauth::named(&ctx, session).await.unwrap();
    assert_eq!(session.handle, a.handle);
    let o = session.oauth.clone().unwrap();
    assert_eq!(o.client_id.as_deref(), Some(c.client.id.as_str()));
    assert_eq!(o.loopback_id, None);
    // Only the client that holds the key refreshes it.
    assert!(Client::granted(&o).is_err());
    scoped(&ctx, &session).await;

    let fresh = oauth::refresh(&ctx, &c.client, &session, &o).await.unwrap();
    assert_ne!(fresh.refresh_jwt, session.refresh_jwt);
    create(&ctx, &fresh, "app.bsky.feed.post", post())
        .await
        .unwrap();

    let fo = fresh.oauth.clone().unwrap();
    oauth::revoke(&ctx, &c.client, &fresh, &fo).await.unwrap();
    assert!(oauth::refresh(&ctx, &c.client, &fresh, &fo).await.is_err());
}

#[tokio::test]
async fn an_account_made_at_sign_up_logs_in() {
    let dir = tempfile::tempdir().unwrap();
    let ctx = ctx(dir.path(), &[]);
    let c = confidential().await;
    let handle = fresh_handle();
    let newcomer = Account {
        password: format!("{handle}-password"),
        handle,
        did: String::new(),
    };

    let request = oauth::sign_up(&ctx, &c.client, &net().pds, &c.redirect_uri, oauth::SCOPE)
        .await
        .unwrap();
    approve(&newcomer, "--create", &request.url).await;
    let params = c.came_back();
    let session = request.redeem(&ctx, &c.client, &params).await.unwrap();
    let session = oauth::named(&ctx, session).await.unwrap();
    assert_eq!(session.handle, newcomer.handle);
    assert_eq!(
        identity::resolve(&ctx, &newcomer.handle).await.unwrap().did,
        session.did
    );
}
