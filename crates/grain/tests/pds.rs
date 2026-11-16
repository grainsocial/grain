//! The core against the reference PDS: identities resolved through its PLC
//! directory, app-password sessions kept and refreshed, service tokens it
//! signs checked against the account's key, and blobs put and fetched.

mod common;
use common::*;

use grain::identity::{self, NoSuchHandle};
use grain::session::{self, Session};
use grain::xrpc::{Auth, Xrpc, XrpcError};
use grain::{auth, crypto, keys};
use serde_json::{Value, json};

/// A 1x1 PNG, as a photo's smallest blob.
const PNG: &[u8] = &[
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0xf8, 0xcf, 0xc0, 0xf0,
    0x1f, 0x00, 0x05, 0x00, 0x01, 0xff, 0x89, 0x99, 0x3d, 0x1d, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
    0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
];

#[tokio::test]
async fn an_account_resolves_through_plc() {
    let a = account().await;
    let dir = tempfile::tempdir().unwrap();
    let ctx = ctx(dir.path(), &[]);

    let id = identity::resolve(&ctx, &a.handle).await.unwrap();
    assert_eq!(id.did, a.did);
    assert!(a.did.starts_with("did:plc:"), "{}", a.did);
    assert_eq!(id.pds, net().pds);
    // By DID, and again from the cache.
    let by_did = identity::resolve(&ctx, &a.did).await.unwrap();
    assert_eq!((by_did.did, by_did.pds), (a.did.clone(), net().pds.clone()));
    assert_eq!(identity::resolve(&ctx, &a.handle).await.unwrap().did, a.did);

    let doc = identity::document(&ctx, &a.did).await.unwrap();
    assert_eq!(doc["alsoKnownAs"][0], format!("at://{}", a.handle));
    assert_eq!(
        identity::service(&doc, "#atproto_pds"),
        Some(net().pds.clone())
    );
    identity::signing_key(&doc).unwrap();
    assert_eq!(
        identity::resolve_pds(&ctx, &a.did).await.unwrap(),
        net().pds
    );

    assert_eq!(
        identity::verified_handle(&ctx, &a.did).await.unwrap(),
        Some(a.handle.clone())
    );
    assert_eq!(identity::handle(&ctx, &a.did).await, Some(a.handle.clone()));
    let handles = identity::handles(&ctx, [a.did.as_str(), a.did.as_str()]).await;
    assert_eq!(handles.get(&a.did), Some(&a.handle));

    // A handle no one has is no one's, as the PDS answers.
    let nobody = format!("nobody-{}", fresh_handle());
    let why = identity::resolve(&ctx, &nobody).await.unwrap_err();
    assert!(why.downcast_ref::<NoSuchHandle>().is_some(), "{why:#}");
    // A DID the directory never heard of.
    let why = identity::resolve(&ctx, "did:plc:aaaaaaaaaaaaaaaaaaaaaaaa").await;
    assert!(why.is_err());
}

/// The account's own password, then an app password, as the apps log in.
async fn sessions(ctx: &grain::env::Ctx, a: &Account) -> (Session, Session) {
    let main = session::create(ctx, &a.handle, &a.password).await.unwrap();
    #[derive(serde::Deserialize)]
    struct Made {
        password: String,
    }
    let made: Made = Xrpc::new(ctx.http.clone(), &main.service)
        .procedure(
            "com.atproto.server.createAppPassword",
            Some(&json!({ "name": "grain-tests" })),
            Some(&main.auth()),
        )
        .await
        .unwrap();
    let app = session::create(ctx, &a.handle, &made.password)
        .await
        .unwrap();
    (main, app)
}

#[tokio::test]
async fn service_tokens_from_an_app_password() {
    let a = account().await;
    let dir = tempfile::tempdir().unwrap();
    let ctx = ctx(dir.path(), &[]);
    let (main, app) = sessions(&ctx, &a).await;
    assert_eq!(
        (main.did.as_str(), main.handle.as_str()),
        (a.did.as_str(), a.handle.as_str())
    );
    assert_eq!(app.did, a.did);
    assert_eq!(app.service, net().pds);
    assert!(matches!(app.auth(), Auth::Bearer(_)));
    assert!(!app.expiring());
    // The account's password is wrong for anyone else.
    let why = session::create(&ctx, &a.handle, "not-the-password")
        .await
        .unwrap_err();
    assert_eq!(XrpcError::of(&why).map(|e| e.status), Some(401), "{why:#}");

    let aud = "did:web:grain.test";
    let lxm = "social.grain.unspecced.getCameras";
    let token = auth::service_token(&ctx, &app, aud, lxm).await.unwrap();
    assert_eq!(auth::verify(&ctx, &token, aud, lxm).await.unwrap(), a.did);
    let (_, claims) = crypto::jwt_parts(&token).unwrap();
    assert_eq!(
        (claims["iss"].as_str(), claims["lxm"].as_str()),
        (Some(a.did.as_str()), Some(lxm))
    );
    // Held to the service and the method it names.
    assert!(
        auth::verify(&ctx, &token, "did:web:other.test", lxm)
            .await
            .is_err()
    );
    assert!(
        auth::verify(&ctx, &token, aud, "social.grain.other")
            .await
            .is_err()
    );

    let exp = keys::now_secs() + 600;
    let lasting = auth::lasting_token(&ctx, &main, aud, lxm, exp)
        .await
        .unwrap();
    let (_, claims) = crypto::jwt_parts(&lasting).unwrap();
    assert_eq!(claims["exp"], exp);
    assert_eq!(auth::verify(&ctx, &lasting, aud, lxm).await.unwrap(), a.did);
}

#[tokio::test]
async fn password_sessions_are_kept_refreshed_and_forgotten() {
    let a = account().await;
    let dir = tempfile::tempdir().unwrap();
    let ctx = ctx(
        dir.path(),
        &[
            ("GRAIN_IDENTIFIER", a.handle.as_str()),
            ("GRAIN_PASSWORD", a.password.as_str()),
        ],
    );
    // No session kept: the password logs in, and the session is kept.
    let first = session::me(&ctx).await.unwrap();
    assert_eq!(first.did, a.did);
    assert_eq!(session::load(&ctx, &a.did), Some(first.clone()));
    session::remember(&ctx, &first).unwrap();

    // An access token about to expire is refreshed with the refresh token.
    let id = identity::resolve(&ctx, &a.handle).await.unwrap();
    let stale = Session {
        access_jwt: "expired".into(),
        ..first.clone()
    };
    session::save(&ctx, &stale).unwrap();
    let fresh = session::ensure(&ctx, &id).await.unwrap();
    assert_ne!(fresh.refresh_jwt, first.refresh_jwt);
    assert!(!fresh.expiring());
    assert_eq!(session::load(&ctx, &a.did), Some(fresh.clone()));
    // The refreshed session lets calls in.
    let who: Value = Xrpc::new(ctx.http.clone(), &fresh.service)
        .query("com.atproto.server.getSession", &[], Some(&fresh.auth()))
        .await
        .unwrap();
    assert_eq!(who["did"], a.did);

    // A refresh token the PDS was told to forget, and no password: there
    // is no session to be had.
    let _: Value = Xrpc::new(ctx.http.clone(), &fresh.service)
        .procedure(
            "com.atproto.server.deleteSession",
            None,
            Some(&Auth::bearer(&fresh.refresh_jwt)),
        )
        .await
        .unwrap();
    let ended = Session {
        access_jwt: "expired".into(),
        ..fresh
    };
    session::save(&ctx, &ended).unwrap();
    let alone = common::ctx(dir.path(), &[("GRAIN_IDENTIFIER", a.handle.as_str())]);
    let why = session::ensure(&alone, &id).await.unwrap_err();
    assert!(why.to_string().contains("set GRAIN_PASSWORD"), "{why:#}");

    assert!(session::logout(&ctx, &a.handle).await.unwrap());
    assert!(session::load(&ctx, &a.did).is_none());
}

#[tokio::test]
async fn blobs_go_up_and_come_back() {
    let a = account().await;
    let dir = tempfile::tempdir().unwrap();
    let ctx = ctx(dir.path(), &[]);
    let me = session::create(&ctx, &a.handle, &a.password).await.unwrap();
    let pds = Xrpc::new(ctx.http.clone(), &me.service);

    let blob = pds
        .upload_blob(PNG.to_vec(), "image/png", &me.auth())
        .await
        .unwrap();
    assert_eq!(blob.kind, "blob");
    assert_eq!(blob.mime_type, "image/png");
    assert_eq!(blob.size, PNG.len() as u64);
    // Referenced by a record, as a photo's is, it is the account's to serve.
    let record = json!({
        "$type": "app.bsky.feed.post",
        "text": "",
        "createdAt": "2026-10-31T00:00:00.000Z",
        "embed": {
            "$type": "app.bsky.embed.images",
            "images": [{ "image": blob, "alt": "" }],
        },
    });
    let _: Value = pds
        .procedure(
            "com.atproto.repo.createRecord",
            Some(&json!({ "repo": me.did, "collection": "app.bsky.feed.post", "record": record })),
            Some(&me.auth()),
        )
        .await
        .unwrap();
    let back = pds.get_blob(&me.did, &blob.link.cid).await.unwrap();
    assert_eq!(back, PNG);

    // A blob it does not have is refused as XRPC refuses.
    let missing = "bafkreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    let why = pds.get_blob(&me.did, missing).await.unwrap_err();
    let status = XrpcError::of(&why).map(|e| e.status);
    assert!(status.is_some_and(|s| (400..500).contains(&s)), "{why:#}");
}
