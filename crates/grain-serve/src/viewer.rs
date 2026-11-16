//! Who is asking: the account a query answers for, whose follows, mutes,
//! blocks and favorites fill its views' `viewer` fields.
//!
//! The apps and the command line say who they are with a service token
//! from their own PDS, for grain-serve's DID and the method called, sent
//! direct or through their PDS's `atproto-proxy`. The web says it with
//! the session cookie its login set ([`crate::login`]), when it sends no
//! token. Each way of saying it is one arm of [`viewer`], and nothing past
//! it asks how the viewer was known.
//!
//! What a query answers depends on who asks, so each answer says so to
//! caches ([`answers`]): every one varies by `authorization` and `cookie`,
//! one with an asker is theirs alone to keep (`private, no-cache`), and one
//! that read what is theirs alone is kept by no cache at all (`private,
//! no-store`, [`unshared`]).

use crate::App;
use crate::xrpc::Failure;
use axum::extract::Request;
use axum::http::{HeaderMap, HeaderValue, Method, StatusCode, header};
use axum::middleware::Next;
use axum::response::Response;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};

/// Who the query being answered found asking, and whether it read what is
/// theirs alone.
#[derive(Default)]
struct Asked {
    viewer: Mutex<Option<String>>,
    unshared: AtomicBool,
}

tokio::task_local! {
    static ASKED: Asked;
}

/// The account calling `lxm`, from `headers`; none for a caller who
/// says nothing, or whose cookie no longer holds, whom the queries answer
/// as anyone. One whose token does not hold is refused, as Bluesky's
/// appview refuses them, rather than answered as no one.
pub async fn viewer(app: &App, headers: &HeaderMap, lxm: &str) -> Result<Option<String>, Failure> {
    let Some(value) = headers.get(header::AUTHORIZATION) else {
        return Ok(asked(crate::login::viewer(app, headers)));
    };
    let refused = |why: String| Failure::new(StatusCode::UNAUTHORIZED, "InvalidToken", why);
    let token = value.to_str().ok().and_then(|v| v.strip_prefix("Bearer "));
    let token = token.ok_or_else(|| refused("authorization is a Bearer service token".into()))?;
    let Some(aud) = &app.did else {
        return Err(refused(
            "this server has no DID to take service tokens for".into(),
        ));
    };
    let did = grain::auth::verify(&app.ctx, token, aud, lxm).await;
    did.map(|did| asked(Some(did)))
        .map_err(|e| refused(format!("{e:#}")))
}

/// `did`, kept as who asks the query being answered, if it is someone.
fn asked(did: Option<String>) -> Option<String> {
    if let Some(did) = &did {
        let _ = ASKED.try_with(|a| *a.viewer.lock().unwrap() = Some(did.clone()));
    }
    did
}

/// Marks the query being answered as reading what is its asker's alone,
/// for no cache to keep.
pub fn unshared() {
    let _ = ASKED.try_with(|a| a.unshared.store(true, Ordering::Relaxed));
}

/// The answer to `req`, and, for a query, what caches may do with it: it
/// varies by `authorization` and `cookie` always; it is for anyone's cache
/// if no one asks, the asker's alone if someone does, and no cache's at all
/// if it read what is theirs alone ([`unshared`]).
pub async fn answers(req: Request, next: Next) -> Response {
    let query = req.method() == Method::GET && req.uri().path().starts_with("/xrpc/");
    if !query {
        return next.run(req).await;
    }
    let (res, asked) = ASKED
        .scope(Asked::default(), async {
            let res = next.run(req).await;
            let asker = ASKED.with(|a| a.viewer.lock().unwrap().is_some());
            let unshared = ASKED.with(|a| a.unshared.load(Ordering::Relaxed));
            (res, (asker, unshared))
        })
        .await;
    cached(res, asked)
}

/// `res` as a query's answer, with an asker or none, that read what is
/// theirs alone or not.
fn cached(mut res: Response, (asker, unshared): (bool, bool)) -> Response {
    let cache = match (asker, unshared) {
        (false, false) => None,
        (true, false) => Some("private, no-cache"),
        (_, true) => Some("private, no-store"),
    };
    let headers = res.headers_mut();
    headers.append(header::VARY, HeaderValue::from_static("authorization"));
    headers.append(header::VARY, HeaderValue::from_static("cookie"));
    if let Some(cache) = cache {
        headers.insert(header::CACHE_CONTROL, HeaderValue::from_static(cache));
    }
    res
}

/// The account calling `lxm`, a procedure, as [`viewer`] finds it, or a
/// refusal: a procedure the cookie calls is refused unless a page of this
/// site sends it ([`crate::login::same_site`]), as one another site's page
/// sends would carry the cookie too.
pub async fn writer(app: &App, headers: &HeaderMap, lxm: &str) -> Result<String, Failure> {
    let did = viewer(app, headers, lxm).await?;
    let by_cookie = !headers.contains_key(header::AUTHORIZATION);
    if by_cookie && did.is_some() && !crate::login::same_site(app, headers) {
        let why = "not from a page of this site";
        return Err(Failure::new(StatusCode::FORBIDDEN, "Forbidden", why));
    }
    did.ok_or_else(Failure::authentication_required)
}
