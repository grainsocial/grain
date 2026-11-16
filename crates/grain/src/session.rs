//! Sessions, from an OAuth login or an app password: what lets calls to an
//! account's PDS in, and, for the command line, kept per DID under the
//! config directory and refreshed in place.

use crate::crypto::P256Key;
use crate::env::Ctx;
use crate::identity::{self, Identity};
use crate::oauth;
use crate::store::{self, Lock};
use crate::xrpc::{Auth, Xrpc};
use anyhow::{Result, bail};
use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::path::PathBuf;
use std::sync::Arc;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub did: String,
    pub handle: String,
    #[serde(default)]
    pub service: String,
    pub access_jwt: String,
    pub refresh_jwt: String,
    /// Set for an OAuth session, whose tokens are bound to a DPoP key.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub oauth: Option<OAuth>,
}

/// What an OAuth session needs beyond its tokens.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OAuth {
    /// The DPoP key's secret scalar, base64.
    pub key: String,
    /// The authorization server, which a confidential client's assertions
    /// are addressed to.
    pub issuer: String,
    pub token_endpoint: String,
    pub revocation_endpoint: Option<String>,
    /// The confidential client the session was granted to, grain-serve's;
    /// none for the command line's loopback client.
    pub client_id: Option<String>,
    /// The loopback client ID the session was granted to, its scope and
    /// all: a grain that asks for more scope since still refreshes it
    /// under the ID it was granted to, which the server holds it to. None
    /// for a confidential client's.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub loopback_id: Option<String>,
    /// The scope the session was asked for, which its server may have
    /// granted less of: one asked for less than grain asks for now is
    /// behind ([`oauth::behind`]), and logging in again brings it up.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scope: Option<String>,
    /// When the access token expires, in seconds since the epoch.
    pub expires_at: u64,
}

impl OAuth {
    pub fn key(&self) -> Result<P256Key> {
        P256Key::from_bytes(&STANDARD.decode(&self.key)?)
    }
}

impl Session {
    /// What lets this session's requests in.
    pub fn auth(&self) -> Auth {
        match self.oauth.as_ref().map(OAuth::key) {
            Some(Ok(key)) => Auth::Dpop {
                token: self.access_jwt.clone(),
                key: Arc::new(key),
            },
            _ => Auth::bearer(&self.access_jwt),
        }
    }

    /// Whether the access token expires within a minute.
    pub fn expiring(&self) -> bool {
        match &self.oauth {
            Some(oauth) => oauth.expires_at < crate::keys::now_secs() + 60,
            None => expiring(&self.access_jwt),
        }
    }
}

fn path(ctx: &Ctx, did: &str) -> PathBuf {
    ctx.env
        .config_dir
        .join("sessions")
        .join(format!("{}.json", did.replace(':', "_")))
}

pub fn load(ctx: &Ctx, did: &str) -> Option<Session> {
    store::read(&path(ctx, did))
}

/// Forgets `did`'s session without a word to its PDS: for an account gone
/// from it.
pub fn remove(ctx: &Ctx, did: &str) {
    let _ = std::fs::remove_file(path(ctx, did));
}

pub fn save(ctx: &Ctx, session: &Session) -> Result<()> {
    store::write(&path(ctx, &session.did), session, true)
}

pub async fn login(ctx: &Ctx, identifier: &str, password: &str) -> Result<Session> {
    let session = create(ctx, identifier, password).await?;
    save(ctx, &session)?;
    Ok(session)
}

/// A session for `identifier` from its password, kept nowhere.
pub async fn create(ctx: &Ctx, identifier: &str, password: &str) -> Result<Session> {
    let id = identity::resolve(ctx, identifier).await?;
    let mut session: Session = Xrpc::new(ctx.http.clone(), &id.pds)
        .procedure(
            "com.atproto.server.createSession",
            Some(&json!({ "identifier": identifier, "password": password })),
            None,
        )
        .await?;
    session.service = id.pds;
    Ok(session)
}

/// Removes the stored session, revoking an OAuth one's tokens. Returns
/// whether there was one.
pub async fn logout(ctx: &Ctx, identifier: &str) -> Result<bool> {
    let id = identity::resolve(ctx, identifier).await?;
    if let Some(session) = load(ctx, &id.did)
        && let Some(oauth) = &session.oauth
        && let Ok(client) = oauth::Client::granted(oauth)
    {
        // A token the server cannot revoke now expires on its own.
        let _ = oauth::revoke(ctx, &client, &session, oauth).await;
    }
    Ok(std::fs::remove_file(path(ctx, &id.did)).is_ok())
}

/// A session for `id` with an access token that will last the call: the
/// stored one, refreshed if it is about to expire, or a fresh login from
/// `GRAIN_PASSWORD`.
pub async fn ensure(ctx: &Ctx, id: &Identity) -> Result<Session> {
    if let Some(stored) = load(ctx, &id.did) {
        if !stored.expiring() {
            return Ok(stored);
        }
        if let Ok(fresh) = refresh(ctx, &stored).await {
            return Ok(fresh);
        }
    }
    // The password is the identifier's: for another account it would log
    // in as the identifier, and save that over the identifier's session,
    // an OAuth one among them.
    if let Some(password) = &ctx.env.password {
        let identifier = ctx.env.identifier.clone().unwrap_or_else(|| id.did.clone());
        let whose = identity::resolve(ctx, &identifier).await?;
        if whose.did == id.did {
            return login(ctx, &identifier, password).await;
        }
    }
    bail!("not logged in as {}: log in, or set GRAIN_PASSWORD", id.did)
}

/// Marks `session` as the account this machine last logged in as.
pub fn remember(ctx: &Ctx, session: &Session) -> Result<()> {
    store::write_bytes(
        &ctx.env.config_dir.join("me"),
        session.did.as_bytes(),
        false,
    )
}

/// The account this machine acts as: `GRAIN_IDENTIFIER`, else the one it
/// last logged in as.
pub async fn me(ctx: &Ctx) -> Result<Session> {
    let identifier = match &ctx.env.identifier {
        Some(identifier) => identifier.clone(),
        None => std::fs::read_to_string(ctx.env.config_dir.join("me"))
            .map_err(|_| anyhow::anyhow!("not logged in"))?,
    };
    let id = identity::resolve(ctx, identifier.trim()).await?;
    ensure(ctx, &id).await
}

/// `stored` with new tokens, kept in its place. Refresh tokens are used
/// once, so processes refresh one at a time, and one that finds the
/// session already refreshed takes that.
async fn refresh(ctx: &Ctx, stored: &Session) -> Result<Session> {
    let _lock = Lock::acquire(path(ctx, &stored.did).with_extension("lock")).await?;
    if let Some(now) = load(ctx, &stored.did)
        && now.refresh_jwt != stored.refresh_jwt
    {
        return Ok(now);
    }
    let session = match &stored.oauth {
        Some(oauth) => {
            let client = oauth::Client::granted(oauth)?;
            oauth::refresh(ctx, &client, stored, oauth).await?
        }
        None => {
            let mut session: Session = Xrpc::new(ctx.http.clone(), &stored.service)
                .procedure(
                    "com.atproto.server.refreshSession",
                    None,
                    Some(&Auth::bearer(&stored.refresh_jwt)),
                )
                .await?;
            session.service = stored.service.clone();
            session
        }
    };
    save(ctx, &session)?;
    Ok(session)
}

/// Whether a JWT expires within a minute, or cannot be read.
pub fn expiring(jwt: &str) -> bool {
    #[derive(Deserialize)]
    struct Claims {
        exp: u64,
    }
    let claims = jwt
        .split('.')
        .nth(1)
        .and_then(|p| {
            base64::engine::general_purpose::URL_SAFE_NO_PAD
                .decode(p)
                .ok()
        })
        .and_then(|b| serde_json::from_slice::<Claims>(&b).ok());
    match claims {
        Some(c) => c.exp < crate::keys::now_secs() + 60,
        None => true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::oauth::tests::{authorization_server, ctx_on};

    fn jwt(exp: u64) -> String {
        let body =
            base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(format!("{{\"exp\":{exp}}}"));
        format!("h.{body}.s")
    }

    #[test]
    fn expiry() {
        let now = crate::keys::now_secs();
        assert!(!expiring(&jwt(now + 3600)));
        assert!(expiring(&jwt(now + 10)));
        assert!(expiring("garbage"));
        assert!(expiring("a.!!.b"));
    }

    /// An OAuth session for `did:plc:alice` on `pds`, logged in at its
    /// stand-in server, whose access token expires at `expires_at`.
    fn oauth_session(pds: &str, expires_at: u64) -> Session {
        Session {
            did: "did:plc:alice".into(),
            handle: "alice.test".into(),
            service: pds.into(),
            access_jwt: "old".into(),
            refresh_jwt: "refresh-old".into(),
            oauth: Some(OAuth {
                key: STANDARD.encode(P256Key::generate().to_bytes()),
                issuer: pds.into(),
                token_endpoint: format!("{pds}/oauth/token"),
                revocation_endpoint: Some(format!("{pds}/oauth/revoke")),
                client_id: None,
                loopback_id: Some(oauth::client_id()),
                scope: Some(oauth::SCOPE.into()),
                expires_at,
            }),
        }
    }

    #[test]
    fn auth_and_expiry_of_sessions() {
        let now = crate::keys::now_secs();
        let session = oauth_session("http://pds.test", now + 3600);
        assert!(matches!(session.auth(), Auth::Dpop { .. }));
        assert!(!session.expiring());
        assert!(oauth_session("http://pds.test", now).expiring());
        let password = Session {
            oauth: None,
            access_jwt: jwt(now + 3600),
            ..session.clone()
        };
        assert!(matches!(password.auth(), Auth::Bearer(_)));
        assert!(!password.expiring());
        // A key that cannot be read leaves only the bare token.
        let mut broken = session.clone();
        broken.oauth.as_mut().unwrap().key = "!!".into();
        assert!(matches!(broken.auth(), Auth::Bearer(_)));
        assert!(broken.oauth.unwrap().key().is_err());

        // Kept as camelCase, as knotless's sessions are.
        let kept = serde_json::to_value(&session).unwrap();
        assert_eq!(kept["accessJwt"], "old");
        assert!(kept["oauth"]["expiresAt"].is_u64());
        assert!(kept["oauth"].get("loopbackId").is_some());
        assert!(
            serde_json::to_value(&password)
                .unwrap()
                .get("oauth")
                .is_none()
        );
    }

    #[tokio::test]
    async fn kept_refreshed_and_forgotten() {
        let (base, seen) = authorization_server().await;
        let dir = tempfile::tempdir().unwrap();
        let ctx = ctx_on(&base, dir.path());
        let alice = identity::resolve(&ctx, "did:plc:alice").await.unwrap();
        assert!(load(&ctx, &alice.did).is_none());
        assert!(me(&ctx).await.is_err(), "no one logged in yet");
        let why = ensure(&ctx, &alice).await.unwrap_err();
        assert!(why.to_string().contains("set GRAIN_PASSWORD"), "{why}");

        // Lasting, it is the session kept.
        let lasting = oauth_session(&base, crate::keys::now_secs() + 3600);
        save(&ctx, &lasting).unwrap();
        remember(&ctx, &lasting).unwrap();
        assert_eq!(me(&ctx).await.unwrap(), lasting);
        assert_eq!(seen.lock().unwrap().refreshes, 0);

        // About to expire, it is refreshed in place.
        let expiring = oauth_session(&base, 0);
        save(&ctx, &expiring).unwrap();
        let fresh = ensure(&ctx, &alice).await.unwrap();
        assert_eq!(fresh.refresh_jwt, "refresh-0");
        assert_eq!(load(&ctx, &alice.did), Some(fresh.clone()));
        // Asked again with the token it held, another process already
        // refreshed it: that one is taken.
        assert_eq!(refresh(&ctx, &expiring).await.unwrap(), fresh);
        assert_eq!(seen.lock().unwrap().refreshes, 1);

        // A refresh the server refuses leaves a login to do.
        let spent = Session {
            refresh_jwt: "spent".into(),
            ..oauth_session(&base, 0)
        };
        save(&ctx, &spent).unwrap();
        assert!(ensure(&ctx, &alice).await.is_err());
        // A confidential client's session is that client's to refresh.
        let mut theirs = oauth_session(&base, 0);
        theirs.oauth.as_mut().unwrap().client_id = Some("https://grain.test/client".into());
        theirs.refresh_jwt = "refresh-theirs".into();
        save(&ctx, &theirs).unwrap();
        let why = refresh(&ctx, &theirs).await.unwrap_err();
        assert!(why.to_string().contains("only that client"), "{why}");

        save(&ctx, &fresh).unwrap();
        assert!(logout(&ctx, "did:plc:alice").await.unwrap());
        assert_eq!(seen.lock().unwrap().revoked, ["refresh-0"]);
        assert!(load(&ctx, &alice.did).is_none());
        assert!(!logout(&ctx, "did:plc:alice").await.unwrap());
        save(&ctx, &fresh).unwrap();
        remove(&ctx, &alice.did);
        assert!(load(&ctx, &alice.did).is_none());
    }
}
