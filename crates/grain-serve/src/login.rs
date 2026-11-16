//! Logging in to the web, as knotless-serve's pages log in.
//!
//! grain-serve is a confidential OAuth client of each account's PDS. Its
//! client ID is the metadata document it serves at [`METADATA`], under
//! `--public-url`, signing with the key `pds-client-auth-key`: a PDS
//! binds each session to its client and that key, so the client ID and
//! the key stay what they are for as long as grain logs anyone in. The
//! index keeps the key (`oauth_key`) and each account's session
//! (`web_session`).
//!
//! The browser holds only a cookie this server signed, naming the
//! account, with a key of its own, [`COOKIE_KID`], kept beside the
//! client's and never published, so no PDS sees what signs a cookie and
//! the client's key can change without the cookies or the cookies' without
//! the client: HttpOnly, SameSite=Lax, Secure on https. It names
//! no one once the session it stands for is gone, or if it was signed
//! before that session's login, so logging out ends every cookie signed
//! for the account before. A login is answered only in the browser that
//! started it, by a cookie naming its state, so a link to someone else's
//! approval cannot log a person in as them. An account taken down cannot
//! log in, and its cookies name no one while it stays down.
//!
//! Login, logout and switching accounts take a request only from a page
//! of this site, by its `Origin`; so does every write the cookie makes
//! ([`same_site`]).
//!
//! A login asks for what grain writes, and, of a PDS that serves spaces,
//! for what groups do there too ([`asked`]).
//!
//! A browser can be logged in to several accounts at once: logging in to
//! another keeps the one before in a second cookie of such signed tokens,
//! and switching swaps one of those for the one in use, with no login.
//!
//! A login makes the account a grain profile from its Bluesky one, if it
//! has none with a name, in the background ([`profile`]).
//!
//! Access tokens are refreshed when about to expire, one refresh an
//! account at a time ([`session`]): a refresh token is spent once, and a
//! second refresh with it ends the whole grant.
//!
//! The iOS and Android apps log in at their own PDS, not here: they are
//! public clients, PKCE and DPoP, whose client ID is the document this
//! server serves at [`APP_METADATA`], and they call this server through
//! their PDS's `atproto-proxy` ([`app_scope`]). This server holds none of
//! their sessions.

pub mod carryover;
pub mod profile;

use crate::App;
use crate::xrpc::Failure;
use axum::Json;
use axum::extract::{Query, State};
use axum::http::{HeaderMap, HeaderValue, StatusCode, header};
use axum::response::{IntoResponse, Redirect, Response};
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use grain::crypto::{self, P256Key};
use grain::env::Ctx;
use grain::session::Session;
use grain::{identity, keys, oauth};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// Where the client's metadata is: its client ID, under the public URL.
pub const METADATA: &str = "/oauth-client-metadata.json";
/// Where the client's public key is, as its metadata says.
pub const JWKS: &str = "/oauth/client-jwks.json";
/// Where the PDS sends the browser back to.
pub const CALLBACK: &str = "/oauth/callback";
/// Where the apps' client metadata is: their client ID, under the public
/// URL.
pub const APP_METADATA: &str = "/oauth/app-client-metadata.json";
/// Where a PDS sends an app back to, under the scheme [`app_scheme`]
/// names.
pub const APP_CALLBACK: &str = "/oauth/callback";
/// The cookie naming the account logged in.
pub const COOKIE: &str = "grain_session";
/// The cookie holding the other accounts a browser is logged in to: their
/// session cookies, `~` between.
pub const OTHERS: &str = "grain_accounts";
/// The cookie naming the login a browser started.
pub const STARTED: &str = "grain_login";
/// The key ID, in `oauth_key`, of the key that signs the cookies.
pub const COOKIE_KID: &str = "web-cookie";
/// How many other accounts a browser stays logged in to, ten in all;
/// logging in to one more drops the one used least lately.
const MOST: usize = 9;
/// How long a login lasts in the browser, in seconds.
const LASTS: u64 = 90 * 24 * 60 * 60;
/// How long approving a login at the PDS may take.
const TAKES: Duration = Duration::from_secs(15 * 60);

/// What the client's metadata says it may ask for: the scope grain.social
/// registers, word for word. A PDS that holds a request to it refuses one
/// that asks past it, and the pool and group scopes are asked for
/// only of PDSes that serve spaces, so all of them are here; with them, the
/// create-only Bluesky post scope older apps still ask for.
pub const REGISTERED: &str = concat!(
    "atproto blob:image/* repo:social.grain.gallery repo:social.grain.gallery.item ",
    "repo:social.grain.photo repo:social.grain.photo.exif repo:social.grain.actor.profile ",
    "repo:social.grain.graph.follow repo:social.grain.favorite repo:social.grain.comment ",
    "repo:social.grain.story repo:social.grain.graph.block ",
    "repo:app.bsky.feed.post?action=create&action=update ",
    "repo:app.bsky.feed.post?action=create ",
    "space:social.grain.group?authority=*&skey=*&collection=social.grain.gallery",
    "&collection=social.grain.gallery.item&collection=social.grain.photo",
    "&collection=social.grain.favorite&collection=social.grain.comment",
    "&action=read&action=create&action=update&action=delete ",
    "space:social.grain.group?authority=*&skey=*&action=read ",
    "repo:social.grain.group.submission repo:social.grain.group.item ",
    "repo:social.grain.group.decline rpc:fyi.opensocial.requestJoin?aud=* ",
    "rpc:fyi.opensocial.leaveGroup?aud=* rpc:fyi.opensocial.provisionGroup?aud=* ",
    "rpc:fyi.opensocial.createSpace?aud=* ",
    "space:fyi.opensocial.members?authority=*&skey=*&collection=fyi.opensocial.acceptance",
    "&action=read&action=create&action=update&action=delete",
);

/// The PDS someone making an account makes it on, unless
/// `--sign-up-pds` names another.
pub const SIGN_UP_PDS: &str = "https://selfhosted.social";

/// The web's side of logging in: the client, and the logins and refreshes
/// under way.
pub struct Web {
    /// `--public-url`, with no trailing slash.
    pub public_url: String,
    pub client: oauth::Client,
    /// What signs the cookies, and nothing else.
    cookie_key: P256Key,
    pub sign_up_pds: String,
    /// The group host groups are started on, if any: `--group-host`.
    pub group_host: Option<String>,
    logins: Mutex<HashMap<String, Pending>>,
    /// A lock for each account whose session is being refreshed.
    refreshing: Mutex<HashMap<String, Arc<tokio::sync::Mutex<()>>>>,
    /// What carries the cookies browsers held before, while it does.
    carryover: Option<carryover::Carryover>,
}

/// A login gone to a PDS, waiting for the browser to come back.
struct Pending {
    started: Instant,
    request: oauth::Request,
    /// The page to go back to.
    back: String,
}

impl Web {
    /// The web's client at `public_url`, with the key `index` keeps, made
    /// and kept there if it has none.
    pub fn new(
        public_url: &str,
        index: &crate::index::Index,
        sign_up_pds: &str,
    ) -> anyhow::Result<Web> {
        let public_url = public_url.trim_end_matches('/').to_string();
        let made = || private_jwk(&P256Key::generate());
        let jwk = index.oauth_key(oauth::KID, made)?;
        let cookie_key = from_jwk(&index.oauth_key(COOKIE_KID, made)?)?;
        let id = format!("{public_url}{METADATA}");
        let client = oauth::Client::confidential(&id, from_jwk(&jwk)?);
        Ok(Web {
            public_url,
            client,
            cookie_key,
            sign_up_pds: sign_up_pds.trim_end_matches('/').to_string(),
            group_host: None,
            logins: Mutex::new(HashMap::new()),
            refreshing: Mutex::new(HashMap::new()),
            carryover: None,
        })
    }

    /// This web, starting groups on the group host at `url`, if any
    /// ([`crate::spaces::group::create_group`]).
    pub fn starting_groups(mut self, url: Option<&str>) -> Web {
        self.group_host = url.map(|u| u.trim_end_matches('/').to_string());
        self
    }

    /// A session cookie's token for `did`, signed now.
    fn token(&self, did: &str) -> String {
        let claims = Claims {
            kind: "web".into(),
            did: did.to_string(),
            iat: keys::now_micros(),
            exp: keys::now_secs() + LASTS,
        };
        self.cookie_key.sign_jwt(&json!({ "typ": "JWT" }), &claims)
    }

    fn callback(&self) -> String {
        format!("{}{CALLBACK}", self.public_url)
    }

    /// A `Set-Cookie` value for `name`, lasting `secs` (0 clears it), out
    /// of the pages' script, same-site, and Secure on https.
    fn set_cookie(&self, name: &str, value: &str, secs: u64) -> HeaderValue {
        let secure = ["", "; Secure"][usize::from(self.public_url.starts_with("https://"))];
        let cookie =
            format!("{name}={value}; Path=/; Max-Age={secs}; HttpOnly; SameSite=Lax{secure}");
        HeaderValue::from_str(&cookie).expect("a cookie is a header")
    }
}

/// `key` as a private JWK, as the index keeps it.
pub fn private_jwk(key: &P256Key) -> String {
    let mut jwk = key.jwk();
    jwk["d"] = URL_SAFE_NO_PAD.encode(key.to_bytes()).into();
    jwk.to_string()
}

/// The P-256 key a private JWK holds.
pub fn from_jwk(jwk: &str) -> anyhow::Result<P256Key> {
    let jwk: Value = serde_json::from_str(jwk)?;
    anyhow::ensure!(jwk["crv"] == "P-256", "a key not on P-256");
    let d = jwk["d"]
        .as_str()
        .ok_or_else(|| anyhow::anyhow!("a JWK with no secret"))?;
    P256Key::from_bytes(&URL_SAFE_NO_PAD.decode(d)?)
}

/// What the session cookie says.
#[derive(Serialize, Deserialize)]
struct Claims {
    kind: String,
    did: String,
    /// When it was signed, in microseconds since the epoch.
    iat: u64,
    exp: u64,
}

/// `app`'s context, asking every host only as [`grain::guard`] allows: a
/// login names its PDS and authorization server by what anyone's DID
/// document says.
fn guarded(app: &App) -> Ctx {
    Ctx {
        http: app.ctx.guarded.clone(),
        ..app.ctx.clone()
    }
}

fn web(app: &App) -> Result<&Web, Failure> {
    let why = "this server has no public URL and index to log in to";
    let none = || Failure::new(StatusCode::NOT_IMPLEMENTED, "MethodNotImplemented", why);
    app.web.as_deref().ok_or_else(none)
}

fn index(app: &App) -> &crate::index::Index {
    app.index
        .as_deref()
        .expect("a server that logs in keeps an index")
}

/// The value of the cookie `name` the request holds.
fn cookie(headers: &HeaderMap, name: &str) -> Option<String> {
    let all = headers.get_all(header::COOKIE).into_iter();
    let pairs = all
        .filter_map(|v| v.to_str().ok())
        .flat_map(|v| v.split(';'));
    pairs
        .filter_map(|pair| pair.trim().split_once('='))
        .find(|(k, _)| *k == name)
        .map(|(_, v)| v.to_string())
}

/// Whether a request comes from a page of this site, by its `Origin`,
/// which a browser sends with every request but a plain navigation: one
/// with none, or with another, is refused what the cookie lets it do.
pub fn same_site(app: &App, headers: &HeaderMap) -> bool {
    let Some(web) = &app.web else {
        return false;
    };
    let origin = headers.get(header::ORIGIN).and_then(|o| o.to_str().ok());
    origin.is_some_and(|o| o == web.public_url)
}

fn not_this_site() -> Failure {
    Failure::new(
        StatusCode::FORBIDDEN,
        "Forbidden",
        "not from a page of this site",
    )
}

/// The account a request's session cookie names, while the cookie holds:
/// none for no cookie, a bad one, one signed before its account's login,
/// one whose session is gone, or one for an account taken down.
pub fn viewer(app: &App, headers: &HeaderMap) -> Option<String> {
    held(app, &cookie(headers, COOKIE)?)
}

/// The account a session cookie's `token` names, while it holds, as
/// [`viewer`] says.
fn held(app: &App, token: &str) -> Option<String> {
    let web = app.web.as_ref()?;
    let claims: Claims = crypto::verify_jwt(token, &web.cookie_key.public()).ok()?;
    let index = index(app);
    let kept = index.web_session(&claims.did).ok()??;
    let down = index.taken_down(&claims.did).unwrap_or(true);
    (claims.kind == "web" && claims.iat >= kept.since && !down).then_some(claims.did)
}

/// The other accounts a request's cookies hold, with their tokens, the one
/// used last first: only those that still hold, each once, and never `but`.
fn others(app: &App, headers: &HeaderMap, but: Option<&str>) -> Vec<(String, String)> {
    let all = cookie(headers, OTHERS).unwrap_or_default();
    let mut found: Vec<(String, String)> = Vec::new();
    for token in all.split('~').filter(|t| !t.is_empty()) {
        let Some(did) = held(app, token) else {
            continue;
        };
        if Some(did.as_str()) != but && !found.iter().any(|(d, _)| *d == did) {
            found.push((did, token.to_string()));
        }
    }
    found
}

/// The `Set-Cookie` value keeping `others`, as many as a browser keeps.
fn set_others(web: &Web, others: &[(String, String)]) -> HeaderValue {
    let kept: Vec<&str> = others.iter().take(MOST).map(|(_, t)| t.as_str()).collect();
    let value = kept.join("~");
    web.set_cookie(OTHERS, &value, [0, LASTS][usize::from(!value.is_empty())])
}

/// A page to go back to: a path of this site, else its front page.
fn back_to(back: Option<&str>) -> String {
    match back {
        Some(b) if b.starts_with('/') && !b.starts_with("//") && !b.contains('\\') => b.into(),
        _ => "/".into(),
    }
}

/// The client's metadata document, which its ID names: its key at
/// [`JWKS`] rather than in it.
pub async fn client_metadata(State(app): State<Arc<App>>) -> Result<Json<Value>, Failure> {
    let web = web(&app)?;
    let mut doc = web.client.metadata("grain", &[&web.callback()], REGISTERED);
    doc.as_object_mut()
        .expect("metadata is an object")
        .remove("jwks");
    doc["jwks_uri"] = format!("{}{JWKS}", web.public_url).into();
    Ok(Json(doc))
}

/// The scheme a PDS sends an app back to a login under: the public URL's
/// host, reversed, as atproto asks of a native client's redirect, so
/// `https://grain.social` is `social.grain`.
pub fn app_scheme(public_url: &str) -> String {
    let host = public_url.split("://").nth(1).unwrap_or(public_url);
    let host = host.split([':', '/']).next().unwrap_or_default();
    host.rsplit('.').collect::<Vec<_>>().join(".")
}

/// What an app asks for: [`oauth::SCOPE`], and [`app_calls`].
pub fn app_scope(did: &str) -> String {
    format!("{} {}", oauth::SCOPE, app_calls(did))
}

/// To call this server, the service `did` names [`crate::did::APPVIEW`],
/// as the account through its PDS, any method, as Bluesky's apps call
/// theirs. The audience is a query value, which a PDS decodes: a port's
/// `%3A` in a `did:web` is escaped again so that it stays one.
pub fn app_calls(did: &str) -> String {
    let aud = format!("{did}{}", crate::did::APPVIEW);
    format!("rpc:*?aud={}", aud.replace('%', "%25").replace('#', "%23"))
}

/// The apps' client metadata document, which their client ID names: a
/// native public client, binding its tokens to a DPoP key of its own,
/// sent back under [`app_scheme`]. Its scope is what the web registers
/// and [`app_calls`]: all an app may ask for.
pub async fn app_client_metadata(State(app): State<Arc<App>>) -> Result<Json<Value>, Failure> {
    let web = web(&app)?;
    let did = app.did.as_deref().expect("a server that logs in has a DID");
    let redirect = format!("{}:{APP_CALLBACK}", app_scheme(&web.public_url));
    let scope = format!("{REGISTERED} {}", app_calls(did));
    Ok(Json(json!({
        "client_id": format!("{}{APP_METADATA}", web.public_url),
        "client_name": "grain",
        "client_uri": web.public_url,
        "application_type": "native",
        "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"],
        "redirect_uris": [redirect],
        "scope": scope,
        "token_endpoint_auth_method": "none",
        "dpop_bound_access_tokens": true,
    })))
}

/// The client's public key, which a PDS checks its assertions with.
pub async fn client_jwks(State(app): State<Arc<App>>) -> Result<Json<Value>, Failure> {
    Ok(Json(web(&app)?.client.jwks()))
}

#[derive(Deserialize)]
pub struct Start {
    /// Who is logging in; none when making an account.
    #[serde(default)]
    handle: String,
    /// Making an account, rather than logging in to one.
    #[serde(default)]
    create: bool,
    back: Option<String>,
}

/// Starts logging in as `handle`, or, with `create`, making an account on
/// the PDS this site sends people to: answers the page where they approve
/// it, and marks this browser as the one that started it.
pub async fn login(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Json(start): Json<Start>,
) -> Result<Response, Failure> {
    let web = web(&app)?;
    if !same_site(&app, &headers) {
        return Err(not_this_site());
    }
    let ctx = guarded(&app);
    let back = web.callback();
    let request = if start.create {
        let scope = asked(&app, &web.sign_up_pds).await?;
        oauth::sign_up(&ctx, &web.client, &web.sign_up_pds, &back, &scope).await
    } else {
        let handle = start.handle.trim().trim_start_matches('@').to_lowercase();
        let Ok(id) = identity::resolve(&ctx, &handle).await else {
            return Err(Failure::invalid(format!("No account answers to {handle}.")));
        };
        if index(&app).taken_down(&id.did)? {
            let why = format!("{handle} is taken down here.");
            return Err(Failure::new(StatusCode::FORBIDDEN, "AccountTakedown", why));
        }
        let scope = asked(&app, &id.pds).await?;
        oauth::authorize(&ctx, &web.client, id, &handle, &back, &scope).await
    };
    let request = request.map_err(upstream)?;
    let (url, state) = (request.url.clone(), request.state.clone());
    let mut logins = web.logins.lock().unwrap();
    // Logins started and never finished go once they could no longer be.
    logins.retain(|_, p| p.started.elapsed() < TAKES);
    let pending = Pending {
        started: Instant::now(),
        request,
        back: back_to(start.back.as_deref()),
    };
    logins.insert(state.clone(), pending);
    drop(logins);
    let mut res = Json(json!({ "url": url })).into_response();
    let started = web.set_cookie(STARTED, &state, TAKES.as_secs());
    res.headers_mut().append(header::SET_COOKIE, started);
    Ok(res)
}

/// What a login asks of an account on `pds`: [`oauth::SCOPE`], and
/// [`oauth::SPACE_SCOPE`] with it if `pds` serves spaces
/// ([`crate::spaces::support`]).
pub async fn asked(app: &App, pds: &str) -> Result<String, Failure> {
    let spaces = crate::spaces::support(app, pds, false).await?;
    Ok(oauth::scope(spaces.supported))
}

/// A PDS or authorization server failing a login: 502, why told.
pub(crate) fn upstream(e: anyhow::Error) -> Failure {
    Failure::new(StatusCode::BAD_GATEWAY, "UpstreamFailure", format!("{e:#}"))
}

/// Where the browser comes back to from the PDS: keeps the session and
/// sets the cookie naming the account, then goes back to the page the
/// login started on. A login refused goes back logged in as before; one
/// this browser did not start, or that took too long, is refused.
pub async fn callback(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Response, Failure> {
    let web = web(&app)?;
    let state = params.get("state").map_or("", String::as_str);
    let mine = cookie(&headers, STARTED).is_some_and(|s| s == state);
    let pending = mine
        .then(|| web.logins.lock().unwrap().remove(state))
        .flatten();
    let Some(pending) = pending.filter(|p| p.started.elapsed() < TAKES) else {
        return Err(Failure::invalid(
            "no login is waiting for this in this browser",
        ));
    };
    // Every account the browser is logged in to already, the one in use
    // first, to stay logged in to beside the new one.
    let current = viewer(&app, &headers);
    let mut before = others(&app, &headers, current.as_deref());
    if let (Some(did), Some(token)) = (current, cookie(&headers, COOKIE)) {
        before.insert(0, (did, token));
    }
    let mut res = Redirect::to(&pending.back).into_response();
    let set = res.headers_mut();
    set.append(header::SET_COOKIE, web.set_cookie(STARTED, "", 0));
    let kept = keep(&app, web, pending.request, &params).await;
    match &kept {
        Ok(did) => tracing::info!(%did, "a web login"),
        Err(e) => tracing::info!(error = %format!("{e:#}"), "a web login refused"),
    }
    if let Ok(did) = kept {
        drop(profile::seed(&app, &did));
        before.retain(|(other, _)| *other != did);
        let token = web.token(&did);
        set.append(header::SET_COOKIE, web.set_cookie(COOKIE, &token, LASTS));
        if !before.is_empty() {
            set.append(header::SET_COOKIE, set_others(web, &before));
        }
    }
    Ok(res)
}

/// Trades the PDS's answer for a session, and keeps it. Returns the
/// account.
async fn keep(
    app: &App,
    web: &Web,
    request: oauth::Request,
    params: &HashMap<String, String>,
) -> anyhow::Result<String> {
    let ctx = guarded(app);
    let session = request.redeem(&ctx, &web.client, params).await?;
    let session = oauth::named(&ctx, session).await?;
    // Asked again, for an account made or named only now.
    anyhow::ensure!(!index(app).taken_down(&session.did)?, "taken down here");
    index(app).keep_web_session(&session, keys::now_micros())?;
    named(app, &ctx, &session.did, &session.handle).await?;
    Ok(session.did)
}

/// Tracks `did`, which has logged in, and keeps `handle`, the one its PDS
/// says it has, as its handle if it resolves to `did`: so its profile is
/// found by handle before backfill reads it. A handle that does not is
/// left for backfill to look up. An identity event or backfill later
/// keeps what it finds over it.
async fn named(app: &App, ctx: &Ctx, did: &str, handle: &str) -> anyhow::Result<()> {
    index(app).track(did)?;
    let handle = handle.to_lowercase();
    let found = identity::resolve_handle(ctx, &handle).await.ok();
    if found.as_deref() == Some(did) {
        index(app).set_handle(did, &handle)?;
    }
    Ok(())
}

/// Keeps the session a server hands this client for an account it made,
/// asked for at `url` with `body` and `authorization`
/// ([`oauth::provisioned`]), named by `handle`. Returns the account. Its
/// refusal is [`oauth::Refused`].
pub async fn provisioned(
    app: &App,
    web: &Web,
    url: &str,
    body: &Value,
    authorization: &str,
    handle: &str,
) -> anyhow::Result<String> {
    let ctx = guarded(app);
    let mut session = oauth::provisioned(&ctx, &web.client, url, body, authorization).await?;
    session.handle = handle.to_string();
    index(app).keep_web_session(&session, keys::now_micros())?;
    Ok(session.did)
}

#[derive(Deserialize)]
pub struct Switch {
    did: String,
}

/// Switches the browser to `did`, another account it is logged in to: its
/// cookie becomes the one in use, and the one in use joins the others.
pub async fn switch(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Json(to): Json<Switch>,
) -> Result<Response, Failure> {
    let web = web(&app)?;
    if !same_site(&app, &headers) {
        return Err(not_this_site());
    }
    let current = viewer(&app, &headers);
    let mut others = others(&app, &headers, current.as_deref());
    let Some(at) = others.iter().position(|(did, _)| *did == to.did) else {
        return Err(Failure::invalid(
            "This browser is not logged in to that account.",
        ));
    };
    let (_, token) = others.remove(at);
    if let (Some(did), Some(was)) = (current, cookie(&headers, COOKIE)) {
        others.insert(0, (did, was));
    }
    let mut res = Json(json!({})).into_response();
    let set = res.headers_mut();
    set.append(header::SET_COOKIE, web.set_cookie(COOKIE, &token, LASTS));
    set.append(header::SET_COOKIE, set_others(web, &others));
    Ok(res)
}

/// Ends `did`'s web session: revokes it at its authorization server, as
/// far as it lets, and forgets it here, with the space credentials it was
/// reading with.
pub(crate) async fn end_session(app: &App, did: &str) -> Result<(), Failure> {
    if let (Some(web), Some(kept)) = (app.web.as_deref(), index(app).web_session(did)?)
        && let Some(o) = &kept.session.oauth
    {
        // A token the server cannot revoke now expires on its own.
        let _ = oauth::revoke(&guarded(app), &web.client, &kept.session, o).await;
    }
    index(app).end_web_session(did)?;
    app.spaces.log_out(did);
    Ok(())
}

/// Logs the account the cookie names out: revokes its session at its
/// authorization server, as far as it lets, and forgets it here, which
/// ends every cookie signed for it. The browser goes on as the other
/// account it used last, if it is logged in to one.
pub async fn logout(State(app): State<Arc<App>>, headers: HeaderMap) -> Result<Response, Failure> {
    let web = web(&app)?;
    if !same_site(&app, &headers) {
        return Err(not_this_site());
    }
    if let Some(did) = viewer(&app, &headers) {
        end_session(&app, &did).await?;
    }
    // Read once the account is logged out, so none of its cookies is left.
    let mut others = others(&app, &headers, None);
    let next = (!others.is_empty()).then(|| others.remove(0));
    let mut res = Json(json!({})).into_response();
    let set = res.headers_mut();
    let token = next.as_ref().map_or("", |(_, t)| t.as_str());
    let lasts = [0, LASTS][usize::from(next.is_some())];
    set.append(header::SET_COOKIE, web.set_cookie(COOKIE, token, lasts));
    if cookie(&headers, OTHERS).is_some() {
        set.append(header::SET_COOKIE, set_others(web, &others));
    }
    Ok(res)
}

/// An account as the web's login knows it.
#[derive(Serialize)]
struct Account {
    did: String,
    handle: String,
}

/// Who the browser is logged in as, and the other accounts it can switch
/// to: `{}` for no one.
pub async fn whoami(State(app): State<Arc<App>>, headers: HeaderMap) -> Result<Response, Failure> {
    web(&app)?;
    let account = |did: String| {
        let kept = index(&app).web_session(&did).ok().flatten();
        let handle = kept.map(|k| k.session.handle).unwrap_or_default();
        Account { did, handle }
    };
    let current = viewer(&app, &headers);
    let accounts: Vec<Account> = match &current {
        Some(did) => others(&app, &headers, Some(did))
            .into_iter()
            .map(|(d, _)| account(d))
            .collect(),
        None => Vec::new(),
    };
    let body = json!({ "account": current.map(account), "accounts": accounts });
    let mut res = Json(body).into_response();
    let private = HeaderValue::from_static("private, no-store");
    res.headers_mut().insert(header::CACHE_CONTROL, private);
    Ok(res)
}

/// `did`'s web session, with an access token that will last the call:
/// refreshed if it is about to expire, one refresh at a time. A refresh
/// the authorization server refuses ends the session, and the account
/// logs in again; one that fails on the way keeps it, to try again.
pub async fn session(app: &App, did: &str) -> Result<Session, Failure> {
    fresh(app, did, None).await
}

/// `did`'s web session as [`session`] finds it, refreshed whether or not
/// it is about to expire if its access token is still `refused`, one its
/// PDS just refused: whoever refreshed it meanwhile has made it last.
pub async fn refreshed(app: &App, did: &str, refused: &str) -> Result<Session, Failure> {
    fresh(app, did, Some(refused)).await
}

/// The session ended, as a call that needed it answers.
pub fn ended() -> Failure {
    let why = "the web session has ended: log in again";
    Failure::new(StatusCode::UNAUTHORIZED, "AuthenticationRequired", why)
}

async fn fresh(app: &App, did: &str, refused: Option<&str>) -> Result<Session, Failure> {
    let web = web(app)?;
    let stale = |s: &Session| s.expiring() || refused == Some(s.access_jwt.as_str());
    let index = index(app);
    let kept = index.web_session(did)?.ok_or_else(ended)?;
    if !stale(&kept.session) {
        return Ok(kept.session);
    }
    let lock = {
        let mut refreshing = web.refreshing.lock().unwrap();
        refreshing.retain(|_, held| Arc::strong_count(held) > 1);
        refreshing.entry(did.to_string()).or_default().clone()
    };
    let _turn = lock.lock().await;
    // Whoever refreshed while this waited left a session that lasts.
    let stored = index.web_session(did)?.ok_or_else(ended)?.session;
    if !stale(&stored) {
        return Ok(stored);
    }
    let Some(o) = &stored.oauth else {
        index.end_web_session(did)?;
        return Err(ended());
    };
    match oauth::refresh(&guarded(app), &web.client, &stored, o).await {
        // Logged out of while it was refreshed, it stays logged out of.
        Ok(fresh) => {
            let kept = index.refresh_web_session(&fresh, keys::now_micros())?;
            kept.then_some(fresh).ok_or_else(ended)
        }
        Err(e) if oauth::Refused::of(&e).is_some() => {
            tracing::info!(%did, error = %format!("{e:#}"), "a web session's refresh refused");
            index.end_web_session(did)?;
            Err(ended())
        }
        Err(e) => Err(upstream(e.context("refreshing the web session"))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn headers(pairs: &[(&str, &str)]) -> HeaderMap {
        let mut h = HeaderMap::new();
        for (k, v) in pairs {
            let name = axum::http::HeaderName::from_bytes(k.as_bytes()).unwrap();
            h.append(name, HeaderValue::from_str(v).unwrap());
        }
        h
    }

    #[test]
    fn a_server_with_no_login_takes_no_page_as_its_own() {
        let app = App::bare(Ctx::new(grain::env::Env::from_vars(|_| None)));
        let from = headers(&[("origin", "https://grain.social")]);
        assert!(!same_site(&app, &from));
        assert_eq!(
            viewer(&app, &headers(&[("cookie", "grain_session=t")])),
            None
        );
    }

    #[test]
    fn cookies_are_read_by_name() {
        let h = headers(&[("cookie", "a=1; grain_session=t"), ("cookie", "b=2")]);
        assert_eq!(cookie(&h, COOKIE).as_deref(), Some("t"));
        assert_eq!(cookie(&h, "b").as_deref(), Some("2"));
        assert_eq!(cookie(&h, "c"), None);
    }

    #[test]
    fn going_back_stays_on_the_site() {
        assert_eq!(
            back_to(Some("/alice.test/gallery/x?y=1")),
            "/alice.test/gallery/x?y=1"
        );
        for away in ["https://evil.example", "//evil.example", "/\\evil.example"] {
            assert_eq!(back_to(Some(away)), "/");
        }
        assert_eq!(back_to(None), "/");
    }

    #[test]
    fn keys_round_trip_as_private_jwks() {
        let key = P256Key::generate();
        let jwk = private_jwk(&key);
        assert_eq!(from_jwk(&jwk).unwrap().to_bytes(), key.to_bytes());
        let mut wrong: Value = serde_json::from_str(&jwk).unwrap();
        wrong["crv"] = "secp256k1".into();
        assert!(from_jwk(&wrong.to_string()).is_err());
        wrong["crv"] = "P-256".into();
        wrong.as_object_mut().unwrap().remove("d");
        assert!(from_jwk(&wrong.to_string()).is_err());
        assert!(from_jwk("{").is_err());
    }

    #[test]
    fn apps_come_back_under_their_host_reversed() {
        assert_eq!(app_scheme("https://grain.social"), "social.grain");
        assert_eq!(
            app_scheme("https://client.grain.internal:4433/"),
            "internal.grain.client"
        );
        assert_eq!(app_scheme("grain.social"), "social.grain");
    }

    #[test]
    fn apps_call_the_appview_through_their_pds() {
        let scope = app_scope("did:web:grain.social");
        assert!(scope.starts_with(oauth::SCOPE));
        assert!(scope.ends_with(" rpc:*?aud=did:web:grain.social%23grain_appview"));
        assert_eq!(
            app_calls("did:web:localhost%3A3000"),
            "rpc:*?aud=did:web:localhost%253A3000%23grain_appview"
        );
    }

    #[test]
    fn what_is_asked_is_registered() {
        let registered: Vec<&str> = REGISTERED.split(' ').collect();
        for scope in oauth::scope(true).split(' ') {
            assert!(registered.contains(&scope), "{scope}");
        }
        assert!(!REGISTERED.contains("  ") && !REGISTERED.ends_with(' '));
    }
}
