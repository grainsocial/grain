//! The keys atproto uses: secp256k1 and P-256, as multikeys and `did:key`s,
//! and the JWTs they sign.

use anyhow::{Context, Result, bail};
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::Value;

const K256_CODEC: [u8; 2] = [0xe7, 0x01];
const P256_CODEC: [u8; 2] = [0x80, 0x24];

/// A public key a DID document or `did:key` names.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum PublicKey {
    K256(k256::ecdsa::VerifyingKey),
    P256(p256::ecdsa::VerifyingKey),
}

impl PublicKey {
    /// Parses a multibase (`z`, base58btc) multicodec key.
    pub fn from_multibase(text: &str) -> Result<PublicKey> {
        let Some(b58) = text.strip_prefix('z') else {
            bail!("a multikey is base58btc, starting with z");
        };
        let bytes = bs58::decode(b58)
            .into_vec()
            .context("bad base58 in a multikey")?;
        let (codec, key) = bytes.split_at(2.min(bytes.len()));
        match <[u8; 2]>::try_from(codec) {
            Ok(K256_CODEC) => Ok(PublicKey::K256(
                k256::ecdsa::VerifyingKey::from_sec1_bytes(key).context("bad secp256k1 key")?,
            )),
            Ok(P256_CODEC) => Ok(PublicKey::P256(
                p256::ecdsa::VerifyingKey::from_sec1_bytes(key).context("bad P-256 key")?,
            )),
            _ => bail!("unsupported key type in a multikey"),
        }
    }

    /// Parses a DID document verification method: a `Multikey`, or one of
    /// the older types whose multibase holds the bare key with no codec.
    pub fn from_method(kind: &str, multibase: &str) -> Result<PublicKey> {
        let raw = || -> Result<Vec<u8>> {
            let Some(b58) = multibase.strip_prefix('z') else {
                bail!("a multikey is base58btc, starting with z");
            };
            bs58::decode(b58).into_vec().context("bad base58 in a key")
        };
        match kind {
            "EcdsaSecp256k1VerificationKey2019" => Ok(PublicKey::K256(
                k256::ecdsa::VerifyingKey::from_sec1_bytes(&raw()?).context("bad secp256k1 key")?,
            )),
            "EcdsaSecp256r1VerificationKey2019" => Ok(PublicKey::P256(
                p256::ecdsa::VerifyingKey::from_sec1_bytes(&raw()?).context("bad P-256 key")?,
            )),
            _ => PublicKey::from_multibase(multibase),
        }
    }

    pub fn from_did_key(did: &str) -> Result<PublicKey> {
        match did.strip_prefix("did:key:") {
            Some(multibase) => PublicKey::from_multibase(multibase),
            None => bail!("{did} is not a did:key"),
        }
    }

    pub fn to_multibase(&self) -> String {
        let codec = match self {
            PublicKey::K256(_) => K256_CODEC,
            PublicKey::P256(_) => P256_CODEC,
        };
        format!(
            "z{}",
            bs58::encode([&codec[..], &self.sec1()].concat()).into_string()
        )
    }

    /// The key as SEC1 bytes, compressed.
    pub fn sec1(&self) -> Vec<u8> {
        match self {
            PublicKey::K256(k) => k.to_encoded_point(true).as_bytes().to_vec(),
            PublicKey::P256(k) => k.to_encoded_point(true).as_bytes().to_vec(),
        }
    }

    pub fn to_did_key(&self) -> String {
        format!("did:key:{}", self.to_multibase())
    }

    /// The JWT `alg` this key signs with.
    pub fn alg(&self) -> &'static str {
        match self {
            PublicKey::K256(_) => "ES256K",
            PublicKey::P256(_) => "ES256",
        }
    }

    /// Checks a 64-byte `r||s` signature over SHA-256 of `message`. High-S
    /// signatures are refused, as atproto requires.
    pub fn verify(&self, message: &[u8], signature: &[u8]) -> Result<()> {
        use k256::ecdsa::signature::Verifier;
        let ok = match self {
            PublicKey::K256(key) => k256::ecdsa::Signature::from_slice(signature)
                .ok()
                .filter(|s| s.normalize_s().is_none())
                .is_some_and(|s| key.verify(message, &s).is_ok()),
            PublicKey::P256(key) => p256::ecdsa::Signature::from_slice(signature)
                .ok()
                .filter(|s| s.normalize_s().is_none())
                .is_some_and(|s| key.verify(message, &s).is_ok()),
        };
        if ok { Ok(()) } else { bail!("bad signature") }
    }
}

/// A P-256 key grain signs with: a DPoP key that OAuth tokens are bound
/// to, or a confidential client's key that proves who the client is.
pub struct P256Key(p256::ecdsa::SigningKey);

impl P256Key {
    pub fn generate() -> P256Key {
        P256Key(p256::ecdsa::SigningKey::random(&mut rand_core::OsRng))
    }

    /// The 32-byte secret scalar, for a session that keeps the key with
    /// the tokens bound to it.
    pub fn to_bytes(&self) -> Vec<u8> {
        self.0.to_bytes().to_vec()
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<P256Key> {
        Ok(P256Key(
            p256::ecdsa::SigningKey::from_slice(bytes).context("bad P-256 secret key")?,
        ))
    }

    pub fn public(&self) -> PublicKey {
        PublicKey::P256(*self.0.verifying_key())
    }

    /// The public key as a JWK, as a DPoP proof carries it.
    pub fn jwk(&self) -> Value {
        let point = self.0.verifying_key().to_encoded_point(false);
        let coordinate = |c: Option<&p256::FieldBytes>| {
            URL_SAFE_NO_PAD.encode(c.expect("an uncompressed point"))
        };
        serde_json::json!({
            "kty": "EC",
            "crv": "P-256",
            "x": coordinate(point.x()),
            "y": coordinate(point.y()),
        })
    }

    /// A 64-byte, low-S `r||s` signature over SHA-256 of `message`.
    pub fn sign(&self, message: &[u8]) -> Vec<u8> {
        use p256::ecdsa::signature::Signer;
        let sig: p256::ecdsa::Signature = self.0.sign(message);
        sig.normalize_s().unwrap_or(sig).to_bytes().to_vec()
    }

    /// A compact JWT signed with this key, `alg` ES256.
    pub fn sign_jwt(&self, header: &Value, claims: &impl Serialize) -> String {
        let mut header = header.clone();
        header["alg"] = "ES256".into();
        let body = format!(
            "{}.{}",
            URL_SAFE_NO_PAD.encode(header.to_string()),
            URL_SAFE_NO_PAD.encode(serde_json::to_vec(claims).expect("claims serialize"))
        );
        let sig = URL_SAFE_NO_PAD.encode(self.sign(body.as_bytes()));
        format!("{body}.{sig}")
    }
}

/// A JWT's header and claims, unverified.
pub fn jwt_parts(token: &str) -> Result<(Value, Value)> {
    let mut parts = token.split('.');
    let mut decode = |what: &str| -> Result<Value> {
        let part = parts
            .next()
            .with_context(|| format!("a JWT without a {what}"))?;
        let bytes = URL_SAFE_NO_PAD
            .decode(part)
            .with_context(|| format!("bad base64 in a JWT {what}"))?;
        serde_json::from_slice(&bytes).with_context(|| format!("bad JSON in a JWT {what}"))
    };
    Ok((decode("header")?, decode("payload")?))
}

/// Verifies `token` against `key` and returns its claims. Checks the
/// signature, that `alg` matches the key, and `exp` against the clock.
pub fn verify_jwt<T: DeserializeOwned>(token: &str, key: &PublicKey) -> Result<T> {
    let (header, claims) = jwt_parts(token)?;
    if header["alg"].as_str() != Some(key.alg()) {
        bail!(
            "a JWT signed with {} where {} was expected",
            header["alg"],
            key.alg()
        );
    }
    let (signed, sig) = token
        .rsplit_once('.')
        .context("a JWT without a signature")?;
    let sig = URL_SAFE_NO_PAD
        .decode(sig)
        .context("bad base64 in a JWT signature")?;
    key.verify(signed.as_bytes(), &sig)?;
    let now = crate::keys::now_secs();
    match claims["exp"].as_u64() {
        Some(exp) if exp > now => {}
        _ => bail!("an expired JWT"),
    }
    Ok(serde_json::from_value(claims)?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn multikeys_round_trip() {
        let p = P256Key::generate().public();
        assert_eq!(PublicKey::from_did_key(&p.to_did_key()).unwrap(), p);
        assert!(p.to_multibase().starts_with("zDn"));
        let k = PublicKey::K256(
            *k256::ecdsa::SigningKey::random(&mut rand_core::OsRng).verifying_key(),
        );
        assert_eq!(PublicKey::from_multibase(&k.to_multibase()).unwrap(), k);
        assert!(k.to_multibase().starts_with("zQ3s"));
        assert_eq!((k.alg(), p.alg()), ("ES256K", "ES256"));
        for bad in [
            "x",
            "z0OIl",
            "z",
            "z2",
            &format!("z{}", bs58::encode([0xe7, 0x01, 1, 2]).into_string()),
            &format!("z{}", bs58::encode([0x80, 0x24, 1, 2]).into_string()),
        ] {
            assert!(PublicKey::from_multibase(bad).is_err(), "{bad}");
        }
        assert!(PublicKey::from_did_key("did:web:x").is_err());

        // The older verification method types hold the bare key.
        let bare = |k: &PublicKey| match k {
            PublicKey::K256(k) => format!(
                "z{}",
                bs58::encode(k.to_encoded_point(false).as_bytes()).into_string()
            ),
            PublicKey::P256(k) => format!(
                "z{}",
                bs58::encode(k.to_encoded_point(true).as_bytes()).into_string()
            ),
        };
        assert_eq!(
            PublicKey::from_method("EcdsaSecp256k1VerificationKey2019", &bare(&k)).unwrap(),
            k
        );
        assert_eq!(
            PublicKey::from_method("EcdsaSecp256r1VerificationKey2019", &bare(&p)).unwrap(),
            p
        );
        assert_eq!(
            PublicKey::from_method("Multikey", &p.to_multibase()).unwrap(),
            p
        );
        assert!(PublicKey::from_method("EcdsaSecp256k1VerificationKey2019", "x").is_err());
        assert!(PublicKey::from_method("EcdsaSecp256k1VerificationKey2019", "z0").is_err());
        assert!(PublicKey::from_method("EcdsaSecp256k1VerificationKey2019", "z2").is_err());
        assert!(PublicKey::from_method("EcdsaSecp256r1VerificationKey2019", "z2").is_err());
    }

    #[test]
    fn signatures() {
        use k256::ecdsa::signature::Signer;
        let key = P256Key::generate();
        let again = P256Key::from_bytes(&key.to_bytes()).unwrap();
        assert_eq!(again.public(), key.public());
        assert!(P256Key::from_bytes(&[0; 32]).is_err());
        let sig = key.sign(b"hello");
        assert_eq!(sig.len(), 64);
        key.public().verify(b"hello", &sig).unwrap();
        assert!(key.public().verify(b"other", &sig).is_err());
        assert!(key.public().verify(b"hello", b"short").is_err());

        let k = k256::ecdsa::SigningKey::random(&mut rand_core::OsRng);
        let s: k256::ecdsa::Signature = k.sign(b"m");
        let low = s.normalize_s().unwrap_or(s);
        let public = PublicKey::K256(*k.verifying_key());
        public.verify(b"m", &low.to_bytes()).unwrap();
        // The same signature with s flipped high verifies in ECDSA, and is refused.
        let (r, s_low) = (low.r(), low.s());
        let high = k256::ecdsa::Signature::from_scalars(r, -*s_low).unwrap();
        assert!(public.verify(b"m", &high.to_bytes()).is_err());
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
        let k = PublicKey::K256(
            *k256::ecdsa::SigningKey::random(&mut rand_core::OsRng).verifying_key(),
        );
        assert!(verify_jwt::<Value>(&token, &k).is_err());
        let expired = key.sign_jwt(&json!({}), &json!({"exp": 1}));
        assert!(verify_jwt::<Value>(&expired, &key.public()).is_err());
        let (signed, _) = token.rsplit_once('.').unwrap();
        assert!(verify_jwt::<Value>(&format!("{signed}.!!"), &key.public()).is_err());
        assert!(verify_jwt::<Value>(signed, &key.public()).is_err());
        for bad in ["", "a", "e30", "!!.x", "e30.!!", "bm90IGpzb24.e30"] {
            assert!(jwt_parts(bad).is_err(), "{bad}");
        }
    }

    /// A JWT signed with secp256k1, as most PDSes sign service tokens:
    /// grain verifies them, though it signs none.
    #[test]
    fn k256_jwts() {
        use k256::ecdsa::signature::Signer;
        let k = k256::ecdsa::SigningKey::random(&mut rand_core::OsRng);
        let public = PublicKey::K256(*k.verifying_key());
        let sign = |header: Value, claims: Value| {
            let body = format!(
                "{}.{}",
                URL_SAFE_NO_PAD.encode(header.to_string()),
                URL_SAFE_NO_PAD.encode(claims.to_string())
            );
            let sig: k256::ecdsa::Signature = k.sign(body.as_bytes());
            let sig = sig.normalize_s().unwrap_or(sig);
            format!("{body}.{}", URL_SAFE_NO_PAD.encode(sig.to_bytes()))
        };
        let exp = crate::keys::now_secs() + 60;
        let token = sign(
            json!({"alg": "ES256K"}),
            json!({"iss": "did:plc:a", "exp": exp}),
        );
        let claims: Value = verify_jwt(&token, &public).unwrap();
        assert_eq!(claims["iss"], "did:plc:a");
        // Its key named as a did:key verifies it too.
        let named = PublicKey::from_did_key(&public.to_did_key()).unwrap();
        verify_jwt::<Value>(&token, &named).unwrap();
        // Signed by the key, but claiming ES256: the alg is the key's.
        let mislabelled = sign(json!({"alg": "ES256"}), json!({"exp": exp}));
        assert!(verify_jwt::<Value>(&mislabelled, &public).is_err());
        let no_exp = sign(json!({"alg": "ES256K"}), json!({"iss": "did:plc:a"}));
        assert!(verify_jwt::<Value>(&no_exp, &public).is_err());
    }
}
