//! Service auth: short-lived JWTs an account's PDS signs with the account's
//! key, naming the service they are for (`aud`) and the one method they
//! allow (`lxm`). The mobile apps and the command line send grain-serve
//! these, and grain asks a PDS for them to call another service, such as a
//! group's host, as the account.

use crate::crypto::{self, PublicKey};
use crate::env::Ctx;
use crate::identity;
use crate::session::Session;
use crate::xrpc::Xrpc;
use anyhow::{Result, bail};
use serde::Deserialize;

/// A token from `me`'s PDS for calling `lxm` on the service `aud`.
pub async fn service_token(ctx: &Ctx, me: &Session, aud: &str, lxm: &str) -> Result<String> {
    token(ctx, me, &[("aud", aud), ("lxm", lxm)]).await
}

/// [`service_token`], good until `exp`, in seconds since the epoch: an
/// hour from now at most.
pub async fn lasting_token(
    ctx: &Ctx,
    me: &Session,
    aud: &str,
    lxm: &str,
    exp: u64,
) -> Result<String> {
    let exp = exp.to_string();
    token(ctx, me, &[("aud", aud), ("lxm", lxm), ("exp", &exp)]).await
}

async fn token(ctx: &Ctx, me: &Session, params: &[(&str, &str)]) -> Result<String> {
    #[derive(Deserialize)]
    struct Out {
        token: String,
    }
    let out: Out = Xrpc::new(ctx.http.clone(), &me.service)
        .query(
            "com.atproto.server.getServiceAuth",
            params,
            Some(&me.auth()),
        )
        .await?;
    Ok(out.token)
}

#[derive(Deserialize)]
struct Claims {
    iss: String,
    aud: String,
    lxm: Option<String>,
}

/// Checks a service token for calling `lxm` on `aud`, and returns the DID
/// that sent it. The signature is checked against the key the issuer's DID
/// document names ([`signed_by`]), and `exp` against the clock.
pub async fn verify(ctx: &Ctx, token: &str, aud: &str, lxm: &str) -> Result<String> {
    let (_, claims) = crypto::jwt_parts(token)?;
    let claims: Claims = serde_json::from_value(claims)?;
    let did = claims.iss.split('#').next().unwrap_or_default().to_string();
    if claims.aud != aud {
        bail!("a token for {}, not {aud}", claims.aud);
    }
    if claims.lxm.as_deref() != Some(lxm) {
        bail!("a token for {:?}, not {lxm}", claims.lxm);
    }
    signed_by(ctx, token, &did).await?;
    Ok(did)
}

/// Checks `token`'s signature against the key `did`'s DID document names:
/// as read a few minutes ago, and as it is now when that one turns it
/// away, as it does once the key rotated.
async fn signed_by(ctx: &Ctx, token: &str, did: &str) -> Result<()> {
    let kept = identity::signing_key(&identity::kept_document(ctx, did).await?)?;
    if crypto::verify_jwt::<serde_json::Value>(token, &kept).is_ok() {
        return Ok(());
    }
    let key: PublicKey = identity::signing_key(&identity::document(ctx, did).await?)?;
    crypto::verify_jwt::<serde_json::Value>(token, &key)?;
    Ok(())
}

/// The type a space delegation token names in its header.
const DELEGATION_TYP: &str = "atproto-space-delegation+jwt";

/// A delegation token, as a member's PDS signs one for a space's
/// authority (`com.atproto.space.getDelegationToken`).
#[derive(Deserialize, Debug, Clone)]
pub struct Delegation {
    /// The account it names.
    #[serde(rename = "iss")]
    pub did: String,
    /// The space it is for.
    #[serde(rename = "sub")]
    pub space: String,
    /// What spends it: an authority takes each once.
    pub jti: String,
    /// When it stops, in seconds since the epoch.
    pub exp: u64,
    aud: String,
}

/// Checks a delegation token, for a space, signed by the account it names
/// with the key its DID document names ([`signed_by`]), and returns what
/// it holds. It names a space's authority, not whoever holds it: anyone
/// handed one may exchange it, so it proves who sent it only together with
/// being spent once.
pub async fn verify_delegation(ctx: &Ctx, token: &str) -> Result<Delegation> {
    let (header, claims) = crypto::jwt_parts(token)?;
    if header["typ"].as_str() != Some(DELEGATION_TYP) {
        bail!("not a delegation token: {}", header["typ"]);
    }
    let found: Delegation = serde_json::from_value(claims)?;
    let authority = found.space.strip_prefix("at://").unwrap_or_default();
    let authority = authority.split('/').next().unwrap_or_default();
    if found.aud != format!("{authority}#atproto_pds") {
        bail!("a token for {}, not {}'s authority", found.aud, found.space);
    }
    signed_by(ctx, token, &found.did).await?;
    Ok(found)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::P256Key;
    use crate::env::Env;
    use crate::xrpc::tests::{read_request, serving};
    use serde_json::{Value, json};
    use std::sync::{Arc, Mutex};

    #[tokio::test]
    async fn tokens_are_asked_of_the_accounts_pds() {
        let (pds, asked) = serving("200 OK", "", r#"{"token":"signed"}"#);
        let ctx = Ctx::new(Env::from_vars(|_| None));
        let me = Session {
            did: "did:plc:alice".into(),
            handle: "alice.test".into(),
            service: pds,
            access_jwt: "access".into(),
            refresh_jwt: "refresh".into(),
            oauth: None,
        };
        let aud = "did:web:groups.test";
        let lxm = "fyi.opensocial.requestJoin";
        assert_eq!(service_token(&ctx, &me, aud, lxm).await.unwrap(), "signed");
        let exp = 1_700_000_000;
        assert_eq!(
            lasting_token(&ctx, &me, aud, lxm, exp).await.unwrap(),
            "signed"
        );
        let asked = asked.lock().unwrap();
        let first = "GET /xrpc/com.atproto.server.getServiceAuth?aud=did%3Aweb%3Agroups.test&lxm=fyi.opensocial.requestJoin ";
        assert!(asked[0].starts_with(first), "{}", asked[0]);
        assert!(asked[0].contains("authorization: Bearer access"));
        assert!(asked[1].contains("&exp=1700000000 "), "{}", asked[1]);
    }

    /// A server that answers every request with 200 and whatever `body`
    /// holds when it is asked: a DID document that can change.
    fn documents() -> (u16, Arc<Mutex<String>>) {
        use std::io::Write;
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let body = Arc::new(Mutex::new(String::new()));
        let held = body.clone();
        std::thread::spawn(move || {
            for stream in listener.incoming() {
                let mut stream = stream.unwrap();
                read_request(&mut stream);
                let body = held.lock().unwrap().clone();
                let answer = format!(
                    "HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}",
                    body.len()
                );
                let _ = stream.write_all(answer.as_bytes());
            }
        });
        (port, body)
    }

    fn document(did: &str, key: &PublicKey) -> String {
        json!({
            "id": did,
            "verificationMethod": [{
                "id": format!("{did}#atproto"),
                "type": "Multikey",
                "controller": did,
                "publicKeyMultibase": key.to_multibase(),
            }],
        })
        .to_string()
    }

    #[tokio::test]
    async fn tokens_are_verified_against_the_issuers_key() {
        let (port, served) = documents();
        let did = format!("did:web:127.0.0.1%3A{port}");
        let ctx = Ctx::new(Env::from_vars(|k| match k {
            "GRAIN_DID_WEB_SCHEME" => Some("http".into()),
            "GRAIN_ALLOW_PRIVATE" => Some("1".into()),
            _ => None,
        }));
        let key = P256Key::generate();
        *served.lock().unwrap() = document(&did, &key.public());
        let aud = "did:web:grain.test";
        let lxm = "social.grain.feed.getTimeline";
        let exp = crate::keys::now_secs() + 60;
        let sign = |key: &P256Key, claims: Value| key.sign_jwt(&json!({"typ": "JWT"}), &claims);
        let claims = |iss: &str| json!({"iss": iss, "aud": aud, "lxm": lxm, "exp": exp});

        let token = sign(&key, claims(&did));
        assert_eq!(verify(&ctx, &token, aud, lxm).await.unwrap(), did);
        // An issuer naming one of the account's services is the account.
        let service = sign(&key, claims(&format!("{did}#atproto_labeler")));
        assert_eq!(verify(&ctx, &service, aud, lxm).await.unwrap(), did);

        let why = verify(&ctx, &token, "did:web:other.test", lxm).await;
        assert!(
            why.unwrap_err()
                .to_string()
                .starts_with("a token for did:web:grain.test")
        );
        let why = verify(&ctx, &token, aud, "social.grain.other").await;
        assert!(
            why.unwrap_err()
                .to_string()
                .contains("not social.grain.other")
        );
        let any = sign(&key, json!({"iss": did, "aud": aud, "exp": exp}));
        assert!(
            verify(&ctx, &any, aud, lxm).await.is_err(),
            "no lxm, no method"
        );
        let expired = sign(&key, json!({"iss": did, "aud": aud, "lxm": lxm, "exp": 1}));
        assert!(verify(&ctx, &expired, aud, lxm).await.is_err());
        let stranger = sign(&P256Key::generate(), claims(&did));
        assert!(verify(&ctx, &stranger, aud, lxm).await.is_err());
        assert!(verify(&ctx, "not.a.token", aud, lxm).await.is_err());

        // The account's key rotates: a token signed with the new key turns
        // the document kept away, and is checked against it read again.
        let rotated = P256Key::generate();
        *served.lock().unwrap() = document(&did, &rotated.public());
        let token = sign(&rotated, claims(&did));
        assert_eq!(verify(&ctx, &token, aud, lxm).await.unwrap(), did);

        // An issuer whose document cannot be read is no one's.
        let nowhere = sign(&key, claims("did:web:127.0.0.1%3A1"));
        assert!(verify(&ctx, &nowhere, aud, lxm).await.is_err());
    }

    /// An unsigned JWT of `header` and `claims`: what is refused before any
    /// signature is checked.
    fn unsigned(header: Value, claims: Value) -> String {
        use base64::Engine;
        let part =
            |v: &Value| base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(v.to_string());
        format!("{}.{}.x", part(&header), part(&claims))
    }

    #[tokio::test]
    async fn a_delegation_token_names_its_type_and_the_spaces_authority() {
        let ctx = Ctx::new(Env::from_vars(|_| None));
        let claims = |aud: &str| {
            json!({"iss": "did:plc:member", "sub": "at://did:plc:owner/space/social.grain.group/self",
                   "aud": aud, "jti": "1", "exp": 1})
        };
        let typ = |typ: &str| json!({"alg": "ES256", "typ": typ});
        let service = unsigned(typ("JWT"), claims("did:plc:owner#atproto_pds"));
        let why = verify_delegation(&ctx, &service).await.unwrap_err();
        assert!(
            why.to_string().starts_with("not a delegation token"),
            "{why}"
        );
        let elsewhere = unsigned(typ(DELEGATION_TYP), claims("did:plc:other#atproto_pds"));
        let why = verify_delegation(&ctx, &elsewhere).await.unwrap_err();
        assert!(why.to_string().contains("not at://did:plc:owner/"), "{why}");
        let bare = unsigned(typ(DELEGATION_TYP), json!({"iss": "did:plc:member"}));
        assert!(verify_delegation(&ctx, &bare).await.is_err());
    }
}
