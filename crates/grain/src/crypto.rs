//! The keys atproto uses, from the `atproto` crate: secp256k1 and P-256, as
//! multikeys and `did:key`s, and the JWTs they sign. What is here is
//! grain's own use of them: the P-256 key it holds for a DPoP proof, a
//! confidential client, a session cookie or a space credential, and a JWT
//! held to low-S signatures and its `exp`.

use anyhow::{Context, Result, bail, ensure};
use atproto::jose;
use atproto::keys::{Curve, Keypair};
use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::Value;

pub use atproto::keys::PublicKey;

/// A P-256 key grain signs with: a DPoP key that OAuth tokens are bound
/// to, a confidential client's key that proves who the client is, or one
/// a space credential is bound to.
pub struct P256Key(Keypair);

impl P256Key {
    pub fn generate() -> P256Key {
        P256Key(Keypair::generate(Curve::P256))
    }

    /// The 32-byte secret scalar, for a session that keeps the key with
    /// the tokens bound to it.
    pub fn to_bytes(&self) -> Vec<u8> {
        self.0.to_bytes().to_vec()
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<P256Key> {
        let key = Keypair::from_bytes(Curve::P256, bytes).context("bad P-256 secret key")?;
        Ok(P256Key(key))
    }

    pub fn public(&self) -> PublicKey {
        self.0.public()
    }

    /// The crate's keypair, for what `atproto` signs with it.
    pub fn keypair(&self) -> &Keypair {
        &self.0
    }

    /// The public key as a JWK, as a DPoP proof carries it.
    pub fn jwk(&self) -> Value {
        jose::jwk(&self.public())
    }

    /// A 64-byte, low-S `r||s` signature over SHA-256 of `message`.
    pub fn sign(&self, message: &[u8]) -> Vec<u8> {
        self.0.sign(message).to_vec()
    }

    /// A compact JWT signed with this key, `alg` ES256.
    pub fn sign_jwt(&self, header: &Value, claims: &impl Serialize) -> String {
        let claims = serde_json::to_value(claims).expect("claims serialize");
        jose::sign(&self.0, header, &claims)
    }
}

/// A JWT's header and claims, unverified.
pub fn jwt_parts(token: &str) -> Result<(Value, Value)> {
    Ok(jose::parts(token)?)
}

/// Verifies `token` against `key` and returns its claims. Checks the
/// signature, low-S as atproto signs, that `alg` matches the key, and `exp`
/// against the clock.
pub fn verify_jwt<T: DeserializeOwned>(token: &str, key: &PublicKey) -> Result<T> {
    let (header, claims) = jwt_parts(token)?;
    let alg = key.curve().alg();
    if header["alg"].as_str() != Some(alg) {
        bail!(
            "a JWT signed with {} where {alg} was expected",
            header["alg"]
        );
    }
    let (signed, sig) = token.rsplit_once('.').unwrap_or_default();
    let sig = jose::unb64(sig).context("bad base64 in a JWT signature")?;
    ensure!(key.verify(signed.as_bytes(), &sig), "bad signature");
    match claims["exp"].as_u64() {
        Some(exp) if exp > crate::keys::now_secs() => {}
        _ => bail!("an expired JWT"),
    }
    Ok(serde_json::from_value(claims)?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn signatures() {
        let key = P256Key::generate();
        let again = P256Key::from_bytes(&key.to_bytes()).unwrap();
        assert_eq!(again.public(), key.public());
        assert!(P256Key::from_bytes(&[0; 32]).is_err());
        let sig = key.sign(b"hello");
        assert_eq!(sig.len(), 64);
        assert!(key.public().verify(b"hello", &sig));
        assert!(!key.public().verify(b"other", &sig));
        assert_eq!(key.jwk()["crv"], "P-256");
        assert_eq!(key.keypair().public(), key.public());
    }

    #[test]
    fn jwts() {
        let key = P256Key::generate();
        let exp = crate::keys::now_secs() + 60;
        let token = key.sign_jwt(&json!({"typ": "JWT"}), &json!({"iss": "me", "exp": exp}));
        let claims: Value = verify_jwt(&token, &key.public()).unwrap();
        assert_eq!(claims["iss"], "me");
        let (header, _) = jwt_parts(&token).unwrap();
        assert_eq!(header["alg"], "ES256");

        let other = P256Key::generate();
        assert!(verify_jwt::<Value>(&token, &other.public()).is_err());
        let k = Keypair::generate(Curve::K256).public();
        assert!(verify_jwt::<Value>(&token, &k).is_err());
        let expired = key.sign_jwt(&json!({}), &json!({"exp": 1}));
        assert!(verify_jwt::<Value>(&expired, &key.public()).is_err());
        let (signed, _) = token.rsplit_once('.').unwrap();
        assert!(verify_jwt::<Value>(&format!("{signed}.!!"), &key.public()).is_err());
        assert!(verify_jwt::<Value>(signed, &key.public()).is_err());
        for bad in ["", "a", "e30", "!!.x", "e30.!!", "bm90IGpzb24.e30"] {
            assert!(jwt_parts(bad).is_err(), "{bad}");
        }

        // The same signature with s flipped high verifies in ECDSA, and is
        // refused, as atproto signs low-S.
        let (signed, sig) = token.rsplit_once('.').unwrap();
        let sig = p256::ecdsa::Signature::from_slice(&jose::unb64(sig).unwrap()).unwrap();
        let high = p256::ecdsa::Signature::from_scalars(sig.r(), -*sig.s()).unwrap();
        let forged = format!("{signed}.{}", jose::b64(high.to_bytes()));
        assert!(verify_jwt::<Value>(&forged, &key.public()).is_err());
    }

    /// A JWT signed with secp256k1, as most PDSes sign service tokens:
    /// grain verifies them, though it signs none.
    #[test]
    fn k256_jwts() {
        let k = Keypair::generate(Curve::K256);
        let public = k.public();
        let exp = crate::keys::now_secs() + 60;
        let sign = |header: Value, claims: Value| jose::sign(&k, &header, &claims);
        let token = sign(json!({}), json!({"iss": "did:plc:a", "exp": exp}));
        let claims: Value = verify_jwt(&token, &public).unwrap();
        assert_eq!(claims["iss"], "did:plc:a");
        // Its key named as a did:key verifies it too.
        let named = PublicKey::from_did_key(&public.did_key()).unwrap();
        verify_jwt::<Value>(&token, &named).unwrap();
        let no_exp = sign(json!({}), json!({"iss": "did:plc:a"}));
        assert!(verify_jwt::<Value>(&no_exp, &public).is_err());
    }
}
