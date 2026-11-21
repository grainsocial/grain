//! A group on the spaces alpha, run by a stand-in group host: an account
//! on the reference PDS that declared itself a group and made its members
//! space and its pool there, whose DID document then names the stand-in as
//! its PDS. The stand-in serves `fyi.opensocial.*` as opensocial's host
//! does, from its own `/.well-known/did.json`, and passes every other
//! request through to the reference PDS, so the group's spaces answer at
//! the address its DID document gives, as a group host's do.
//!
//! [`Starter`] is a stand-in for a group host that founds groups for
//! grain: it makes each group an account on the reference PDS whose DID
//! document names the stand-in, and, as the group's authorization server,
//! hands grain a session as it, a token of its own that it trades for the
//! group's session at the reference PDS on the way through.
#![allow(dead_code)]

use crate::net;
use axum::body::{Body, Bytes};
use axum::extract::State;
use axum::http::{HeaderMap, Method, StatusCode, Uri};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use grain::crypto::P256Key;
use grain::session::Session;
use grain::space::{self, Admin};
use grain::xrpc::Xrpc;
use serde_json::{Value, json};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

pub struct Group {
    pub did: String,
    pub handle: String,
    pub password: String,
    /// The group's own session, at the reference PDS.
    pub session: Session,
    /// The stand-in's URL and DID.
    pub host: String,
    pub host_did: String,
    /// Whether the host lets in whoever asks, or keeps them pending.
    pub open: Arc<Mutex<bool>>,
    /// What the host was asked, by method, and by whom.
    pub asked: Arc<Mutex<Vec<(String, String)>>>,
}

struct Standing {
    pds: String,
    did: String,
    host_did: String,
    ctx: grain::env::Ctx,
    session: Session,
    open: Arc<Mutex<bool>>,
    asked: Arc<Mutex<Vec<(String, String)>>>,
    http: reqwest::Client,
}

/// The account a service token says sent it, unchecked: the stand-in
/// trusts whoever calls it.
fn issuer(headers: &HeaderMap) -> String {
    let token = headers["authorization"].to_str().unwrap();
    let token = token.strip_prefix("Bearer ").unwrap();
    let claims = token.split('.').nth(1).unwrap();
    let claims: Value = serde_json::from_slice(&URL_SAFE_NO_PAD.decode(claims).unwrap()).unwrap();
    claims["iss"].as_str().unwrap().to_string()
}

async fn well_known(State(s): State<Arc<Standing>>) -> Json<Value> {
    Json(json!({ "id": s.host_did }))
}

async fn list_groups(State(s): State<Arc<Standing>>) -> Json<Value> {
    Json(json!({ "groups": [{
        "did": s.did,
        "displayName": "Film club",
        "description": "We shoot film.",
        "url": "https://film.example",
        "joinPolicy": "fyi.opensocial.defs#open",
        "avatar": "bafkreiavatarcidbafkreiavatarcid",
        "rules": [{ "rkey": "1", "title": "Be kind", "text": "Always." }, { "title": "untitled" }],
    }]}))
}

async fn request_join(State(s): State<Arc<Standing>>, headers: HeaderMap) -> Json<Value> {
    let who = issuer(&headers);
    s.asked
        .lock()
        .unwrap()
        .push(("requestJoin".into(), who.clone()));
    if !*s.open.lock().unwrap() {
        return Json(json!({ "status": "pending" }));
    }
    let admin = Admin {
        ctx: &s.ctx,
        session: &s.session,
    };
    admin
        .put_member(&space::members(&s.did), &who, false)
        .await
        .unwrap();
    admin
        .put_member(&space::pool(&s.did), &who, true)
        .await
        .unwrap();
    Json(json!({ "status": "admitted" }))
}

async fn leave_group(State(s): State<Arc<Standing>>, headers: HeaderMap) -> Response {
    let who = issuer(&headers);
    let left = ("leaveGroup".to_string(), who.clone());
    let again = {
        let mut asked = s.asked.lock().unwrap();
        let again = asked.contains(&left);
        asked.push(left);
        again
    };
    if again {
        let said = json!({ "error": "NotAMember", "message": "already left" });
        return (StatusCode::BAD_REQUEST, Json(said)).into_response();
    }
    let pds = Xrpc::new(s.ctx.http.clone(), &s.session.service);
    for space in [space::members(&s.did), space::pool(&s.did)] {
        let body = json!({ "space": space, "did": who });
        let removed: anyhow::Result<Value> = pds
            .procedure(
                "com.atproto.memberspace.removeMember",
                Some(&body),
                Some(&s.session.auth()),
            )
            .await;
        removed.unwrap();
    }
    Json(json!({})).into_response()
}

/// Anything else, as the reference PDS answers it.
async fn through(
    State(s): State<Arc<Standing>>,
    method: Method,
    uri: Uri,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    forward(&s.http, &s.pds, method, uri, headers, body).await
}

/// The request, as the reference PDS at `pds` answers it.
async fn forward(
    http: &reqwest::Client,
    pds: &str,
    method: Method,
    uri: Uri,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let path = uri.path_and_query().map(|p| p.as_str()).unwrap_or("/");
    let mut req = http.request(method, format!("{pds}{path}")).body(body);
    for (k, v) in &headers {
        if k != "host" && k != "content-length" {
            req = req.header(k, v);
        }
    }
    let res = req.send().await.unwrap();
    let mut out = Response::builder().status(res.status());
    for (k, v) in res.headers() {
        if k != "content-length" && k != "transfer-encoding" {
            out = out.header(k, v);
        }
    }
    out.body(Body::from(res.bytes().await.unwrap())).unwrap()
}

/// Signs the PLC operation `op` with `key`.
fn signed(mut op: Value, key: &P256Key) -> Value {
    op.as_object_mut().unwrap().remove("sig");
    let unsigned = atproto::drisl::Value::from_json(&op).unwrap();
    let sig = key.sign(&atproto::drisl::encode(&unsigned));
    op["sig"] = URL_SAFE_NO_PAD.encode(sig).into();
    op
}

/// Has `did`'s DID document name `host` as its PDS, by the recovery key
/// `key` the account was made with.
async fn move_to(did: &str, key: &P256Key, host: &str) {
    let net = net::net();
    let http = reqwest::Client::new();
    let audit: Value = http
        .get(format!("{}/{did}/log/audit", net.plc))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    let last = audit.as_array().unwrap().last().unwrap();
    let mut op = last["operation"].clone();
    op["services"]["atproto_pds"]["endpoint"] = host.into();
    op["prev"] = last["cid"].clone();
    let res = http
        .post(format!("{}/{did}", net.plc))
        .json(&signed(op, key))
        .send()
        .await
        .unwrap();
    assert!(res.status().is_success(), "{}", res.text().await.unwrap());
}

/// An account made on the reference PDS with a recovery key of the
/// test's, and its session there.
async fn made(dir: &std::path::Path, handle: &str, key: &P256Key) -> (String, Session) {
    let net = net::net();
    let password = format!("{handle}-password");
    let made: Value = reqwest::Client::new()
        .post(format!("{}/xrpc/com.atproto.server.createAccount", net.pds))
        .json(&json!({
            "email": format!("{handle}@test.com"),
            "handle": handle,
            "password": password,
            "recoveryKey": key.public().did_key(),
        }))
        .send()
        .await
        .unwrap()
        .error_for_status()
        .unwrap()
        .json()
        .await
        .unwrap();
    let ctx = net::ctx(dir, &[]);
    let session = grain::session::create(&ctx, handle, &password)
        .await
        .unwrap();
    (made["did"].as_str().unwrap().to_string(), session)
}

impl Group {
    /// A new group, letting in whoever asks.
    pub async fn new(site_ctx: &grain::env::Ctx, dir: &std::path::Path) -> Group {
        let net = net::net();
        let key = P256Key::generate();
        let handle = net::fresh_handle();
        let password = format!("{handle}-password");
        let (did, session) = made(dir, &handle, &key).await;
        let ctx = net::ctx(dir, &[]);
        let admin = Admin {
            ctx: &ctx,
            session: &session,
        };
        admin.create(space::MEMBERS, "self").await.unwrap();
        admin.create(space::POOL, "self").await.unwrap();

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let host = format!("http://127.0.0.1:{port}");
        let host_did = format!("did:web:groups{port}.test");
        let open = Arc::new(Mutex::new(true));
        let asked = Arc::new(Mutex::new(Vec::new()));
        let standing = Arc::new(Standing {
            pds: net.pds.trim_end_matches('/').to_string(),
            did: did.clone(),
            host_did: host_did.clone(),
            ctx: ctx.clone(),
            session: session.clone(),
            open: open.clone(),
            asked: asked.clone(),
            http: reqwest::Client::new(),
        });
        let router = Router::new()
            .route("/.well-known/did.json", get(well_known))
            .route("/xrpc/fyi.opensocial.listGroups", get(list_groups))
            .route("/xrpc/fyi.opensocial.requestJoin", post(request_join))
            .route("/xrpc/fyi.opensocial.leaveGroup", post(leave_group))
            .fallback(through)
            .with_state(standing);
        tokio::spawn(async move { axum::serve(listener, router).await });

        move_to(&did, &key, &host).await;
        grain::identity::forget(site_ctx, &did);
        Group {
            did,
            handle,
            password,
            session,
            host,
            host_did,
            open,
            asked,
        }
    }

    /// A service token of the group's, for `aud` and `lxm`: to call grain
    /// as the group.
    pub async fn token(&self, ctx: &grain::env::Ctx, aud: &str, lxm: &str) -> String {
        grain::auth::service_token(ctx, &self.session, aud, lxm)
            .await
            .unwrap()
    }
}

/// What the stand-in that founds groups was asked, and keeps.
struct Founding {
    pds: String,
    url: String,
    did: String,
    /// The site's: where a group's declaration arrives, as Jetstream
    /// would bring it, and whose identities are forgotten as they move.
    site: grain::env::Ctx,
    index: Arc<grain_serve::index::Index>,
    dir: std::path::PathBuf,
    asked: Arc<Mutex<Vec<(String, String)>>>,
    /// What `provisionGroup` was sent last.
    sent: Arc<Mutex<Value>>,
    /// Each group's session at the reference PDS, by the token handed to
    /// grain for it, and by its DID.
    tokens: Mutex<HashMap<String, Session>>,
    /// The `jti`s of the client assertions it was sent.
    seen: Mutex<Vec<String>>,
}

pub struct Starter {
    pub url: String,
    pub did: String,
    /// What the host was asked, by method, and by whom.
    pub asked: Arc<Mutex<Vec<(String, String)>>>,
    /// The input `provisionGroup` was sent last.
    pub sent: Arc<Mutex<Value>>,
    _dir: tempfile::TempDir,
}

/// The nonce the stand-in wants in a DPoP proof.
const NONCE: &str = "standin-nonce";

/// The claims of a JWT, unchecked.
fn claims(jwt: &str) -> Value {
    let part = jwt.split('.').nth(1).unwrap_or_default();
    let bytes = URL_SAFE_NO_PAD.decode(part).unwrap_or_default();
    serde_json::from_slice(&bytes).unwrap_or(Value::Null)
}

fn refuse(error: &str) -> Response {
    let said = json!({ "error": error, "message": format!("the stand-in says {error}") });
    (StatusCode::BAD_REQUEST, Json(said)).into_response()
}

async fn host_did(State(s): State<Arc<Founding>>) -> Json<Value> {
    Json(json!({ "id": s.did }))
}

async fn describe(State(s): State<Arc<Founding>>) -> Json<Value> {
    Json(json!({ "did": s.did, "availableUserDomains": [".test"] }))
}

async fn resource(State(s): State<Arc<Founding>>) -> Json<Value> {
    Json(json!({ "resource": s.url, "authorization_servers": [s.url] }))
}

async fn authorization(State(s): State<Arc<Founding>>) -> Json<Value> {
    Json(json!({
        "issuer": s.url,
        "authorization_endpoint": format!("{}/oauth/authorize", s.url),
        "token_endpoint": format!("{}/oauth/token", s.url),
        "pushed_authorization_request_endpoint": format!("{}/oauth/par", s.url),
    }))
}

/// Founds a group named by the input's `handle`, its founder whoever the
/// service token says sent it, as a group host does: unless the handle
/// begins `taken`, which it refuses; for one beginning `stolen` it hands
/// over the founder's own account instead, which it does not log in. A
/// client assertion it was sent before is refused, as a replay.
async fn provision(
    State(s): State<Arc<Founding>>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    let assertion = body["client_assertion"].as_str().unwrap_or_default();
    let jti = claims(assertion)["jti"]
        .as_str()
        .unwrap_or_default()
        .to_string();
    let replayed = {
        let mut seen = s.seen.lock().unwrap();
        let again = jti.is_empty() || seen.contains(&jti);
        seen.push(jti);
        again
    };
    if replayed {
        return refuse("invalid_client");
    }
    let proof = headers.get("dpop").and_then(|v| v.to_str().ok());
    if claims(proof.unwrap_or_default())["nonce"] != NONCE {
        let said = json!({ "error": "use_dpop_nonce", "message": "a nonce" });
        let mut res = (StatusCode::BAD_REQUEST, Json(said)).into_response();
        res.headers_mut()
            .insert("dpop-nonce", NONCE.parse().unwrap());
        return res;
    }
    let founder = issuer(&headers);
    let asked = ("provisionGroup".to_string(), founder.clone());
    s.asked.lock().unwrap().push(asked);
    *s.sent.lock().unwrap() = body.clone();
    let handle = body["handle"].as_str().unwrap().to_string();
    if handle.starts_with("taken") {
        return refuse("HandleNotAvailable");
    }
    let handed = |sub: &str, token: &str| {
        Json(json!({ "session": {
            "access_token": token,
            "refresh_token": format!("{token}-refresh"),
            "token_type": "DPoP",
            "expires_in": 3600,
            "scope": body["scope"],
            "sub": sub,
        }}))
        .into_response()
    };
    if handle.starts_with("stolen") {
        // The token response as the whole answer, as a host may give it.
        let whole = json!({
            "access_token": "standin-stolen",
            "token_type": "DPoP",
            "expires_in": 3600,
            "sub": founder,
        });
        return Json(whole).into_response();
    }
    let key = P256Key::generate();
    let (did, session) = made(&s.dir, &handle, &key).await;
    let admin = Admin {
        ctx: &net::ctx(&s.dir, &[]),
        session: &session,
    };
    admin.create(space::MEMBERS, "self").await.unwrap();
    admin
        .put_member(&space::members(&did), &founder, false)
        .await
        .unwrap();
    move_to(&did, &key, &s.url).await;
    grain::identity::forget(&s.site, &did);
    let declared = json!({
        "$type": "fyi.opensocial.declaration",
        "meta": format!("at://{did}/space/fyi.opensocial.meta/self"),
        "createdAt": "2026-10-31T12:00:00.000Z",
    });
    let uri = format!("at://{did}/fyi.opensocial.declaration/self");
    let cid = "bafyreie5737gdxlw5i64vzichcalba3z2v5n6icifvx5xytvske7mr3hpm";
    // A moment after the host answers, as Jetstream brings it.
    let index = s.index.clone();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        index.put(&uri, cid, &declared).unwrap();
    });
    let token = format!("standin-{did}");
    let mut tokens = s.tokens.lock().unwrap();
    tokens.insert(token.clone(), session.clone());
    tokens.insert(did.clone(), session);
    drop(tokens);
    handed(&did, &token)
}

/// Opens a group's space for whoever the service token says sent it,
/// letting them write there: unless the group's handle begins `nopool`.
async fn create_space(
    State(s): State<Arc<Founding>>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    let who = issuer(&headers);
    s.asked
        .lock()
        .unwrap()
        .push(("createSpace".into(), who.clone()));
    let group = body["group"].as_str().unwrap_or_default();
    let session = s.tokens.lock().unwrap().get(group).cloned();
    let Some(session) = session.filter(|g| !g.handle.starts_with("nopool")) else {
        return refuse("InvalidRequest");
    };
    let kind = body["type"].as_str().unwrap();
    let admin = Admin {
        ctx: &net::ctx(&s.dir, &[]),
        session: &session,
    };
    let uri = admin.create(kind, "self").await.unwrap();
    let space = format!("at://{group}/space/{kind}/self");
    admin.put_member(&space, &who, true).await.unwrap();
    Json(json!({ "uri": uri })).into_response()
}

/// Anything else, as the reference PDS answers it, a token the stand-in
/// handed over traded for its group's session there.
async fn founded(
    State(s): State<Arc<Founding>>,
    method: Method,
    uri: Uri,
    mut headers: HeaderMap,
    body: Bytes,
) -> Response {
    let said = headers.get("authorization").and_then(|v| v.to_str().ok());
    let token = said.and_then(|a| a.strip_prefix("DPoP "));
    let session = token.and_then(|t| s.tokens.lock().unwrap().get(t).cloned());
    if let Some(session) = session {
        let bearer = format!("Bearer {}", session.access_jwt);
        headers.insert("authorization", bearer.parse().unwrap());
        headers.remove("dpop");
    }
    forward(&reqwest::Client::new(), &s.pds, method, uri, headers, body).await
}

impl Starter {
    /// Where a stand-in will listen, for the site to be told before it
    /// starts.
    pub async fn bind() -> (tokio::net::TcpListener, String) {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://127.0.0.1:{}", listener.local_addr().unwrap().port());
        (listener, url)
    }

    /// The stand-in, on `listener`, founding groups whose declarations
    /// arrive in `index`, the site's, whose identities `site` resolves.
    pub fn serve(
        listener: tokio::net::TcpListener,
        site: &grain::env::Ctx,
        index: Arc<grain_serve::index::Index>,
    ) -> Starter {
        let port = listener.local_addr().unwrap().port();
        let url = format!("http://127.0.0.1:{port}");
        let did = format!("did:web:starter{port}.test");
        let dir = tempfile::tempdir().unwrap();
        let asked = Arc::new(Mutex::new(Vec::new()));
        let sent = Arc::new(Mutex::new(Value::Null));
        let founding = Arc::new(Founding {
            pds: net::net().pds.trim_end_matches('/').to_string(),
            url: url.clone(),
            did: did.clone(),
            site: site.clone(),
            index,
            dir: dir.path().to_path_buf(),
            asked: asked.clone(),
            sent: sent.clone(),
            tokens: Mutex::new(HashMap::new()),
            seen: Mutex::new(Vec::new()),
        });
        let router = Router::new()
            .route("/.well-known/did.json", get(host_did))
            .route("/.well-known/oauth-protected-resource", get(resource))
            .route(
                "/.well-known/oauth-authorization-server",
                get(authorization),
            )
            .route("/xrpc/com.atproto.server.describeServer", get(describe))
            .route("/xrpc/fyi.opensocial.provisionGroup", post(provision))
            .route("/xrpc/fyi.opensocial.createSpace", post(create_space))
            .fallback(founded)
            .with_state(founding);
        tokio::spawn(async move { axum::serve(listener, router).await });
        Starter {
            url,
            did,
            asked,
            sent,
            _dir: dir,
        }
    }
}
