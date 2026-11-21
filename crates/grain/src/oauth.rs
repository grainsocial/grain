//! OAuth logins, as atproto profiles them: authorization requests pushed
//! (PAR) with PKCE, and access tokens bound to a DPoP key.
//!
//! grain is two kinds of client. The `grain` command line is the loopback
//! client `http://localhost`, a public client the browser comes back to on
//! 127.0.0.1. grain-serve is a confidential client, whose metadata document
//! it serves itself and whose key signs an assertion of who it is with
//! every request to the authorization server.

use crate::crypto::P256Key;
use crate::env::Ctx;
use crate::identity::{self, Identity};
use crate::keys;
use crate::session::{OAuth, Session};
use crate::xrpc::Xrpc;
use anyhow::{Context, Result, bail};
use base64::Engine;
use base64::engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD};
use rand_core::RngCore;
use reqwest::Url;
use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashMap};
use std::sync::Mutex;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

const CALLBACK: &str = "/callback";

/// What grain asks for on every login: to write the records it keeps in
/// an account, to upload the pictures they reference, and to cross-post a
/// gallery to Bluesky, which `putRecord` does so that a publish resumed
/// overwrites its own post, and so asks to update as well as create.
///
/// Groups ask for [`SPACE_SCOPE`] beside these, and only of a PDS that
/// serves spaces: a login that needs them adds them to what it passes to
/// [`authorize`].
pub const SCOPE: &str = "atproto \
blob:image/* \
repo:social.grain.gallery \
repo:social.grain.gallery.item \
repo:social.grain.photo \
repo:social.grain.photo.exif \
repo:social.grain.actor.profile \
repo:social.grain.graph.follow \
repo:social.grain.favorite \
repo:social.grain.comment \
repo:social.grain.story \
repo:social.grain.graph.block \
repo:app.bsky.feed.post?action=create&action=update";

/// What a login asks for beside [`SCOPE`] of a PDS that serves spaces: to
/// read a group's pool and write galleries, favorites and comments to it
/// (a space of `social.grain.group` the group makes, hence any
/// authority); to offer a gallery to a group and, acting as one, answer
/// it; to ask a group host to join, leave, found a group and open its
/// pool, by service auth for any host; and to read a group's member list
/// and keep its own acceptance there.
pub const SPACE_SCOPE: &str = "\
space:social.grain.group?authority=*&skey=*&collection=social.grain.gallery\
&collection=social.grain.gallery.item&collection=social.grain.photo\
&collection=social.grain.favorite&collection=social.grain.comment\
&action=read&action=create&action=update&action=delete \
space:social.grain.group?authority=*&skey=*&action=read \
repo:social.grain.group.submission \
repo:social.grain.group.item \
repo:social.grain.group.decline \
rpc:fyi.opensocial.requestJoin?aud=* \
rpc:fyi.opensocial.leaveGroup?aud=* \
rpc:fyi.opensocial.provisionGroup?aud=* \
rpc:fyi.opensocial.createSpace?aud=* \
space:fyi.opensocial.members?authority=*&skey=*&collection=fyi.opensocial.acceptance\
&action=read&action=create&action=update&action=delete";

/// What a login asks of a PDS: [`SCOPE`], and [`SPACE_SCOPE`] with it of
/// one that serves spaces.
pub fn scope(spaces: bool) -> String {
    match spaces {
        true => format!("{SCOPE} {SPACE_SCOPE}"),
        false => SCOPE.to_string(),
    }
}

/// What the command line's loopback client asks for: [`SCOPE`], and to
/// call grain's appview as the account for what it reports and, for an
/// admin, how it moderates ([`crate::moderation::CALLED`]).
pub fn loopback_scope() -> String {
    let called = crate::moderation::CALLED.iter();
    let rpc = called.map(|lxm| format!(" rpc:{lxm}?aud=*"));
    format!("{SCOPE}{}", rpc.collect::<String>())
}

/// Whether `session` was asked for less than `asked`, what its client asks
/// for now: logging in again brings it up. A session stored before its
/// scope was kept is behind, unless it was the loopback client's, whose ID
/// names its scope; one by app password never is.
pub fn behind(session: &Session, asked: &str) -> bool {
    let oauth = session.oauth.as_ref();
    oauth.is_some_and(|o| o.scope.clone().or_else(|| granted_scope(o)).as_deref() != Some(asked))
}

/// The scope the loopback client ID `oauth` was granted to names.
fn granted_scope(oauth: &OAuth) -> Option<String> {
    let id = Url::parse(oauth.loopback_id.as_deref()?).ok()?;
    id.query_pairs()
        .find(|(k, _)| k == "scope")
        .map(|(_, v)| v.into_owned())
}

/// Whether `err` is a PDS refusing a call for want of scope, the reference
/// PDS's `InvalidToken` saying so or OAuth's `ScopeMissingError`: from the
/// call itself, or carried in the words of a server it went through.
pub fn out_of_scope(err: &impl std::fmt::Display) -> bool {
    let said = format!("{err:#}");
    said.contains("Scope does not permit") || said.contains("ScopeMissingError")
}

/// The loopback client, which names its scope and redirect in its ID. The
/// redirect leaves out the port, so any port the listener gets matches.
pub fn client_id() -> String {
    let query = Url::parse_with_params(
        "http://localhost/",
        &[
            ("redirect_uri", format!("http://127.0.0.1{CALLBACK}")),
            ("scope", loopback_scope()),
        ],
    )
    .expect("a static URL");
    format!("http://localhost?{}", query.query().unwrap_or_default())
}

/// The DPoP nonce each server last sent, by origin.
static NONCES: Mutex<BTreeMap<String, String>> = Mutex::new(BTreeMap::new());

fn origin(url: &str) -> String {
    Url::parse(url)
        .map(|u| u.origin().ascii_serialization())
        .unwrap_or_default()
}

/// `bytes` random bytes, base64url.
pub fn random(bytes: usize) -> String {
    let mut buf = vec![0; bytes];
    rand_core::OsRng.fill_bytes(&mut buf);
    URL_SAFE_NO_PAD.encode(buf)
}

/// A PKCE challenge: SHA-256, base64url.
pub fn sha256(text: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(text.as_bytes()))
}

/// A DPoP proof that `key` holds the request `method` `url`, for the
/// access token `token` when it carries one.
pub fn proof(key: &P256Key, method: &str, url: &str, token: Option<&str>) -> String {
    let htu = Url::parse(url).map_or_else(
        |_| url.to_string(),
        |mut u| {
            u.set_query(None);
            u.set_fragment(None);
            u.to_string()
        },
    );
    let mut claims = json!({
        "jti": random(16),
        "htm": method,
        "htu": htu,
        "iat": keys::now_secs(),
    });
    if let Some(nonce) = NONCES.lock().unwrap().get(&origin(url)) {
        claims["nonce"] = nonce.as_str().into();
    }
    if let Some(token) = token {
        claims["ath"] = sha256(token).into();
    }
    key.sign_jwt(&json!({"typ": "dpop+jwt", "jwk": key.jwk()}), &claims)
}

/// Keeps the nonce a server's answer to `url` brings.
fn keep_nonce(url: &str, res: &reqwest::Response) {
    if let Some(nonce) = res
        .headers()
        .get("dpop-nonce")
        .and_then(|v| v.to_str().ok())
    {
        NONCES
            .lock()
            .unwrap()
            .insert(origin(url), nonce.to_string());
    }
}

/// Keeps the nonce a resource server's answer brings, and says whether it
/// refused the request for want of it, so that sending it again may pass.
pub fn nonce_refused(url: &str, res: &reqwest::Response) -> bool {
    keep_nonce(url, res);
    res.status() == reqwest::StatusCode::UNAUTHORIZED
        && res
            .headers()
            .get(reqwest::header::WWW_AUTHENTICATE)
            .and_then(|v| v.to_str().ok())
            .is_some_and(|v| v.contains("use_dpop_nonce"))
}

/// An authorization server's endpoints.
#[derive(Deserialize)]
struct Server {
    issuer: String,
    authorization_endpoint: String,
    token_endpoint: String,
    pushed_authorization_request_endpoint: String,
    revocation_endpoint: Option<String>,
}

async fn get_json<T: DeserializeOwned>(ctx: &Ctx, url: &str) -> Result<T> {
    let res = crate::telemetry::send(ctx.http.get(url), 0).await?;
    let res = res.error_for_status()?;
    Ok(res.json().await?)
}

/// The authorization server for accounts on `pds`.
async fn server(ctx: &Ctx, pds: &str) -> Result<Server> {
    #[derive(Deserialize)]
    struct Resource {
        authorization_servers: Vec<String>,
    }
    let pds = pds.trim_end_matches('/');
    let resource: Resource = get_json(ctx, &format!("{pds}/.well-known/oauth-protected-resource"))
        .await
        .with_context(|| format!("{pds} does not say where to log in with OAuth"))?;
    let issuer = resource
        .authorization_servers
        .into_iter()
        .next()
        .with_context(|| format!("{pds} names no authorization server"))?;
    let server: Server = get_json(
        ctx,
        &format!("{issuer}/.well-known/oauth-authorization-server"),
    )
    .await?;
    if server.issuer != issuer {
        bail!("{issuer} calls itself {}", server.issuer);
    }
    Ok(server)
}

/// A client of authorization servers: the command line's loopback client,
/// or grain-serve, a confidential client that proves who it is with its
/// key.
pub struct Client {
    pub id: String,
    key: Option<P256Key>,
}

/// The key ID a confidential client's assertions and JWKS name, which
/// stays what it is: a PDS binds each session to the key ID that
/// authenticated it, and refuses a refresh under another.
pub const KID: &str = "pds-client-auth-key";

impl Client {
    pub fn loopback() -> Client {
        Client {
            id: client_id(),
            key: None,
        }
    }

    /// The public client whose metadata document is at `id`, as grain's
    /// apps are: it proves who it is with nothing but PKCE and its DPoP
    /// key.
    pub fn public(id: &str) -> Client {
        Client {
            id: id.to_string(),
            key: None,
        }
    }

    /// The confidential client whose metadata document is at `id`, signing
    /// with `key`.
    pub fn confidential(id: &str, key: P256Key) -> Client {
        Client {
            id: id.to_string(),
            key: Some(key),
        }
    }

    /// The loopback client `oauth` was granted to, which refreshes it under
    /// the ID it was granted to, scope and all. A confidential client's
    /// session is refreshed by that client, which holds its key.
    pub fn granted(oauth: &OAuth) -> Result<Client> {
        if let Some(id) = &oauth.client_id {
            bail!("a session granted to {id}, which only that client can refresh");
        }
        Ok(Client {
            id: oauth.loopback_id.clone().unwrap_or_else(client_id),
            key: None,
        })
    }

    /// The public key, as the JWKS in a confidential client's metadata.
    pub fn jwks(&self) -> Value {
        let keys: Vec<Value> = self
            .key
            .iter()
            .map(|key| {
                let mut jwk = key.jwk();
                jwk["kid"] = KID.into();
                jwk["alg"] = "ES256".into();
                jwk["use"] = "sig".into();
                jwk
            })
            .collect();
        json!({ "keys": keys })
    }

    /// The client metadata document a confidential client serves at its
    /// ID: named `name`, the browser coming back to one of `redirect_uris`,
    /// and asking for at most `scope`, which a server may hold every
    /// request to.
    pub fn metadata(&self, name: &str, redirect_uris: &[&str], scope: &str) -> Value {
        let base = Url::parse(&self.id)
            .ok()
            .map(|u| u.origin().ascii_serialization());
        json!({
            "client_id": self.id,
            "client_name": name,
            "client_uri": base,
            "application_type": "web",
            "grant_types": ["authorization_code", "refresh_token"],
            "response_types": ["code"],
            "redirect_uris": redirect_uris,
            "scope": scope,
            "token_endpoint_auth_method": "private_key_jwt",
            "token_endpoint_auth_signing_alg": "ES256",
            "dpop_bound_access_tokens": true,
            "jwks": self.jwks(),
        })
    }

    /// The form fields that name the client to the server `issuer`, with an
    /// assertion signed by its key if it has one.
    fn fields(&self, issuer: &str) -> Vec<(&'static str, String)> {
        let mut fields = vec![("client_id", self.id.clone())];
        if let Some(key) = &self.key {
            let now = keys::now_secs();
            let claims = json!({
                "iss": self.id,
                "sub": self.id,
                "aud": issuer,
                "jti": random(16),
                "iat": now,
                "exp": now + 60,
            });
            fields.push((
                "client_assertion_type",
                "urn:ietf:params:oauth:client-assertion-type:jwt-bearer".into(),
            ));
            fields.push((
                "client_assertion",
                key.sign_jwt(&json!({ "kid": KID }), &claims),
            ));
        }
        fields
    }
}

/// Posts `form` from `client` to the server `issuer`, with a DPoP proof of
/// `key`. An empty answer reads as `null`.
async fn post<T: DeserializeOwned>(
    ctx: &Ctx,
    url: &str,
    key: &P256Key,
    client: &Client,
    issuer: &str,
    form: &[(&str, &str)],
) -> Result<T> {
    let attempt = |resend| async move {
        let mut fields: Vec<(&str, String)> =
            form.iter().map(|(k, v)| (*k, v.to_string())).collect();
        fields.extend(client.fields(issuer));
        let req = ctx
            .http
            .post(url)
            .header("dpop", proof(key, "POST", url, None));
        let res = crate::telemetry::send(req.form(&fields), resend).await?;
        keep_nonce(url, &res);
        let ok = res.status().is_success();
        let body = res.bytes().await?;
        anyhow::Ok((ok, serde_json::from_slice(&body).unwrap_or(Value::Null)))
    };
    let mut answer = attempt(0).await?;
    if answer.1["error"] == "use_dpop_nonce" {
        answer = attempt(1).await?;
    }
    let (ok, value) = answer;
    if !ok {
        return Err(Refused {
            error: value["error"].as_str().unwrap_or("refused").to_string(),
            description: value["error_description"]
                .as_str()
                .unwrap_or_default()
                .to_string(),
        }
        .into());
    }
    Ok(serde_json::from_value(value)?)
}

/// An authorization server refusing a request, as OAuth answers: its
/// `error` and `error_description`. A refresh refused `invalid_grant` is
/// a session that has ended, which no retry brings back.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Refused {
    pub error: String,
    pub description: String,
}

impl Refused {
    /// The refusal `err` is, if it is one.
    pub fn of(err: &anyhow::Error) -> Option<&Refused> {
        err.downcast_ref()
    }
}

impl std::fmt::Display for Refused {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.error, self.description)
    }
}

impl std::error::Error for Refused {}

#[derive(Deserialize)]
struct Tokens {
    access_token: String,
    refresh_token: String,
    expires_in: u64,
    sub: String,
}

fn expires_at(tokens: &Tokens) -> u64 {
    keys::now_secs() + tokens.expires_in
}

/// An authorization request pushed to the account's server, waiting for
/// the user to approve it.
pub struct Request {
    /// The page where the user approves it.
    pub url: String,
    /// Names the request in the browser's return.
    pub state: String,
    /// Who the user said they are: none for an account they are making.
    id: Option<Identity>,
    server: Server,
    key: P256Key,
    verifier: String,
    redirect_uri: String,
    scope: String,
}

/// Pushes a request for `client` to act as `id` with `scope`, the browser
/// coming back to `redirect_uri`. `hint` is who the user said they are.
pub async fn authorize(
    ctx: &Ctx,
    client: &Client,
    id: Identity,
    hint: &str,
    redirect_uri: &str,
    scope: &str,
) -> Result<Request> {
    let server = server(ctx, &id.pds).await?;
    let hint = ("login_hint", hint.trim_start_matches('@'));
    push(ctx, client, server, Some(id), hint, redirect_uri, scope).await
}

/// Pushes a request for `client` to act with `scope` as an account the
/// user makes on `pds` first, on the sign-up page its authorization server
/// shows for `prompt=create`: who they are is known once it is redeemed.
pub async fn sign_up(
    ctx: &Ctx,
    client: &Client,
    pds: &str,
    redirect_uri: &str,
    scope: &str,
) -> Result<Request> {
    let server = server(ctx, pds).await?;
    let prompt = ("prompt", "create");
    push(ctx, client, server, None, prompt, redirect_uri, scope).await
}

/// Pushes a request to `server`, `asking` with a login hint or a prompt,
/// for `id` if it is known.
async fn push(
    ctx: &Ctx,
    client: &Client,
    server: Server,
    id: Option<Identity>,
    asking: (&str, &str),
    redirect_uri: &str,
    scope: &str,
) -> Result<Request> {
    let key = P256Key::generate();
    let verifier = random(32);
    let state = random(16);
    #[derive(Deserialize)]
    struct Pushed {
        request_uri: String,
    }
    let pushed: Pushed = post(
        ctx,
        &server.pushed_authorization_request_endpoint,
        &key,
        client,
        &server.issuer,
        &[
            ("response_type", "code"),
            ("code_challenge", &sha256(&verifier)),
            ("code_challenge_method", "S256"),
            ("redirect_uri", redirect_uri),
            ("scope", scope),
            ("state", state.as_str()),
            asking,
        ],
    )
    .await?;
    let mut url = Url::parse(&server.authorization_endpoint)?;
    url.query_pairs_mut()
        .append_pair("client_id", &client.id)
        .append_pair("request_uri", &pushed.request_uri);
    Ok(Request {
        url: url.to_string(),
        state,
        id,
        server,
        key,
        verifier,
        redirect_uri: redirect_uri.to_string(),
        scope: scope.to_string(),
    })
}

impl Request {
    /// Trades the code in `params`, the query the browser came back with,
    /// for a session for `client`, which is not stored and has no handle.
    pub async fn redeem(
        self,
        ctx: &Ctx,
        client: &Client,
        params: &HashMap<String, String>,
    ) -> Result<Session> {
        let iss = params.get("iss").unwrap_or(&self.server.issuer);
        if params.get("state") != Some(&self.state) || iss != &self.server.issuer {
            bail!("the browser came back from a login this one did not start");
        }
        let Some(code) = params.get("code") else {
            bail!(
                "the login was refused: {}",
                params
                    .get("error_description")
                    .or(params.get("error"))
                    .map_or("no reason given", String::as_str)
            );
        };
        let tokens: Tokens = post(
            ctx,
            &self.server.token_endpoint,
            &self.key,
            client,
            &self.server.issuer,
            &[
                ("grant_type", "authorization_code"),
                ("code", code),
                ("redirect_uri", &self.redirect_uri),
                ("code_verifier", &self.verifier),
            ],
        )
        .await?;
        let id = match self.id {
            Some(id) => id,
            None => made(ctx, &tokens.sub, &self.server.issuer).await?,
        };
        if tokens.sub != id.did {
            bail!("logged in as {}, not {}", tokens.sub, id.did);
        }
        Ok(Session {
            did: tokens.sub.clone(),
            handle: String::new(),
            service: id.pds,
            access_jwt: tokens.access_token.clone(),
            refresh_jwt: tokens.refresh_token.clone(),
            oauth: Some(OAuth {
                key: STANDARD.encode(self.key.to_bytes()),
                issuer: self.server.issuer,
                token_endpoint: self.server.token_endpoint,
                revocation_endpoint: self.server.revocation_endpoint,
                client_id: client.key.as_ref().map(|_| client.id.clone()),
                loopback_id: client.key.is_none().then(|| client.id.clone()),
                scope: Some(self.scope),
                expires_at: expires_at(&tokens),
            }),
        })
    }
}

/// The account `did`, which a sign-up at the server `issuer` made. As
/// atproto's OAuth asks, it is taken only if its PDS logs in there: else
/// any server could name any account.
async fn made(ctx: &Ctx, did: &str, issuer: &str) -> Result<Identity> {
    let id = identity::resolve(ctx, did).await?;
    let theirs = server(ctx, &id.pds).await?.issuer;
    anyhow::ensure!(theirs == issuer, "{did} logs in at {theirs}, not {issuer}");
    Ok(id)
}

/// `session`, a redeemed one, with its account's handle, as its PDS says.
pub async fn named(ctx: &Ctx, mut session: Session) -> Result<Session> {
    #[derive(Deserialize)]
    struct Who {
        handle: String,
    }
    let who: Who = Xrpc::new(ctx.http.clone(), &session.service)
        .query("com.atproto.server.getSession", &[], Some(&session.auth()))
        .await?;
    session.handle = who.handle;
    Ok(session)
}

/// A login waiting for the user to approve it in a browser.
pub struct Pending {
    /// The page where the user approves the login.
    pub url: String,
    /// Where the browser comes back to.
    pub redirect_uri: String,
    listener: TcpListener,
    request: Request,
}

/// Starts logging in as `identifier`, a DID or a handle with or without
/// its `@`: pushes the authorization request and listens for the
/// browser's return.
pub async fn start(ctx: &Ctx, identifier: &str) -> Result<Pending> {
    let identifier = identifier.trim_start_matches('@');
    let id = identity::resolve(ctx, identifier).await?;
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let redirect_uri = format!(
        "http://127.0.0.1:{}{CALLBACK}",
        listener.local_addr()?.port()
    );
    let request = authorize(
        ctx,
        &Client::loopback(),
        id,
        identifier,
        &redirect_uri,
        &loopback_scope(),
    )
    .await?;
    Ok(Pending {
        url: request.url.clone(),
        redirect_uri,
        listener,
        request,
    })
}

/// What the browser shows once it is back.
const DONE: &str = "<!doctype html><meta charset=utf-8><title>grain</title>\
<p>Back to grain: you can close this tab and return to your terminal.";

impl Pending {
    /// Waits for the browser, trades the code for tokens, and stores the
    /// session.
    pub async fn finish(self, ctx: &Ctx) -> Result<Session> {
        let params = self.callback().await?;
        let session = self
            .request
            .redeem(ctx, &Client::loopback(), &params)
            .await?;
        let session = named(ctx, session).await?;
        crate::session::save(ctx, &session)?;
        Ok(session)
    }

    /// The query the browser comes back with. Anything else it asks the
    /// listener for, such as an icon, is not found.
    async fn callback(&self) -> Result<HashMap<String, String>> {
        loop {
            let (mut stream, _) = self.listener.accept().await?;
            let mut buf = vec![0; 16 * 1024];
            let n = stream.read(&mut buf).await?;
            let head = String::from_utf8_lossy(&buf[..n]);
            let target = head.split(' ').nth(1).unwrap_or_default();
            let url = Url::parse(&format!("http://127.0.0.1{target}"))
                .ok()
                .filter(|u| u.path() == CALLBACK);
            let Some(url) = url else {
                stream
                    .write_all(
                        b"HTTP/1.1 404 Not Found\r\ncontent-length: 0\r\nconnection: close\r\n\r\n",
                    )
                    .await?;
                continue;
            };
            let reply = format!(
                "HTTP/1.1 200 OK\r\ncontent-type: text/html; charset=utf-8\r\n\
                 content-length: {}\r\nconnection: close\r\n\r\n{DONE}",
                DONE.len()
            );
            stream.write_all(reply.as_bytes()).await?;
            return Ok(url.query_pairs().into_owned().collect());
        }
    }
}

#[cfg(target_os = "macos")]
const OPENER: &str = "open";
#[cfg(not(target_os = "macos"))]
const OPENER: &str = "xdg-open";

/// Opens `url` in the user's browser: `GRAIN_BROWSER`, a command the URL
/// is added to, else the system's opener. Whether it opens or not, the URL
/// has been shown.
pub fn open(ctx: &Ctx, url: &str) {
    let command = ctx.env.browser.as_deref().unwrap_or(OPENER);
    let mut words = command.split_whitespace();
    if let Some(program) = words.next() {
        let _ = tokio::process::Command::new(program)
            .args(words)
            .arg(url)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .spawn();
    }
}

/// `stored`, an OAuth session granted to `client`, with new tokens. The
/// refresh token it held is spent: whoever keeps the session keeps this
/// one in its place, and refreshes it one at a time
/// ([`crate::session::ensure`] does, for sessions kept on disk).
pub async fn refresh(
    ctx: &Ctx,
    client: &Client,
    stored: &Session,
    oauth: &OAuth,
) -> Result<Session> {
    let tokens: Tokens = post(
        ctx,
        &oauth.token_endpoint,
        &oauth.key()?,
        client,
        &oauth.issuer,
        &[
            ("grant_type", "refresh_token"),
            ("refresh_token", &stored.refresh_jwt),
        ],
    )
    .await?;
    if tokens.sub != stored.did {
        bail!("refreshed as {}, not {}", tokens.sub, stored.did);
    }
    Ok(Session {
        access_jwt: tokens.access_token.clone(),
        refresh_jwt: tokens.refresh_token.clone(),
        oauth: Some(OAuth {
            expires_at: expires_at(&tokens),
            ..oauth.clone()
        }),
        ..stored.clone()
    })
}

/// A session for an account a server makes for `client` outside the
/// browser's way, such as a group a group host founds: `body` is posted
/// as JSON to `url` from `client`, its assertion addressed to `url`'s
/// origin, with a DPoP proof of a key made for the session and
/// `authorization` beside it, the service token of whoever asked for the
/// account. The answer is an OAuth token response, as its `session` or as
/// the whole of it, for its `sub`, with `scope` what `body` asked for.
/// It is taken only if `url` is on the account's own authorization
/// server: else any server could hand over any account. A refusal is
/// [`Refused`], with the error and message the server said.
pub async fn provisioned(
    ctx: &Ctx,
    client: &Client,
    url: &str,
    body: &Value,
    authorization: &str,
) -> Result<Session> {
    let key = P256Key::generate();
    let at = origin(url);
    // Each try is a new assertion: a server refuses one it has seen.
    let attempt = |resend| {
        let mut sent = body.clone();
        for (name, value) in client.fields(&at) {
            sent[name] = value.into();
        }
        let req = ctx
            .http
            .post(url)
            .header("authorization", authorization)
            .header("dpop", proof(&key, "POST", url, None))
            .json(&sent);
        async move {
            let res = crate::telemetry::send(req, resend).await?;
            keep_nonce(url, &res);
            let ok = res.status().is_success();
            let body = res.bytes().await?;
            anyhow::Ok((ok, serde_json::from_slice(&body).unwrap_or(Value::Null)))
        }
    };
    let mut answer = attempt(0).await?;
    if answer.1["error"] == "use_dpop_nonce" {
        answer = attempt(1).await?;
    }
    let (ok, value) = answer;
    if !ok {
        let said = |name: &str| value[name].as_str().map(str::to_string);
        return Err(Refused {
            error: said("error").unwrap_or_else(|| "refused".into()),
            description: said("message")
                .or_else(|| said("error_description"))
                .unwrap_or_default(),
        }
        .into());
    }
    #[derive(Deserialize)]
    struct Handed {
        access_token: String,
        #[serde(default)]
        refresh_token: String,
        expires_in: u64,
        sub: String,
    }
    let handed = match value.get("session") {
        Some(session) if session.is_object() => session.clone(),
        _ => value,
    };
    let handed: Handed =
        serde_json::from_value(handed).with_context(|| format!("{url} handed over no session"))?;
    let id = identity::resolve(ctx, &handed.sub).await?;
    let server = server(ctx, &id.pds).await?;
    if origin(&server.issuer) != at {
        bail!("{at} is not where {} logs in", handed.sub);
    }
    Ok(Session {
        did: handed.sub,
        handle: String::new(),
        service: id.pds,
        access_jwt: handed.access_token,
        refresh_jwt: handed.refresh_token,
        oauth: Some(OAuth {
            key: STANDARD.encode(key.to_bytes()),
            issuer: server.issuer,
            token_endpoint: server.token_endpoint,
            revocation_endpoint: server.revocation_endpoint,
            client_id: client.key.as_ref().map(|_| client.id.clone()),
            loopback_id: client.key.is_none().then(|| client.id.clone()),
            scope: body["scope"].as_str().map(str::to_string),
            expires_at: keys::now_secs() + handed.expires_in,
        }),
    })
}

/// Revokes an OAuth session's tokens, granted to `client`, as far as its
/// server lets it.
pub async fn revoke(ctx: &Ctx, client: &Client, session: &Session, oauth: &OAuth) -> Result<()> {
    let Some(endpoint) = &oauth.revocation_endpoint else {
        return Ok(());
    };
    post::<serde::de::IgnoredAny>(
        ctx,
        endpoint,
        &oauth.key()?,
        client,
        &oauth.issuer,
        &[("token", &session.refresh_jwt)],
    )
    .await
    .map(drop)
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use crate::crypto;
    use crate::env::Env;
    use axum::extract::{Form, State};
    use axum::http::{HeaderMap, StatusCode};
    use axum::response::{IntoResponse, Response};
    use axum::routing::{get, post};
    use axum::{Json, Router};
    use std::sync::Arc;

    #[test]
    fn sessions_behind_what_is_asked() {
        let mut session = Session {
            did: "did:plc:a".into(),
            handle: String::new(),
            service: String::new(),
            access_jwt: String::new(),
            refresh_jwt: String::new(),
            oauth: None,
        };
        assert!(!behind(&session, SCOPE), "an app password is never behind");
        session.oauth = Some(OAuth {
            key: String::new(),
            issuer: String::new(),
            token_endpoint: String::new(),
            revocation_endpoint: None,
            client_id: None,
            loopback_id: None,
            scope: None,
            expires_at: 0,
        });
        assert!(behind(&session, SCOPE), "kept before its scope was");
        session.oauth.as_mut().unwrap().loopback_id = Some(client_id());
        assert!(
            !behind(&session, &loopback_scope()),
            "the loopback client's ID names it"
        );
        session.oauth.as_mut().unwrap().loopback_id = None;
        session.oauth.as_mut().unwrap().scope = Some("atproto".into());
        assert!(behind(&session, SCOPE));
        session.oauth.as_mut().unwrap().scope = Some(SCOPE.into());
        assert!(!behind(&session, SCOPE));
    }

    #[test]
    fn refusals_for_want_of_scope() {
        let refused = crate::xrpc::XrpcError {
            status: 403,
            error: "InvalidToken".into(),
            message: "Scope does not permit create on social.grain.photo".into(),
            reset: None,
        };
        let err = anyhow::Error::new(refused).context("posting");
        assert!(out_of_scope(&err));
        assert!(out_of_scope(&"ScopeMissingError (403): no"));
        assert!(!out_of_scope(&anyhow::anyhow!(
            "Forbidden (403): not yours"
        )));
    }

    #[test]
    fn refusals_are_known_by_their_error() {
        let refused = Refused {
            error: "invalid_grant".into(),
            description: "refresh token replayed".into(),
        };
        let err = anyhow::Error::new(refused.clone()).context("refreshing");
        assert_eq!(Refused::of(&err), Some(&refused));
        assert_eq!(refused.to_string(), "invalid_grant: refresh token replayed");
        assert!(Refused::of(&anyhow::anyhow!("down")).is_none());
    }

    #[test]
    fn proofs() {
        let key = P256Key::generate();
        let token = proof(&key, "GET", "http://pds.test:1/xrpc/x?y=1#z", Some("tok"));
        let (header, claims) = crypto::jwt_parts(&token).unwrap();
        assert_eq!(header["typ"], "dpop+jwt");
        assert_eq!(header["jwk"], key.jwk());
        assert_eq!(claims["htu"], "http://pds.test:1/xrpc/x");
        assert_eq!(claims["htm"], "GET");
        assert_eq!(claims["ath"], sha256("tok"));
        assert!(claims.get("nonce").is_none());
        let (signed, sig) = token.rsplit_once('.').unwrap();
        let sig = URL_SAFE_NO_PAD.decode(sig).unwrap();
        assert!(key.public().verify(signed.as_bytes(), &sig));
        // Not a URL: proved as it is.
        let (_, claims) = crypto::jwt_parts(&proof(&key, "POST", "nowhere", None)).unwrap();
        assert_eq!(claims["htu"], "nowhere");
        assert!(claims.get("ath").is_none());
        assert_eq!(origin("nowhere"), "");
    }

    #[test]
    fn loopback_client() {
        let id = client_id();
        assert!(id.starts_with(
            "http://localhost?redirect_uri=http%3A%2F%2F127.0.0.1%2Fcallback&scope=atproto+"
        ));
        assert!(SCOPE.contains(" repo:social.grain.photo "));
        assert!(SCOPE.contains(" blob:image/* "));
        assert!(SCOPE.ends_with(" repo:app.bsky.feed.post?action=create&action=update"));
        assert!(!SCOPE.contains("transition:"));
        assert!(!SCOPE.contains("  "));
        assert_eq!(scope(false), SCOPE);
        let spaces = scope(true);
        assert!(spaces.starts_with(&format!("{SCOPE} space:social.grain.group?")));
        assert!(!spaces.contains("  ") && !spaces.ends_with(' '));
        assert_eq!(spaces.split(' ').count(), SCOPE.split(' ').count() + 10);
        // It may call the appview's moderation as the account, as the
        // web's client, which asks SCOPE alone, may not.
        let loopback = loopback_scope();
        assert!(loopback.starts_with(SCOPE));
        assert!(loopback.ends_with(" rpc:social.grain.admin.getReviewSubject?aud=*"));
        assert!(loopback.contains(" rpc:com.atproto.moderation.createReport?aud=*"));
        assert!(
            id.contains("rpc%3Asocial.grain.admin.listReports%3Faud%3D*"),
            "{id}"
        );
        let client = Client::loopback();
        assert_eq!(client.id, id);
        assert_eq!(client.jwks(), json!({"keys": []}));
        assert_eq!(client.fields("http://as.test"), [("client_id", id)]);
    }

    #[test]
    fn granted_clients() {
        let mut oauth = OAuth {
            key: String::new(),
            issuer: String::new(),
            token_endpoint: String::new(),
            revocation_endpoint: None,
            client_id: None,
            loopback_id: None,
            scope: None,
            expires_at: 0,
        };
        assert_eq!(Client::granted(&oauth).unwrap().id, client_id());
        oauth.loopback_id = Some("http://localhost?scope=atproto".into());
        assert_eq!(
            Client::granted(&oauth).unwrap().id,
            "http://localhost?scope=atproto"
        );
        oauth.client_id = Some("https://grain.social/oauth-client-metadata.json".into());
        assert!(Client::granted(&oauth).is_err());
    }

    #[test]
    fn a_confidential_client() {
        let key = P256Key::generate();
        let public = key.public();
        let id = "https://grain.social/oauth-client-metadata.json";
        let client = Client::confidential(id, key);
        let jwks = client.jwks();
        assert_eq!(jwks["keys"][0]["kid"], KID);
        assert_eq!(jwks["keys"][0]["alg"], "ES256");
        assert_eq!(jwks["keys"][0]["crv"], "P-256");
        assert!(jwks["keys"][0].get("d").is_none(), "no secret in the JWKS");

        let back = "https://grain.social/oauth/callback";
        let doc = client.metadata("grain", &[back], SCOPE);
        assert_eq!(doc["client_id"], id);
        assert_eq!(doc["client_uri"], "https://grain.social");
        assert_eq!(doc["redirect_uris"], json!([back]));
        assert_eq!(doc["scope"], SCOPE);
        assert_eq!(doc["token_endpoint_auth_method"], "private_key_jwt");
        assert!(doc["dpop_bound_access_tokens"].as_bool().unwrap());
        assert_eq!(doc["jwks"], jwks);

        let fields: HashMap<&str, String> = client.fields("https://as.test").into_iter().collect();
        assert_eq!(fields["client_id"], id);
        assert_eq!(
            fields["client_assertion_type"],
            "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"
        );
        let claims: Value = crypto::verify_jwt(&fields["client_assertion"], &public).unwrap();
        assert_eq!(
            (claims["iss"].as_str(), claims["sub"].as_str()),
            (Some(id), Some(id))
        );
        assert_eq!(claims["aud"], "https://as.test");
        let (header, _) = crypto::jwt_parts(&fields["client_assertion"]).unwrap();
        assert_eq!(header["kid"], KID);
    }

    /// What the stand-in authorization server and PDS saw.
    #[derive(Default)]
    pub(crate) struct Seen {
        pub(crate) base: String,
        /// The last request pushed, as its form.
        pub(crate) pushed: Option<HashMap<String, String>>,
        /// Each form the token endpoint answered with tokens.
        pub(crate) tokens: Vec<HashMap<String, String>>,
        /// Each token revoked.
        pub(crate) revoked: Vec<String>,
        /// Whether the PDS has refused a proof for want of its nonce yet.
        pub(crate) asked_pds_nonce: bool,
        /// Each refresh asked for, refused or not.
        pub(crate) refreshes: u32,
    }

    pub(crate) type Shared = Arc<Mutex<Seen>>;

    /// The DPoP proof in `headers`, checked against its own key.
    fn proven(headers: &HeaderMap) -> Value {
        let proof = headers["dpop"].to_str().unwrap();
        let (header, _) = crypto::jwt_parts(proof).unwrap();
        let jwk = &header["jwk"];
        let coordinate = |c: &str| URL_SAFE_NO_PAD.decode(jwk[c].as_str().unwrap()).unwrap();
        let point = [vec![4], coordinate("x"), coordinate("y")].concat();
        let key =
            crypto::PublicKey::P256(p256::ecdsa::VerifyingKey::from_sec1_bytes(&point).unwrap());
        let (signed, sig) = proof.rsplit_once('.').unwrap();
        let sig = URL_SAFE_NO_PAD.decode(sig).unwrap();
        assert!(key.verify(signed.as_bytes(), &sig));
        crypto::jwt_parts(proof).unwrap().1
    }

    fn refused(error: &str) -> Response {
        let body = Json(json!({"error": error, "error_description": "said so"}));
        (StatusCode::BAD_REQUEST, [("dpop-nonce", "n1")], body).into_response()
    }

    async fn par(
        State(seen): State<Shared>,
        headers: HeaderMap,
        Form(form): Form<HashMap<String, String>>,
    ) -> Response {
        let mut seen = seen.lock().unwrap();
        let claims = proven(&headers);
        if claims["nonce"] != "n1" {
            return refused("use_dpop_nonce");
        }
        assert_eq!(claims["htm"], "POST");
        seen.pushed = Some(form);
        Json(json!({"request_uri": "urn:request:1", "expires_in": 60})).into_response()
    }

    async fn token(
        State(seen): State<Shared>,
        headers: HeaderMap,
        Form(form): Form<HashMap<String, String>>,
    ) -> Response {
        let mut seen = seen.lock().unwrap();
        let claims = proven(&headers);
        if claims["nonce"] != "n1" {
            return refused("use_dpop_nonce");
        }
        let pushed = seen.pushed.clone().unwrap_or_default();
        match form["grant_type"].as_str() {
            "authorization_code" => {
                if form["code"] != "code-1" {
                    return refused("invalid_grant");
                }
                assert_eq!(sha256(&form["code_verifier"]), pushed["code_challenge"]);
                assert_eq!(form["redirect_uri"], pushed["redirect_uri"]);
            }
            _ => {
                seen.refreshes += 1;
                if form["refresh_token"] == "spent" {
                    return refused("invalid_grant");
                }
            }
        }
        let n = seen.tokens.len();
        seen.tokens.push(form);
        Json(json!({
            "access_token": format!("access-{n}"),
            "refresh_token": format!("refresh-{n}"),
            "token_type": "DPoP",
            "expires_in": 3600,
            "scope": pushed.get("scope").map_or("atproto", String::as_str),
            "sub": "did:plc:alice",
        }))
        .into_response()
    }

    async fn revoke_token(
        State(seen): State<Shared>,
        Form(form): Form<HashMap<String, String>>,
    ) -> StatusCode {
        seen.lock().unwrap().revoked.push(form["token"].clone());
        StatusCode::OK
    }

    async fn get_session(State(seen): State<Shared>, headers: HeaderMap) -> Response {
        let mut seen = seen.lock().unwrap();
        let claims = proven(&headers);
        let authorization = headers["authorization"].to_str().unwrap();
        let token = authorization.strip_prefix("DPoP ").unwrap();
        assert_eq!(claims["ath"], sha256(token));
        if !seen.asked_pds_nonce {
            seen.asked_pds_nonce = true;
            let challenge = r#"DPoP error="use_dpop_nonce""#;
            let headers = [("www-authenticate", challenge), ("dpop-nonce", "p1")];
            return (StatusCode::UNAUTHORIZED, headers).into_response();
        }
        assert_eq!(claims["nonce"], "p1");
        Json(json!({"did": "did:plc:alice", "handle": "alice.test"})).into_response()
    }

    /// An authorization server and PDS in one, as the reference PDS is, at
    /// the URL it returns: it asks for a DPoP nonce once at each, checks
    /// the PKCE verifier against the challenge pushed, and resolves every
    /// handle to `did:plc:alice`.
    pub(crate) async fn authorization_server() -> (String, Shared) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        let seen: Shared = Arc::new(Mutex::new(Seen {
            base: base.clone(),
            ..Seen::default()
        }));
        let resource = |State(seen): State<Shared>| async move {
            let base = seen.lock().unwrap().base.clone();
            Json(json!({"resource": base, "authorization_servers": [base]}))
        };
        let metadata = |State(seen): State<Shared>| async move {
            let base = seen.lock().unwrap().base.clone();
            Json(json!({
                "issuer": base,
                "authorization_endpoint": format!("{base}/oauth/authorize"),
                "token_endpoint": format!("{base}/oauth/token"),
                "pushed_authorization_request_endpoint": format!("{base}/oauth/par"),
                "revocation_endpoint": format!("{base}/oauth/revoke"),
            }))
        };
        let app = Router::new()
            .route("/.well-known/oauth-protected-resource", get(resource))
            .route("/.well-known/oauth-authorization-server", get(metadata))
            .route("/oauth/par", post(par))
            .route("/oauth/token", post(token))
            .route("/oauth/revoke", post(revoke_token))
            .route("/xrpc/com.atproto.server.getSession", get(get_session))
            .route(
                "/xrpc/com.atproto.identity.resolveHandle",
                get(|| async { Json(json!({"did": "did:plc:alice"})) }),
            )
            .with_state(seen.clone());
        tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
        (base, seen)
    }

    /// A context whose every account is on `pds`, which resolves handles
    /// too, its files under `dir`.
    pub(crate) fn ctx_on(pds: &str, dir: &std::path::Path) -> Ctx {
        let dir = dir.to_str().unwrap().to_string();
        let pds = pds.to_string();
        Ctx::new(Env::from_vars(|k| match k {
            "GRAIN_SERVICE" | "GRAIN_HANDLE_RESOLVER" => Some(pds.clone()),
            "GRAIN_CONFIG_DIR" => Some(format!("{dir}/config")),
            "GRAIN_CACHE_DIR" => Some(format!("{dir}/cache")),
            "GRAIN_BROWSER" => Some("true".into()),
            _ => None,
        }))
    }

    #[tokio::test]
    async fn a_login_from_the_command_line() {
        let (base, seen) = authorization_server().await;
        let dir = tempfile::tempdir().unwrap();
        let ctx = ctx_on(&base, dir.path());
        let pending = start(&ctx, "@alice.test").await.unwrap();
        let page = Url::parse(&pending.url).unwrap();
        assert_eq!(page.path(), "/oauth/authorize");
        let query: HashMap<String, String> = page.query_pairs().into_owned().collect();
        assert_eq!(query["client_id"], client_id());
        assert_eq!(query["request_uri"], "urn:request:1");
        let pushed = seen.lock().unwrap().pushed.clone().unwrap();
        assert_eq!(pushed["login_hint"], "alice.test");
        assert_eq!(pushed["scope"], loopback_scope());
        assert_eq!(pushed["code_challenge_method"], "S256");
        assert_eq!(pushed["redirect_uri"], pending.redirect_uri);
        assert_eq!(pushed["client_id"], client_id());
        assert!(!pushed.contains_key("client_assertion"));
        open(&ctx, &pending.url);

        // The browser comes back, asking first for an icon.
        let back = pending.redirect_uri.clone();
        let state = pushed["state"].clone();
        let iss = base.clone();
        let browser = tokio::spawn(async move {
            let http = reqwest::Client::new();
            let origin = back.trim_end_matches(CALLBACK);
            let icon = http.get(format!("{origin}/favicon.ico")).send().await;
            assert_eq!(icon.unwrap().status(), 404);
            let query = [
                ("state", state.as_str()),
                ("code", "code-1"),
                ("iss", iss.as_str()),
            ];
            let done = http.get(&back).query(&query).send().await.unwrap();
            done.text().await.unwrap()
        });
        let session = pending.finish(&ctx).await.unwrap();
        assert!(browser.await.unwrap().contains("Back to grain"));
        assert_eq!(session.did, "did:plc:alice");
        assert_eq!(session.handle, "alice.test");
        assert_eq!(session.service, base);
        assert_eq!(session.access_jwt, "access-0");
        let oauth = session.oauth.clone().unwrap();
        assert_eq!(oauth.issuer, base);
        assert_eq!(oauth.loopback_id, Some(client_id()));
        assert_eq!(oauth.client_id, None);
        assert_eq!(oauth.scope, Some(loopback_scope()));
        assert!(oauth.expires_at > keys::now_secs() + 3000);
        assert!(!behind(&session, &loopback_scope()));
        assert_eq!(
            crate::session::load(&ctx, &session.did),
            Some(session.clone())
        );

        // Refreshed, it holds the new tokens and the same key.
        let client = Client::granted(&oauth).unwrap();
        let fresh = refresh(&ctx, &client, &session, &oauth).await.unwrap();
        assert_eq!(fresh.access_jwt, "access-1");
        assert_eq!(fresh.refresh_jwt, "refresh-1");
        assert_eq!(fresh.oauth.as_ref().unwrap().key, oauth.key);
        let form = seen.lock().unwrap().tokens[1].clone();
        assert_eq!(form["refresh_token"], "refresh-0");
        let spent = Session {
            refresh_jwt: "spent".into(),
            ..session.clone()
        };
        let why = refresh(&ctx, &client, &spent, &oauth).await.unwrap_err();
        assert_eq!(why.to_string(), "invalid_grant: said so");

        revoke(&ctx, &client, &fresh, &oauth).await.unwrap();
        assert_eq!(seen.lock().unwrap().revoked, ["refresh-1"]);
        let unrevocable = OAuth {
            revocation_endpoint: None,
            ..oauth.clone()
        };
        revoke(&ctx, &client, &fresh, &unrevocable).await.unwrap();
        assert_eq!(seen.lock().unwrap().revoked.len(), 1);
    }

    #[tokio::test]
    async fn a_confidential_login_and_a_sign_up() {
        let (base, seen) = authorization_server().await;
        let dir = tempfile::tempdir().unwrap();
        let ctx = ctx_on(&base, dir.path());
        let key = P256Key::generate();
        let public = key.public();
        let id = "https://grain.test/oauth-client-metadata.json";
        let client = Client::confidential(id, key);
        let back = "https://grain.test/oauth/callback";
        let alice = identity::resolve(&ctx, "did:plc:alice").await.unwrap();
        let request = authorize(&ctx, &client, alice, "did:plc:alice", back, "atproto")
            .await
            .unwrap();
        let pushed = seen.lock().unwrap().pushed.clone().unwrap();
        let assertion = &pushed["client_assertion"];
        let claims: Value = crypto::verify_jwt(assertion, &public).unwrap();
        assert_eq!(claims["aud"], base);
        let state = request.state.clone();
        let params = |pairs: &[(&str, &str)]| -> HashMap<String, String> {
            pairs
                .iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect()
        };
        let session = request
            .redeem(
                &ctx,
                &client,
                &params(&[("state", state.as_str()), ("code", "code-1")]),
            )
            .await
            .unwrap();
        let oauth = session.oauth.clone().unwrap();
        assert_eq!(oauth.client_id.as_deref(), Some(id));
        assert_eq!(oauth.loopback_id, None);
        assert!(Client::granted(&oauth).is_err());
        assert_eq!(session.handle, "", "not named until asked");

        // A sign-up learns who it made from the tokens, and takes them
        // only as its PDS logs in at the same server.
        let request = sign_up(&ctx, &client, &base, back, "atproto")
            .await
            .unwrap();
        let pushed = seen.lock().unwrap().pushed.clone().unwrap();
        assert_eq!(pushed["prompt"], "create");
        assert!(!pushed.contains_key("login_hint"));
        let state = request.state.clone();
        let made = request
            .redeem(
                &ctx,
                &client,
                &params(&[("state", state.as_str()), ("code", "code-1")]),
            )
            .await
            .unwrap();
        assert_eq!(made.did, "did:plc:alice");
        assert_eq!(made.service, base);
    }

    #[tokio::test]
    async fn returns_this_login_did_not_start() {
        let (base, _) = authorization_server().await;
        let dir = tempfile::tempdir().unwrap();
        let ctx = ctx_on(&base, dir.path());
        let client = Client::loopback();
        async fn ask(ctx: &Ctx, client: &Client) -> Request {
            let alice = identity::resolve(ctx, "did:plc:alice").await.unwrap();
            let back = "http://127.0.0.1/callback";
            authorize(ctx, client, alice, "alice.test", back, SCOPE)
                .await
                .unwrap()
        }
        let params = |pairs: &[(&str, &str)]| -> HashMap<String, String> {
            pairs
                .iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect()
        };
        let other_state = params(&[("state", "x"), ("code", "code-1")]);
        let why = ask(&ctx, &client)
            .await
            .redeem(&ctx, &client, &other_state)
            .await;
        assert!(why.unwrap_err().to_string().contains("did not start"));

        let request = ask(&ctx, &client).await;
        let state = request.state.clone();
        let other_issuer = params(&[
            ("state", state.as_str()),
            ("code", "code-1"),
            ("iss", "http://x"),
        ]);
        let why = request.redeem(&ctx, &client, &other_issuer).await;
        assert!(why.unwrap_err().to_string().contains("did not start"));

        let request = ask(&ctx, &client).await;
        let state = request.state.clone();
        let denied = params(&[("state", state.as_str()), ("error", "access_denied")]);
        let why = request.redeem(&ctx, &client, &denied).await.unwrap_err();
        assert_eq!(why.to_string(), "the login was refused: access_denied");

        let request = ask(&ctx, &client).await;
        let state = request.state.clone();
        let bad_code = params(&[("state", state.as_str()), ("code", "stolen")]);
        let why = request.redeem(&ctx, &client, &bad_code).await.unwrap_err();
        assert_eq!(why.to_string(), "invalid_grant: said so");

        // A PDS that names no authorization server cannot be logged in at.
        let nowhere = sign_up(&ctx, &client, "http://127.0.0.1:1", "x", "atproto").await;
        let Err(why) = nowhere else {
            panic!("a request pushed to no one")
        };
        assert!(why.to_string().contains("does not say where"), "{why}");
    }
}
