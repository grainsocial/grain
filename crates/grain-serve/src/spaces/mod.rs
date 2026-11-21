//! Permissioned spaces as grain-serve answers for them: whether an
//! account's PDS serves them ([`support`]), groups ([`group`]), their
//! pools ([`pool`]) and the pictures there ([`blob`]).
//!
//! Nothing in a space reaches a firehose, so none of it is in the index:
//! what a space holds is read from the repos that hold it when it is
//! asked for, with [`grain::space`]. A reader reads with a credential the
//! space's authority gives only to its members ([`credential`]), got with
//! the web session of the account asking, or exchanged for the delegation
//! token an app sends in the `atproto-space-delegation` header, which its
//! reader's PDS signed for that space. Each is read with for a minute at
//! most ([`REPROVE`]), so someone taken off a space stops reading it here
//! within that; it is dropped sooner when a host refuses it, and when its
//! reader logs out.
//!
//! Who can read what: a group's pool, its pictures and its member list
//! are read by the members its host admits, and by no one else, since no
//! one else is given a credential. A failure says which of three it is: not
//! a member (`NotAuthorized`), a PDS with no spaces (`SpacesUnsupported`),
//! or a host failing on the way (`UpstreamFailure`).

pub mod blob;
pub mod group;
pub mod pool;
pub mod support;

pub use support::{Support, support};

use crate::App;
use crate::xrpc::Failure;
use axum::Router;
use axum::extract::Request;
use axum::http::{HeaderMap, HeaderValue, Method, StatusCode, header};
use axum::middleware::Next;
use axum::response::Response;
use axum::routing::{get, post};
use grain::session::Session;
use grain::space::{self, Admin, Credential, DELEGATION_HEADER};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// `router` with the spaces' routes, every answer of which is for its
/// caller alone ([`unshared`]).
pub fn routes(router: Router<Arc<App>>) -> Router<Arc<App>> {
    let spaces = Router::new()
        .route(
            &format!("/xrpc/{}", support::GET),
            get(support::get_space_support),
        )
        .route(blob::PATH, get(blob::space_blob))
        .route(&format!("/xrpc/{}", group::GET), get(group::get_group))
        .route(&format!("/xrpc/{}", group::LIST), get(group::list_groups))
        .route(
            &format!("/xrpc/{}", group::SUBMISSIONS),
            get(group::get_submissions),
        )
        .route(&format!("/xrpc/{}", group::JOIN), post(group::join_group))
        .route(
            &format!("/xrpc/{}", group::CREATE),
            post(group::create_group),
        )
        .route(
            &format!("/xrpc/{}", group::HOST),
            get(group::get_group_host),
        )
        .route(&format!("/xrpc/{}", group::LEAVE), post(group::leave_group))
        .route(&format!("/xrpc/{}", pool::GET), get(pool::get_gallery))
        .route(&format!("/xrpc/{}", pool::LIST), get(pool::list_galleries))
        .route(&format!("/xrpc/{}", pool::FEED), get(pool::list_feed))
        .route(
            &format!("/xrpc/{}", pool::CREATE),
            post(pool::create_gallery),
        )
        .route(
            &format!("/xrpc/{}", pool::DELETE),
            post(pool::delete_gallery),
        )
        .route(
            &format!("/xrpc/{}", pool::COMMENT),
            post(pool::create_comment),
        )
        .route(
            &format!("/xrpc/{}", pool::UNCOMMENT),
            post(pool::delete_comment),
        )
        .route(
            &format!("/xrpc/{}", pool::FAVORITE),
            post(pool::put_favorite),
        )
        .layer(axum::middleware::from_fn(unshared));
    router.merge(spaces)
}

/// The answer to `req`, for its caller alone and kept by no cache, the
/// browser's included: it may hold what only members read, or say who is
/// one. A query is marked so for [`crate::viewer::answers`], which says it
/// varies by `cookie` and `authorization`; the picture, which is no query,
/// says so itself. Each varies by a delegation token too.
async fn unshared(req: Request, next: Next) -> Response {
    let query = req.method() == Method::GET && req.uri().path().starts_with("/xrpc/");
    crate::viewer::unshared();
    let mut res = next.run(req).await;
    let set = res.headers_mut();
    let none = HeaderValue::from_static("private, no-store");
    set.insert(header::CACHE_CONTROL, none);
    let asked = [DELEGATION_HEADER, "cookie", "authorization"];
    for name in asked.iter().take(if query { 1 } else { 3 }) {
        set.append(header::VARY, HeaderValue::from_static(name));
    }
    res
}

/// Runs `call` as `did`, at its own PDS with its web session.
pub(super) async fn as_account<T, F, Fut>(
    app: &App,
    did: &str,
    nsid: &str,
    call: F,
) -> Result<T, Failure>
where
    F: Fn(Session) -> Fut,
    Fut: std::future::Future<Output = anyhow::Result<T>>,
{
    match crate::write::with_session(app, did, nsid, call).await? {
        Ok(done) => Ok(done),
        Err(e) => Err(failed(did, e)),
    }
}

/// What `session`'s account does in spaces.
pub(super) fn admin<'a>(app: &'a App, session: &'a Session) -> Admin<'a> {
    Admin {
        ctx: &app.ctx,
        session,
    }
}

pub(super) fn parse<T: serde::de::DeserializeOwned>(body: &[u8]) -> Result<T, Failure> {
    serde_json::from_slice(body).map_err(|e| Failure::invalid(format!("the input: {e}")))
}

/// `record`, of `collection`, refused unless it fits its lexicon.
pub(super) fn checked(app: &App, collection: &str, record: Value) -> Result<Value, Failure> {
    match support::index(app)?.check(collection, &record) {
        Ok(()) => Ok(record),
        Err(crate::index::PutError::Refused(why)) => Err(Failure::new(
            StatusCode::BAD_REQUEST,
            "InvalidRecord",
            why.to_string(),
        )),
        Err(crate::index::PutError::Db(e)) => Err(e.into()),
    }
}

/// The account asking by `lxm`, which must say who it is.
pub(super) async fn caller(app: &App, headers: &HeaderMap, lxm: &str) -> Result<String, Failure> {
    let did = crate::viewer::viewer(app, headers, lxm).await?;
    did.ok_or_else(Failure::authentication_required)
}

/// How long a reader's credential for a space is read with before its
/// authority is asked for another: how long someone taken off a space may
/// still read it here.
pub const REPROVE: Duration = Duration::from_secs(60);

/// The credentials readers read spaces with, by reader and space, each
/// with when its authority gave it, and the delegation tokens spent here,
/// by `jti`, until they would expire.
#[derive(Default)]
pub struct Spaces {
    credentials: Mutex<HashMap<(String, String), (Credential, Instant)>>,
    spent: Mutex<HashMap<String, u64>>,
    /// Groups' listings at their hosts, by group, as last read
    /// ([`group::listing`]).
    listings: Mutex<HashMap<String, (Instant, Option<Value>)>>,
    /// Groups a reader was refused the member list of lately, by reader
    /// and group ([`group::is_member`]).
    refused: Mutex<HashMap<(String, String), Instant>>,
    /// The group host groups are started on, as it described itself
    /// ([`group::starter`]).
    starter: Mutex<Option<group::Starter>>,
}

impl Spaces {
    fn kept(&self, reader: &str, space: &str) -> Option<Credential> {
        let kept = self.credentials.lock().unwrap();
        let key = (reader.to_string(), space.to_string());
        let fresh = |(c, at): &&(Credential, Instant)| c.lasts() && at.elapsed() < REPROVE;
        kept.get(&key).filter(fresh).map(|(c, _)| c.clone())
    }

    fn keep(&self, credential: &Credential) {
        let mut kept = self.credentials.lock().unwrap();
        kept.retain(|_, (c, at)| c.lasts() && at.elapsed() < REPROVE);
        let key = (credential.reader.clone(), credential.space.clone());
        kept.insert(key, (credential.clone(), Instant::now()));
    }

    /// Drops what `reader` reads `space` with, a host having refused it.
    pub fn forget(&self, reader: &str, space: &str) {
        let key = (reader.to_string(), space.to_string());
        self.credentials.lock().unwrap().remove(&key);
    }

    /// Forgets every credential `reader` read with, and the member lists
    /// they were refused, as they log out.
    pub fn log_out(&self, reader: &str) {
        let theirs = |(r, _): &(String, String)| r == reader;
        self.credentials.lock().unwrap().retain(|k, _| !theirs(k));
        self.refused.lock().unwrap().retain(|k, _| !theirs(k));
    }

    /// Spends the delegation token `jti`, good until `exp`: false if it
    /// was spent before.
    fn spend(&self, jti: &str, exp: u64) -> bool {
        let mut spent = self.spent.lock().unwrap();
        let now = grain::keys::now_secs();
        spent.retain(|_, until| *until >= now);
        spent.insert(jti.to_string(), exp).is_none()
    }
}

/// A credential to read `space`, for the account asking by `lxm`: the
/// reader the delegation token in `headers` names, or the caller with its
/// web session.
pub async fn credential(
    app: &App,
    headers: &HeaderMap,
    lxm: &str,
    space: &str,
) -> Result<Credential, Failure> {
    let Some(token) = headers.get(DELEGATION_HEADER) else {
        let did = crate::viewer::viewer(app, headers, lxm).await?;
        let did = did.ok_or_else(Failure::authentication_required)?;
        return credential_for(app, &did, lxm, space).await;
    };
    let refused = |why: String| Failure::new(StatusCode::UNAUTHORIZED, "InvalidToken", why);
    let token = token.to_str().map_err(|_| refused("not a token".into()))?;
    let delegation = grain::auth::verify_delegation(&app.ctx, token).await;
    let delegation = delegation.map_err(|e| refused(format!("{e:#}")))?;
    if delegation.sub != space {
        let why = format!("a delegation for {}, not {space}", delegation.sub);
        return Err(refused(why));
    }
    let caller = crate::viewer::viewer(app, headers, lxm).await?;
    if caller.is_some_and(|did| did != delegation.iss) {
        let why = "a delegation for another account than the caller";
        return Err(refused(why.into()));
    }
    if !app.spaces.spend(&delegation.jti, delegation.exp) {
        return Err(refused("the delegation token was spent".into()));
    }
    let reader = &delegation.iss;
    if let Some(kept) = app.spaces.kept(reader, space) {
        return Ok(kept);
    }
    match space::exchange(&app.ctx, space, reader, token).await {
        Ok(got) => {
            app.spaces.keep(&got);
            Ok(got)
        }
        Err(e) => Err(failed(reader, e)),
    }
}

/// A credential for `did` to read `space`, got with its web session from
/// its PDS, which must serve spaces.
pub async fn credential_for(
    app: &App,
    did: &str,
    lxm: &str,
    space: &str,
) -> Result<Credential, Failure> {
    if let Some(kept) = app.spaces.kept(did, space) {
        return Ok(kept);
    }
    let pds = crate::login::session(app, did).await?.service;
    if !support(app, &pds, false).await?.supported {
        return Err(unsupported());
    }
    let got = crate::write::with_session(app, did, lxm, |session| async move {
        space::credential(&app.ctx, &session, space).await
    });
    match got.await? {
        Ok(got) => {
            app.spaces.keep(&got);
            Ok(got)
        }
        Err(e) => Err(failed(did, e)),
    }
}

/// A read of a space with `credential` failing, as [`failed`] answers it;
/// a refusal drops the credential.
pub fn refused(app: &App, credential: &Credential, e: anyhow::Error) -> Failure {
    let key = (credential.reader.clone(), credential.space.clone());
    if space::denied(&e) {
        app.spaces.credentials.lock().unwrap().remove(&key);
    }
    failed(&credential.reader, e)
}

/// Reading a space refused: not a member.
pub fn not_member() -> Failure {
    let why = "Only members can see this.";
    Failure::new(StatusCode::BAD_REQUEST, "NotAuthorized", why)
}

/// `did`'s PDS serving no spaces.
pub fn unsupported() -> Failure {
    let why = "Groups aren't available for your account yet.";
    Failure::new(StatusCode::BAD_REQUEST, "SpacesUnsupported", why)
}

/// A call to a space for `did` failing, as grain-serve answers it: a
/// refusal, or a PDS with no such method (an authority with no spaces,
/// whose space there cannot be), is not being a member; anything else is
/// the host's failure.
pub fn failed(did: &str, e: anyhow::Error) -> Failure {
    if space::denied(&e) || space::not_served(&e) {
        return not_member();
    }
    tracing::info!(%did, error = %format!("{e:#}"), "a space failed to answer");
    upstream(format!("a space's host failed to answer: {e:#}"))
}

/// A host failing on the way, as `why` says.
pub fn upstream(why: String) -> Failure {
    Failure::new(StatusCode::BAD_GATEWAY, "UpstreamFailure", why)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn delegations_are_spent_once_and_forgotten_once_expired() {
        let spaces = Spaces::default();
        let now = grain::keys::now_secs();
        assert!(spaces.spend("a", now + 60));
        assert!(!spaces.spend("a", now + 60));
        assert!(spaces.spend("b", now - 1));
        assert!(spaces.spend("b", now + 60), "an expired one is forgotten");
    }

    #[test]
    fn a_failure_says_what_it_is() {
        let said = |status, error: &str| -> anyhow::Error {
            grain::xrpc::XrpcError {
                status,
                error: error.into(),
                message: String::new(),
                reset: None,
            }
            .into()
        };
        let denied = failed("did:plc:a", said(400, "SpaceNotFound"));
        assert_eq!(denied, not_member());
        let unserved = failed("did:plc:a", said(501, "MethodNotImplemented"));
        assert_eq!(unserved, not_member());
        let broke = failed("did:plc:a", anyhow::anyhow!("connection reset"));
        assert_eq!(broke.status, StatusCode::BAD_GATEWAY);
        assert_eq!(broke.error, "UpstreamFailure");
    }
}
