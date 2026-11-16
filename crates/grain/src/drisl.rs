//! DRISL, atproto's deterministic CBOR (DAG-CBOR): records as the JSON
//! atproto writes them in, CIDs, and values encoded as they are hashed.

use sha2::{Digest, Sha256};

/// The bytes a CIDv1 of DRISL hashed with SHA-256 starts with: version,
/// codec (dag-cbor) and multihash (sha2-256, 32 bytes).
pub const CID_PREFIX: [u8; 4] = [0x01, 0x71, 0x12, 0x20];

/// The CID of `block`, a DRISL encoding, as bytes.
pub fn cid(block: &[u8]) -> Vec<u8> {
    [&CID_PREFIX[..], &Sha256::digest(block)].concat()
}

/// A CID's bytes as atproto writes them in text: base32, `b` first.
pub fn cid_text(cid: &[u8]) -> String {
    format!("b{}", crate::base32::encode(crate::base32::LOWER, cid))
}

/// A DAG-CBOR link to `cid`: tag 42 over a zero byte and the CID.
pub fn link_to(cid: &[u8]) -> ciborium::Value {
    ciborium::Value::Tag(42, Box::new(ciborium::Value::Bytes([&[0], cid].concat())))
}

/// `value` as DRISL: each map's keys shortest first, then bytewise, as
/// a commit is signed and a tree node hashed.
pub fn encode(value: &ciborium::Value) -> Vec<u8> {
    let mut out = Vec::new();
    ciborium::into_writer(&canonical(value), &mut out).expect("a Vec takes any write");
    out
}

fn canonical(value: &ciborium::Value) -> ciborium::Value {
    use ciborium::Value as V;
    let order = |k: &V| {
        let text = k.as_text().unwrap_or_default();
        (text.len(), text.to_string())
    };
    match value {
        V::Map(pairs) => {
            let mut pairs: Vec<_> = pairs
                .iter()
                .map(|(k, v)| (k.clone(), canonical(v)))
                .collect();
            pairs.sort_by_key(|(k, _)| order(k));
            V::Map(pairs)
        }
        V::Array(items) => V::Array(items.iter().map(canonical).collect()),
        V::Tag(tag, inner) => V::Tag(*tag, Box::new(canonical(inner))),
        other => other.clone(),
    }
}

/// The CID a DAG-CBOR link holds, as bytes.
pub fn link(value: &ciborium::Value) -> Option<&[u8]> {
    match value {
        ciborium::Value::Tag(42, inner) => inner.as_bytes()?.strip_prefix(&[0]),
        _ => None,
    }
}

/// A DAG-CBOR record as its JSON: links and bytes as atproto writes them.
/// `None` for what no record holds, as floats, for it to be fetched.
pub fn record(block: &[u8]) -> Option<serde_json::Value> {
    json(&ciborium::from_reader(block).ok()?)
}

fn json(value: &ciborium::Value) -> Option<serde_json::Value> {
    use base64::Engine;
    use ciborium::Value as V;
    use serde_json::{Value as J, json};
    Some(match value {
        V::Null => J::Null,
        V::Bool(b) => J::Bool(*b),
        V::Integer(i) => J::from(i64::try_from(*i).ok()?),
        V::Text(t) => J::String(t.clone()),
        V::Bytes(b) => {
            json!({"$bytes": base64::engine::general_purpose::STANDARD_NO_PAD.encode(b)})
        }
        V::Tag(42, _) => json!({ "$link": cid_text(link(value)?) }),
        V::Array(items) => J::Array(items.iter().map(json).collect::<Option<_>>()?),
        V::Map(pairs) => J::Object(
            pairs
                .iter()
                .map(|(k, v)| Some((k.as_text()?.to_string(), json(v)?)))
                .collect::<Option<_>>()?,
        ),
        _ => return None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use ciborium::Value as V;
    use serde_json::json;

    fn cbor(value: &V) -> Vec<u8> {
        let mut out = Vec::new();
        ciborium::into_writer(value, &mut out).unwrap();
        out
    }

    /// A DAG-CBOR link: tag 42 over a zero byte and a CIDv1 (dag-cbor,
    /// sha-256), whose base32 form always starts `bafyrei`.
    fn cid_link() -> V {
        let mut bytes = vec![0x00, 0x01, 0x71, 0x12, 0x20];
        bytes.extend([0x11; 32]);
        V::Tag(42, Box::new(V::Bytes(bytes)))
    }

    #[test]
    fn records_read_as_atproto_json() {
        let block = cbor(&V::Map(vec![
            (
                V::Text("$type".into()),
                V::Text("social.grain.photo".into()),
            ),
            (V::Text("width".into()), V::Integer(4032.into())),
            (V::Text("alt".into()), V::Null),
            (V::Text("nsfw".into()), V::Bool(false)),
            (V::Text("thumb".into()), V::Bytes(vec![1, 2, 3])),
            (
                V::Text("tags".into()),
                V::Array(vec![V::Text("film".into())]),
            ),
            (V::Text("ref".into()), cid_link()),
        ]));
        let record = record(&block).unwrap();
        assert_eq!(record["$type"], "social.grain.photo");
        assert_eq!(record["width"], 4032);
        assert_eq!(record["alt"], json!(null));
        assert_eq!(record["nsfw"], false);
        assert_eq!(record["thumb"], json!({"$bytes": "AQID"}));
        assert_eq!(record["tags"], json!(["film"]));
        let link = record["ref"]["$link"].as_str().unwrap();
        assert!(link.starts_with("bafyrei"), "{link}");
    }

    #[test]
    fn links_are_the_cid_without_its_zero_byte() {
        assert_eq!(link(&cid_link()).unwrap()[..4], [0x01, 0x71, 0x12, 0x20]);
        assert_eq!(link(&V::Bytes(vec![0, 1])), None);
        assert_eq!(link(&V::Tag(42, Box::new(V::Bytes(vec![1, 2])))), None);
    }

    #[test]
    fn cids_and_encodings() {
        // The empty map, {}: as atproto's CID for it.
        assert_eq!(
            cid_text(&cid(&[0xa0])),
            "bafyreigbtj4x7ip5legnfznufuopl4sg4knzc2cof6duas4b3q2fy6swua"
        );
        assert_eq!(link(&link_to(&cid(b"x"))).unwrap(), cid(b"x"));
        // Keys shortest first, then bytewise, in maps however deep.
        let text = |t: &str| V::Text(t.into());
        let map = |keys: &[&str]| V::Map(keys.iter().map(|k| (text(k), V::Null)).collect());
        let nested = V::Tag(7, Box::new(V::Array(vec![map(&["bb", "a", "ab", "c"])])));
        let sorted = V::Tag(7, Box::new(V::Array(vec![map(&["a", "c", "ab", "bb"])])));
        assert_eq!(encode(&nested), cbor(&sorted));
        assert_eq!(encode(&V::Integer(1.into())), vec![1]);
    }

    #[test]
    fn what_no_record_holds_is_refused() {
        assert_eq!(record(&cbor(&V::Float(1.5))), None);
        let float_inside = V::Map(vec![(V::Text("x".into()), V::Float(1.5))]);
        assert_eq!(record(&cbor(&float_inside)), None);
        let key_not_text = V::Map(vec![(V::Integer(1.into()), V::Null)]);
        assert_eq!(record(&cbor(&key_not_text)), None);
        assert_eq!(record(b"\xff"), None);
    }
}
