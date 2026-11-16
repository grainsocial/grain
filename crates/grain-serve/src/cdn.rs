//! Where a client fetches the images records name: grain's imgproxy CDN,
//! each path signed as imgproxy checks it, or Bluesky's CDN where grain
//! has none of its own.
//!
//! A signed URL is `<url>/<signature>/<preset>/plain/<did>/<cid>`, the
//! signature the URL-safe, unpadded base64 of HMAC-SHA256 under the key,
//! of the salt and then the path after it. The key and salt are hex, as
//! imgproxy takes them (`IMGPROXY_KEY`, `IMGPROXY_SALT`).

use anyhow::{Context, bail};
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use serde_json::Value;
use sha2::{Digest, Sha256};

/// The size an image is drawn at: an imgproxy preset, by the names
/// Bluesky's CDN gives them too.
pub const AVATAR: &str = "avatar";
pub const THUMBNAIL: &str = "feed_thumbnail";
pub const FULLSIZE: &str = "feed_fullsize";

/// Where blob URLs point.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Cdn {
    signing: Option<Signing>,
}

#[derive(Debug, Clone, PartialEq)]
struct Signing {
    url: String,
    key: Vec<u8>,
    salt: Vec<u8>,
}

impl Cdn {
    /// grain's CDN at `url`, signed with `key` and `salt`, in hex; with
    /// no `url`, Bluesky's.
    pub fn new(url: Option<&str>, key: Option<&str>, salt: Option<&str>) -> anyhow::Result<Cdn> {
        let Some(url) = url else {
            return Ok(Cdn::default());
        };
        let (Some(key), Some(salt)) = (key, salt) else {
            bail!("--cdn needs GRAIN_CDN_KEY and GRAIN_CDN_SALT");
        };
        let key = hex(key).context("GRAIN_CDN_KEY is not hex")?;
        let salt = hex(salt).context("GRAIN_CDN_SALT is not hex")?;
        let url = url.trim_end_matches('/').to_string();
        Ok(Cdn {
            signing: Some(Signing { url, key, salt }),
        })
    }

    /// The URL of the blob `blob`, a record's `{ref: {$link}}`, in `did`'s
    /// repo, drawn at `preset`; none where it names no CID.
    pub fn url(&self, did: &str, blob: &Value, preset: &str) -> Option<String> {
        let cid = blob["ref"]["$link"].as_str()?;
        let path = format!("/{preset}/plain/{did}/{cid}");
        Some(match &self.signing {
            Some(s) => {
                let mac = hmac_sha256(&s.key, &[&s.salt, path.as_bytes()]);
                format!("{}/{}{path}", s.url, URL_SAFE_NO_PAD.encode(mac))
            }
            None => format!("https://cdn.bsky.app/img{path}@jpeg"),
        })
    }
}

/// HMAC-SHA256 (RFC 2104) of `parts`, one after another, under `key`.
fn hmac_sha256(key: &[u8], parts: &[&[u8]]) -> [u8; 32] {
    let mut block = [0u8; 64];
    if key.len() > block.len() {
        block[..32].copy_from_slice(&Sha256::digest(key));
    } else {
        block[..key.len()].copy_from_slice(key);
    }
    let pad = |byte: u8| block.map(|b| b ^ byte);
    let mut inner = Sha256::new_with_prefix(pad(0x36));
    for part in parts {
        inner.update(part);
    }
    let mut outer = Sha256::new_with_prefix(pad(0x5c));
    outer.update(inner.finalize());
    outer.finalize().into()
}

fn hex(text: &str) -> Option<Vec<u8>> {
    let digits: Option<Vec<u8>> = text
        .chars()
        .map(|c| c.to_digit(16).map(|d| d as u8))
        .collect();
    let digits = digits.filter(|d| d.len() % 2 == 0)?;
    Some(digits.chunks(2).map(|p| (p[0] << 4) | p[1]).collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn blob() -> Value {
        json!({"$type": "blob", "ref": {"$link": "bafkreiblob"}, "mimeType": "image/jpeg", "size": 1})
    }

    #[test]
    fn hmac_is_rfc_4231s() {
        let hex = |b: [u8; 32]| b.iter().map(|b| format!("{b:02x}")).collect::<String>();
        // Test cases 2 and 6: a short key, and one longer than a block.
        let mac = hmac_sha256(b"Jefe", &[b"what do ya want ", b"for nothing?"]);
        assert_eq!(
            hex(mac),
            "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843"
        );
        let mac = hmac_sha256(
            &[0xaa; 131],
            &[b"Test Using Larger Than Block-Size Key - Hash Key First"],
        );
        assert_eq!(
            hex(mac),
            "60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54"
        );
    }

    #[test]
    fn urls_are_signed_as_imgproxy_checks_them() {
        // imgproxy's own example: key "secret", salt "hello".
        let cdn = Cdn::new(
            Some("https://cdn.grain.social/"),
            Some("736563726574"),
            Some("68656c6c6f"),
        )
        .unwrap();
        let url = cdn.url("did:plc:alice", &blob(), AVATAR).unwrap();
        let path = "/avatar/plain/did:plc:alice/bafkreiblob";
        let mac = hmac_sha256(b"secret", &[b"hello", path.as_bytes()]);
        let sig = URL_SAFE_NO_PAD.encode(mac);
        assert_eq!(url, format!("https://cdn.grain.social/{sig}{path}"));
        assert_eq!(cdn.url("did:plc:alice", &json!({"cid": "x"}), AVATAR), None);
    }

    #[test]
    fn with_no_cdn_of_its_own_bluesky_draws_them() {
        let cdn = Cdn::new(None, None, None).unwrap();
        assert_eq!(cdn, Cdn::default());
        assert_eq!(
            cdn.url("did:plc:alice", &blob(), THUMBNAIL).unwrap(),
            "https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:alice/bafkreiblob@jpeg"
        );
    }

    #[test]
    fn a_cdn_needs_its_key_and_salt_in_hex() {
        let url = Some("https://cdn.grain.social");
        let why = |key, salt| Cdn::new(url, key, salt).unwrap_err().to_string();
        assert_eq!(
            why(Some("00"), None),
            "--cdn needs GRAIN_CDN_KEY and GRAIN_CDN_SALT"
        );
        assert_eq!(why(Some("0g"), Some("00")), "GRAIN_CDN_KEY is not hex");
        assert_eq!(why(Some("00"), Some("000")), "GRAIN_CDN_SALT is not hex");
    }
}
