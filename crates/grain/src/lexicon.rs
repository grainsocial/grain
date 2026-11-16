//! Records checked against their lexicons before anything keeps them: the
//! schemas of the collections grain indexes, built in, and a validator of
//! a record against one.
//!
//! The rules follow the atproto specs: a string's `maxLength` counts UTF-8
//! bytes, not UTF-16 units; a `datetime` with an offset is valid whatever
//! day it falls on in UTC; and a DID may hold colons past its method
//! (`did:web:host:path`). Properties a schema does not name are allowed, a
//! union's value is checked against the definition its `$type` names
//! whether or not the union lists it (unless it is closed), and a string
//! format this does not know passes.

use serde_json::{Map, Value};
use std::collections::HashMap;
use unicode_segmentation::UnicodeSegmentation;

/// Why a record was refused: where in it, and what is wrong there.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Invalid {
    /// A path into the record, `facets[0].index`; empty for the record
    /// itself.
    pub path: String,
    pub message: String,
}

impl std::fmt::Display for Invalid {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self.path.as_str() {
            "" => write!(f, "{}", self.message),
            path => write!(f, "{path}: {}", self.message),
        }
    }
}

impl std::error::Error for Invalid {}

fn invalid(path: &str, message: impl Into<String>) -> Invalid {
    Invalid {
        path: path.to_string(),
        message: message.into(),
    }
}

/// The lexicons of every collection grain indexes, and of every
/// definition their records reach.
const BUILT_IN: &[&str] = &[
    include_str!("../../../lexicons/app/bsky/embed/defs.json"),
    include_str!("../../../lexicons/app/bsky/embed/external.json"),
    include_str!("../../../lexicons/app/bsky/embed/images.json"),
    include_str!("../../../lexicons/app/bsky/embed/record.json"),
    include_str!("../../../lexicons/app/bsky/embed/recordWithMedia.json"),
    include_str!("../../../lexicons/app/bsky/embed/video.json"),
    include_str!("../../../lexicons/app/bsky/feed/post.json"),
    include_str!("../../../lexicons/app/bsky/graph/follow.json"),
    include_str!("../../../lexicons/app/bsky/richtext/facet.json"),
    include_str!("../../../lexicons/com/atproto/label/defs.json"),
    include_str!("../../../lexicons/com/atproto/repo/strongRef.json"),
    include_str!("../../../lexicons/com/germnetwork/declaration.json"),
    include_str!("../../../lexicons/community/lexicon/location/address.json"),
    include_str!("../../../lexicons/community/lexicon/location/hthree.json"),
    include_str!("../../../lexicons/fyi/opensocial/declaration.json"),
    include_str!("../../../lexicons/social/grain/actor/profile.json"),
    include_str!("../../../lexicons/social/grain/comment/comment.json"),
    include_str!("../../../lexicons/social/grain/defs.json"),
    include_str!("../../../lexicons/social/grain/favorite/favorite.json"),
    include_str!("../../../lexicons/social/grain/gallery/gallery.json"),
    include_str!("../../../lexicons/social/grain/gallery/item.json"),
    include_str!("../../../lexicons/social/grain/graph/block.json"),
    include_str!("../../../lexicons/social/grain/graph/follow.json"),
    include_str!("../../../lexicons/social/grain/group/decline.json"),
    include_str!("../../../lexicons/social/grain/group/item.json"),
    include_str!("../../../lexicons/social/grain/group/submission.json"),
    include_str!("../../../lexicons/social/grain/photo/exif.json"),
    include_str!("../../../lexicons/social/grain/photo/photo.json"),
    include_str!("../../../lexicons/social/grain/story/story.json"),
];

/// Lexicon documents by NSID.
#[derive(Debug, Clone, Default)]
pub struct Lexicons {
    docs: HashMap<String, Value>,
}

impl Lexicons {
    /// The lexicons grain builds in ([`BUILT_IN`]).
    pub fn grain() -> Lexicons {
        let mut lexicons = Lexicons::default();
        for doc in BUILT_IN {
            let doc: Value = serde_json::from_str(doc).expect("a built-in lexicon is JSON");
            lexicons.add(doc);
        }
        lexicons
    }

    /// Adds a lexicon document, keyed by its `id`. One without is ignored.
    pub fn add(&mut self, doc: Value) {
        if let Some(id) = doc["id"].as_str() {
            self.docs.insert(id.to_string(), doc);
        }
    }

    /// The document of `nsid`.
    pub fn get(&self, nsid: &str) -> Option<&Value> {
        self.docs.get(nsid)
    }

    /// The NSIDs of the record collections among them.
    pub fn collections(&self) -> Vec<&str> {
        let mut out: Vec<&str> = self
            .docs
            .iter()
            .filter(|(_, d)| d["defs"]["main"]["type"] == "record")
            .map(|(id, _)| id.as_str())
            .collect();
        out.sort();
        out
    }

    /// Checks `record` against the record schema of `collection`.
    pub fn validate_record(&self, collection: &str, record: &Value) -> Result<(), Invalid> {
        let Some(doc) = self.docs.get(collection) else {
            return Err(invalid("", format!("unknown collection: {collection}")));
        };
        let main = &doc["defs"]["main"];
        if main.is_null() {
            return Err(invalid(
                "",
                format!("lexicon {collection} has no main definition"),
            ));
        }
        if main["type"] != "record" {
            return Err(invalid("", format!("{collection} is not a record type")));
        }
        self.object(record, &main["record"], "", collection)
    }

    /// Checks `record` as an index takes one from the network: as
    /// [`Lexicons::validate_record`] does, but for a gallery whose own
    /// strings run past their `maxLength`, which is kept. Galleries with
    /// titles past it are on the network; a view cuts them with [`cut`].
    /// A write is checked by [`Lexicons::validate_record`].
    pub fn validate_indexed(&self, collection: &str, record: &Value) -> Result<(), Invalid> {
        if collection != GALLERY {
            return self.validate_record(collection, record);
        }
        let properties = self.docs.get(collection);
        let properties =
            properties.and_then(|d| d["defs"]["main"]["record"]["properties"].as_object());
        let Some(properties) = properties else {
            return self.validate_record(collection, record);
        };
        let mut fitted = record.clone();
        for (name, schema) in properties {
            let Some(max) = schema["maxLength"]
                .as_u64()
                .filter(|_| schema["type"] == "string")
            else {
                continue;
            };
            if let Some(s) = fitted[name].as_str()
                && s.len() as u64 > max
            {
                let mut end = max as usize;
                while !s.is_char_boundary(end) {
                    end -= 1;
                }
                fitted[name] = s[..end].into();
            }
        }
        self.validate_record(collection, &fitted)
    }

    fn field(&self, data: &Value, schema: &Value, path: &str, lex: &str) -> Result<(), Invalid> {
        match schema["type"].as_str() {
            Some("string") => string(data, schema, path),
            Some("integer") => integer(data, schema, path),
            Some("boolean") => match data.is_boolean() {
                true => Ok(()),
                false => Err(invalid(path, "expected boolean")),
            },
            Some("object") => self.object(data, schema, path, lex),
            Some("array") => self.array(data, schema, path, lex),
            Some("blob") => blob(data, schema, path),
            Some("bytes") => bytes(data, schema, path),
            Some("union") => self.union(data, schema, path, lex),
            Some("ref") => self.reference(data, schema, path, lex, &mut Vec::new()),
            Some("cid-link") => cid_link(data, path),
            Some("token") => match data.as_str() {
                Some("") => Err(invalid(path, "token cannot be empty")),
                Some(_) => Ok(()),
                None => Err(invalid(path, "expected string for token")),
            },
            Some("unknown") => unknown(data, path),
            Some(other) => Err(invalid(path, format!("unknown type: {other}"))),
            None => Err(invalid(path, "missing schema type")),
        }
    }

    fn object(&self, data: &Value, schema: &Value, path: &str, lex: &str) -> Result<(), Invalid> {
        let Some(data) = data.as_object() else {
            return Err(invalid(path, "expected object"));
        };
        let empty = Map::new();
        let properties = schema["properties"].as_object().unwrap_or(&empty);
        let names = |key: &str| -> Vec<&str> {
            schema[key]
                .as_array()
                .map(|a| a.iter().filter_map(Value::as_str).collect())
                .unwrap_or_default()
        };
        for field in names("required") {
            if !data.contains_key(field) {
                return Err(invalid(
                    path,
                    format!("required field '{field}' is missing"),
                ));
            }
        }
        let nullable = names("nullable");
        for (name, value) in data {
            let Some(prop) = properties.get(name) else {
                continue;
            };
            let at = match path {
                "" => name.clone(),
                _ => format!("{path}.{name}"),
            };
            if value.is_null() {
                if !nullable.contains(&name.as_str()) {
                    return Err(invalid(&at, "null not allowed"));
                }
                continue;
            }
            self.field(value, prop, &at, lex)?;
        }
        Ok(())
    }

    fn array(&self, data: &Value, schema: &Value, path: &str, lex: &str) -> Result<(), Invalid> {
        let Some(items) = data.as_array() else {
            return Err(invalid(path, "expected array"));
        };
        let len = items.len() as u64;
        if let Some(min) = schema["minLength"].as_u64()
            && len < min
        {
            return Err(invalid(path, format!("array too short (min {min})")));
        }
        if let Some(max) = schema["maxLength"].as_u64()
            && len > max
        {
            return Err(invalid(path, format!("array too long (max {max})")));
        }
        for (i, item) in items.iter().enumerate() {
            self.field(item, &schema["items"], &format!("{path}[{i}]"), lex)?;
        }
        Ok(())
    }

    fn union(&self, data: &Value, schema: &Value, path: &str, lex: &str) -> Result<(), Invalid> {
        if !data.is_object() {
            return Err(invalid(path, "union value must be an object"));
        }
        let Some(kind) = data["$type"].as_str().filter(|t| !t.is_empty()) else {
            return Err(invalid(path, "union value must have $type"));
        };
        let refs: Vec<&str> = schema["refs"]
            .as_array()
            .map(|a| a.iter().filter_map(Value::as_str).collect())
            .unwrap_or_default();
        if schema["closed"] == true && !refs.contains(&kind) {
            return Err(invalid(path, format!("$type '{kind}' not in union refs")));
        }
        // A bare name the union lists as a local ref is that ref.
        let local = format!("#{kind}");
        let kind = match !kind.contains(['#', '.']) && refs.contains(&local.as_str()) {
            true => local.as_str(),
            false => kind,
        };
        let (nsid, name) = resolve(kind, lex);
        let def = self.def(nsid, name, path)?;
        self.field(data, def, path, nsid)
    }

    fn reference(
        &self,
        data: &Value,
        schema: &Value,
        path: &str,
        lex: &str,
        seen: &mut Vec<String>,
    ) -> Result<(), Invalid> {
        let Some(target) = schema["ref"].as_str() else {
            return Err(invalid(path, "ref schema missing ref field"));
        };
        let (nsid, name) = resolve(target, lex);
        let key = format!("{nsid}#{name}");
        if seen.contains(&key) {
            return Err(invalid(path, format!("Circular reference detected: {key}")));
        }
        seen.push(key);
        let def = self.def(nsid, name, path)?;
        if def["type"] == "ref" {
            return self.reference(data, def, path, nsid, seen);
        }
        self.field(data, def, path, nsid)
    }

    fn def(&self, nsid: &str, name: &str, path: &str) -> Result<&Value, Invalid> {
        let Some(doc) = self.docs.get(nsid) else {
            return Err(invalid(path, format!("Lexicon '{nsid}' not found")));
        };
        match doc["defs"].get(name) {
            Some(def) => Ok(def),
            None => Err(invalid(
                path,
                format!("Definition '{name}' not found in lexicon '{nsid}'"),
            )),
        }
    }
}

/// The collection [`Lexicons::validate_indexed`] lets run long.
const GALLERY: &str = "social.grain.gallery";

/// `text`'s first `graphemes` graphemes, or all of it if it has no more:
/// how a view shows a string that runs past its lexicon's bound.
pub fn cut(text: &str, graphemes: usize) -> &str {
    match text.grapheme_indices(true).nth(graphemes) {
        Some((end, _)) => &text[..end],
        None => text,
    }
}

/// The NSID and definition a ref names, `#local` ones in `lex`.
fn resolve<'a>(target: &'a str, lex: &'a str) -> (&'a str, &'a str) {
    match target.split_once('#') {
        Some(("", name)) => (lex, name),
        Some((nsid, name)) => (nsid, name),
        None => (target, "main"),
    }
}

fn string(data: &Value, schema: &Value, path: &str) -> Result<(), Invalid> {
    let Some(s) = data.as_str() else {
        return Err(invalid(path, "expected string"));
    };
    let bytes = s.len() as u64;
    if let Some(min) = schema["minLength"].as_u64()
        && bytes < min
    {
        return Err(invalid(path, format!("string too short (min {min})")));
    }
    if let Some(max) = schema["maxLength"].as_u64()
        && bytes > max
    {
        return Err(invalid(path, format!("string too long (max {max})")));
    }
    let graphemes = || s.graphemes(true).count() as u64;
    if let Some(min) = schema["minGraphemes"].as_u64()
        && graphemes() < min
    {
        return Err(invalid(path, format!("too few graphemes (min {min})")));
    }
    if let Some(max) = schema["maxGraphemes"].as_u64()
        && graphemes() > max
    {
        return Err(invalid(path, format!("too many graphemes (max {max})")));
    }
    if let Some(choices) = schema["enum"].as_array()
        && !choices.iter().any(|c| c == s)
    {
        return Err(invalid(path, "value not in enum"));
    }
    if let Some(constant) = schema.get("const")
        && constant != s
    {
        return Err(invalid(path, format!("value must be {constant}")));
    }
    if let Some(format) = schema["format"].as_str()
        && !valid_format(format, s)
    {
        return Err(invalid(path, format!("invalid {format} format")));
    }
    Ok(())
}

fn integer(data: &Value, schema: &Value, path: &str) -> Result<(), Invalid> {
    let n = match data {
        Value::Number(n) => n
            .as_i64()
            .or_else(|| n.as_f64().filter(|f| f.fract() == 0.0).map(|f| f as i64)),
        _ => None,
    };
    let Some(n) = n else {
        return Err(invalid(path, "expected integer"));
    };
    if let Some(min) = schema["minimum"].as_i64()
        && n < min
    {
        return Err(invalid(path, format!("value below minimum ({min})")));
    }
    if let Some(max) = schema["maximum"].as_i64()
        && n > max
    {
        return Err(invalid(path, format!("value above maximum ({max})")));
    }
    if let Some(choices) = schema["enum"].as_array()
        && !choices.iter().any(|c| c.as_i64() == Some(n))
    {
        return Err(invalid(path, "value not in enum"));
    }
    Ok(())
}

fn blob(data: &Value, schema: &Value, path: &str) -> Result<(), Invalid> {
    let Some(fields) = data.as_object() else {
        return Err(invalid(path, "expected blob object"));
    };
    if data["$type"] != "blob" {
        return Err(invalid(path, "blob must have $type: \"blob\""));
    }
    let Some(cid) = data["ref"]["$link"].as_str() else {
        return Err(invalid(path, "blob must have ref.$link"));
    };
    if !valid_cid(cid) {
        return Err(invalid(path, "invalid CID in blob ref"));
    }
    if !cid.starts_with("bafkrei") {
        return Err(invalid(path, "blob CID must use raw multicodec"));
    }
    let mime = data["mimeType"].as_str().unwrap_or_default();
    if mime.is_empty() {
        return Err(invalid(path, "blob must have non-empty mimeType"));
    }
    let Some(size) = data["size"].as_f64() else {
        return Err(invalid(path, "blob must have size"));
    };
    if size < 0.0 {
        return Err(invalid(path, "blob size must be non-negative"));
    }
    if let Some(max) = schema["maxSize"].as_f64()
        && size > max
    {
        return Err(invalid(path, format!("blob size exceeds maxSize ({max})")));
    }
    if let Some(accept) = schema["accept"].as_array().filter(|a| !a.is_empty()) {
        let kind = mime.split('/').next().unwrap_or_default();
        let accepted = accept.iter().filter_map(Value::as_str).any(|pattern| {
            pattern == "*/*"
                || pattern == mime
                || pattern
                    .strip_suffix("/*")
                    .is_some_and(|prefix| prefix == kind)
        });
        if !accepted {
            return Err(invalid(path, format!("MIME type {mime} not accepted")));
        }
    }
    if let Some(extra) = fields
        .keys()
        .find(|k| !["$type", "ref", "mimeType", "size"].contains(&k.as_str()))
    {
        return Err(invalid(path, format!("unexpected field '{extra}' in blob")));
    }
    Ok(())
}

fn bytes(data: &Value, schema: &Value, path: &str) -> Result<(), Invalid> {
    use base64::Engine;
    let Some(fields) = data.as_object() else {
        return Err(invalid(path, "expected bytes object"));
    };
    let Some(encoded) = fields.get("$bytes") else {
        return Err(invalid(path, "bytes object must have $bytes field"));
    };
    let Some(encoded) = encoded.as_str() else {
        return Err(invalid(path, "$bytes must be a string"));
    };
    if fields.len() != 1 {
        return Err(invalid(path, "bytes object must have exactly one field"));
    }
    // atproto's JSON writes bytes as unpadded base64; padded is read too.
    let engine = base64::engine::GeneralPurpose::new(
        &base64::alphabet::STANDARD,
        base64::engine::GeneralPurposeConfig::new()
            .with_decode_padding_mode(base64::engine::DecodePaddingMode::Indifferent),
    );
    let Ok(decoded) = engine.decode(encoded) else {
        return Err(invalid(path, "invalid base64 in $bytes"));
    };
    let len = decoded.len() as u64;
    if let Some(min) = schema["minLength"].as_u64()
        && len < min
    {
        return Err(invalid(path, format!("bytes too short (min {min})")));
    }
    if let Some(max) = schema["maxLength"].as_u64()
        && len > max
    {
        return Err(invalid(path, format!("bytes too long (max {max})")));
    }
    Ok(())
}

fn cid_link(data: &Value, path: &str) -> Result<(), Invalid> {
    if !data.is_object() {
        return Err(invalid(path, "expected CID link object"));
    }
    match &data["$link"] {
        Value::Null => Err(invalid(path, "CID link must have $link field")),
        Value::String(cid) if valid_cid(cid) => Ok(()),
        Value::String(_) => Err(invalid(path, "invalid CID format in $link")),
        _ => Err(invalid(path, "CID link $link must be a string")),
    }
}

fn unknown(data: &Value, path: &str) -> Result<(), Invalid> {
    match data {
        Value::Object(o) if o.contains_key("$bytes") => {
            Err(invalid(path, "unknown cannot be a bytes object"))
        }
        Value::Object(_) if data["$type"] == "blob" => {
            Err(invalid(path, "unknown cannot be a blob"))
        }
        Value::Object(_) => Ok(()),
        Value::Array(_) => Err(invalid(path, "unknown cannot be an array")),
        _ => Err(invalid(path, "unknown must be an object")),
    }
}

/// Whether `value` is of the string format `format`. One this does not
/// know passes.
pub fn valid_format(format: &str, value: &str) -> bool {
    match format {
        "datetime" => valid_datetime(value),
        "handle" => valid_handle(value),
        "did" => valid_did(value),
        "uri" => valid_uri(value),
        "at-uri" => valid_at_uri(value),
        "tid" => valid_tid(value),
        "record-key" => valid_record_key(value),
        "cid" => valid_cid(value),
        "language" => valid_language(value),
        "nsid" => valid_nsid(value),
        "at-identifier" => valid_did(value) || valid_handle(value),
        _ => true,
    }
}

/// RFC 3339 with a zone and whole seconds at least:
/// `2026-10-31T12:00:00.000Z`, `2026-10-31T12:00:00+05:30`.
pub fn valid_datetime(value: &str) -> bool {
    let b = value.as_bytes();
    if value.is_empty() || b.len() > 64 || value.contains("-00:00") || b.len() < 20 {
        return false;
    }
    let digits = |range: std::ops::Range<usize>| -> Option<u32> {
        let part = b.get(range)?;
        part.iter()
            .all(u8::is_ascii_digit)
            .then(|| std::str::from_utf8(part).ok()?.parse().ok())?
    };
    let (Some(year), Some(month), Some(day), Some(hour), Some(minute), Some(second)) = (
        digits(0..4),
        digits(5..7),
        digits(8..10),
        digits(11..13),
        digits(14..16),
        digits(17..19),
    ) else {
        return false;
    };
    if b[4] != b'-' || b[7] != b'-' || b[10] != b'T' || b[13] != b':' || b[16] != b':' {
        return false;
    }
    let mut rest = &b[19..];
    if let Some(fraction) = rest.strip_prefix(b".") {
        let n = fraction.iter().take_while(|c| c.is_ascii_digit()).count();
        if n == 0 {
            return false;
        }
        rest = &fraction[n..];
    }
    let zoned = match rest {
        [b'Z'] => true,
        [b'+' | b'-', h1, h2, b':', m1, m2]
            if [h1, h2, m1, m2].iter().all(|c| c.is_ascii_digit()) =>
        {
            let two = |a: u8, b: u8| u32::from(a - b'0') * 10 + u32::from(b - b'0');
            two(*h1, *h2) < 24 && two(*m1, *m2) < 60
        }
        _ => false,
    };
    zoned
        && (1..=12).contains(&month)
        && day >= 1
        && day <= days_in_month(year, month)
        && hour < 24
        && minute < 60
        && second < 60
}

fn days_in_month(year: u32, month: u32) -> u32 {
    match month {
        4 | 6 | 9 | 11 => 30,
        2 if year.is_multiple_of(4) && (!year.is_multiple_of(100) || year.is_multiple_of(400)) => {
            29
        }
        2 => 28,
        _ => 31,
    }
}

const DISALLOWED_TLDS: [&str; 8] = [
    "alt",
    "arpa",
    "example",
    "internal",
    "invalid",
    "local",
    "localhost",
    "onion",
];

/// A DNS name of two labels or more, none of the TLDs atproto refuses.
pub fn valid_handle(value: &str) -> bool {
    if value.is_empty() || value.len() > 253 || !value.contains('.') {
        return false;
    }
    let tld = value
        .rsplit('.')
        .next()
        .unwrap_or_default()
        .to_ascii_lowercase();
    if DISALLOWED_TLDS.contains(&tld.as_str()) {
        return false;
    }
    value.split('.').all(|label| {
        let b = label.as_bytes();
        !b.is_empty()
            && b.iter().all(|c| c.is_ascii_alphanumeric() || *c == b'-')
            && b[0] != b'-'
            && b[b.len() - 1] != b'-'
    })
}

/// `did:<method>:<id>`, as atproto's DID syntax has it.
pub fn valid_did(value: &str) -> bool {
    if value.len() > 2048 || value.ends_with('%') || value.ends_with(':') {
        return false;
    }
    let Some(rest) = value.strip_prefix("did:") else {
        return false;
    };
    let Some((method, id)) = rest.split_once(':') else {
        return false;
    };
    !method.is_empty()
        && method.bytes().all(|c| c.is_ascii_lowercase())
        && !id.is_empty()
        && id
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || b"._:%-".contains(&c))
}

/// A URI with a scheme, as RFC 3986 has it, and something after it.
pub fn valid_uri(value: &str) -> bool {
    if value.is_empty() || value.len() > 8192 {
        return false;
    }
    let Some((scheme, rest)) = value.split_once(':') else {
        return false;
    };
    let b = scheme.as_bytes();
    !b.is_empty()
        && b[0].is_ascii_alphabetic()
        && b.iter()
            .all(|c| c.is_ascii_alphanumeric() || b"+.-".contains(c))
        && !rest.is_empty()
        && !value.chars().any(|c| c.is_whitespace() || c.is_control())
}

/// `at://<authority>[/<collection>[/<rkey>]]`, or a permissioned space or
/// a record in one: `at://<did>/space/<type>/<skey>[/<did>/<collection>/<rkey>]`.
pub fn valid_at_uri(value: &str) -> bool {
    if value.len() > 8192 {
        return false;
    }
    let Some(rest) = value.strip_prefix("at://") else {
        return false;
    };
    let parts: Vec<&str> = rest.split('/').collect();
    let authority = parts[0];
    if authority.is_empty() || !(valid_did(authority) || valid_handle(authority)) {
        return false;
    }
    match parts.get(1) {
        Some(&"space") => match parts[..] {
            [authority, _, kind, skey] => {
                valid_did(authority) && valid_nsid(kind) && !skey.is_empty()
            }
            [authority, _, kind, skey, writer, collection, rkey] => {
                valid_did(authority)
                    && valid_nsid(kind)
                    && !skey.is_empty()
                    && valid_did(writer)
                    && valid_nsid(collection)
                    && !rkey.is_empty()
            }
            _ => false,
        },
        Some(collection) if !collection.is_empty() => valid_nsid(collection),
        _ => true,
    }
}

pub fn valid_tid(value: &str) -> bool {
    const SORTABLE: &[u8] = b"234567abcdefghijklmnopqrstuvwxyz";
    let b = value.as_bytes();
    b.len() == 13 && b"234567abcdefghij".contains(&b[0]) && b.iter().all(|c| SORTABLE.contains(c))
}

pub fn valid_record_key(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 512
        && value != "."
        && value != ".."
        && value
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || b"._:~-".contains(&c))
}

/// A CID as atproto blesses one: v1, in a multibase of letters and digits.
pub fn valid_cid(value: &str) -> bool {
    (8..=256).contains(&value.len())
        && !value.starts_with("Qmb")
        && value.bytes().all(|c| c.is_ascii_alphanumeric())
}

pub fn valid_language(value: &str) -> bool {
    if value.is_empty() || value.len() > 128 {
        return false;
    }
    if value.starts_with("i-") {
        return true;
    }
    let mut parts = value.split('-');
    let primary = parts.next().unwrap_or_default();
    (2..=3).contains(&primary.len())
        && primary.bytes().all(|c| c.is_ascii_alphabetic())
        && parts.all(|p| !p.is_empty() && p.bytes().all(|c| c.is_ascii_alphanumeric()))
}

pub fn valid_nsid(value: &str) -> bool {
    if value.is_empty() || value.len() > 317 {
        return false;
    }
    let parts: Vec<&str> = value.split('.').collect();
    if parts.len() < 3 {
        return false;
    }
    let (name, domain) = parts.split_last().expect("three parts or more");
    let n = name.as_bytes();
    let name_ok =
        !n.is_empty() && n[0].is_ascii_lowercase() && n.iter().all(u8::is_ascii_alphanumeric);
    name_ok
        && domain.iter().all(|part| {
            let b = part.as_bytes();
            !b.is_empty()
                && b.iter().all(|c| c.is_ascii_alphanumeric() || *c == b'-')
                && b[0] != b'-'
                && b[b.len() - 1] != b'-'
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    const BLOB: &str = "bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy";
    const NOW: &str = "2026-10-31T12:00:00.000Z";

    fn check(collection: &str, record: Value) -> Result<(), Invalid> {
        Lexicons::grain().validate_record(collection, &record)
    }

    fn refused(collection: &str, record: Value) -> Invalid {
        check(collection, record).expect_err("refused")
    }

    #[test]
    fn every_built_in_ref_resolves() {
        let lexicons = Lexicons::grain();
        fn walk(lexicons: &Lexicons, node: &Value, lex: &str, seen: &mut Vec<String>) {
            match node {
                Value::Object(o) => {
                    let mut targets: Vec<&str> = Vec::new();
                    if node["type"] == "ref" {
                        targets.extend(node["ref"].as_str());
                    }
                    if node["type"] == "union" {
                        targets.extend(
                            o["refs"]
                                .as_array()
                                .unwrap()
                                .iter()
                                .filter_map(Value::as_str),
                        );
                    }
                    for target in targets {
                        let (nsid, name) = resolve(target, lex);
                        let key = format!("{nsid}#{name}");
                        if seen.contains(&key) {
                            continue;
                        }
                        seen.push(key.clone());
                        let def = lexicons
                            .def(nsid, name, "")
                            .unwrap_or_else(|e| panic!("{key}: {e}"));
                        walk(lexicons, def, nsid, seen);
                    }
                    for (k, v) in o {
                        if k != "refs" {
                            walk(lexicons, v, lex, seen);
                        }
                    }
                }
                Value::Array(a) => a.iter().for_each(|v| walk(lexicons, v, lex, seen)),
                _ => {}
            }
        }
        for collection in lexicons.collections() {
            let record = &lexicons.get(collection).unwrap()["defs"]["main"]["record"];
            walk(&lexicons, record, collection, &mut Vec::new());
        }
        assert!(lexicons.collections().contains(&"social.grain.gallery"));
    }

    #[test]
    fn records_that_fit_pass() {
        let gallery = json!({
            "$type": "social.grain.gallery", "title": "Fog", "createdAt": NOW,
            "description": "#mist over the bay",
            "facets": [{"index": {"byteStart": 0, "byteEnd": 5},
                        "features": [{"$type": "app.bsky.richtext.facet#tag", "tag": "mist"}]}],
            "labels": {"$type": "com.atproto.label.defs#selfLabels", "values": [{"val": "nudity"}]},
            "location": {"value": "8a28a98a4c67fff", "name": "Ocean Beach"},
            "address": {"country": "US", "locality": "San Francisco"},
            "unknownField": [1, 2, 3],
        });
        check("social.grain.gallery", gallery).unwrap();
        let photo = json!({
            "$type": "social.grain.photo", "createdAt": "2026-10-31T12:00:00+05:30",
            "photo": {"$type": "blob", "ref": {"$link": BLOB}, "mimeType": "image/jpeg", "size": 1000},
            "aspectRatio": {"width": 3, "height": 2}, "alt": "fog",
        });
        check("social.grain.photo", photo).unwrap();
        let germ = json!({"$type": "com.germnetwork.declaration", "version": "1.0.0",
            "currentKey": {"$bytes": "AQID"}, "messageMe": {"showButtonTo": "everyone", "messageMeUrl": "https://example.com"}});
        check("com.germnetwork.declaration", germ).unwrap();
        let post = json!({"$type": "app.bsky.feed.post", "text": "", "createdAt": NOW,
            "langs": ["en", "pt-BR"],
            "embed": {"$type": "app.bsky.embed.external", "external": {"uri": "https://grain.social/profile/a/gallery/b", "title": "t", "description": "d"}}});
        check("app.bsky.feed.post", post).unwrap();
        let comment = json!({"$type": "social.grain.comment", "text": "nice", "createdAt": NOW,
            "subject": "at://did:web:host:path/social.grain.gallery/3l3qo2vuowo2a"});
        check("social.grain.comment", comment).unwrap();
    }

    #[test]
    fn an_index_keeps_a_gallery_that_runs_long() {
        let lexicons = Lexicons::grain();
        let indexed =
            |collection: &str, record: Value| lexicons.validate_indexed(collection, &record);
        let long = "\u{e9}".repeat(80);
        let gallery = json!({"title": long, "description": "d".repeat(1001), "createdAt": NOW});
        indexed("social.grain.gallery", gallery.clone()).unwrap();
        let titled = json!({"title": long, "createdAt": NOW});
        assert_eq!(
            refused("social.grain.gallery", titled).message,
            "string too long (max 100)"
        );
        // Only a gallery's length runs past its bound.
        let wrong = json!({"title": long, "createdAt": "yesterday"});
        let e = indexed("social.grain.gallery", wrong).unwrap_err();
        assert_eq!(
            (e.path.as_str(), e.message.as_str()),
            ("createdAt", "invalid datetime format")
        );
        let untitled = json!({"title": 7, "createdAt": NOW});
        assert_eq!(
            indexed("social.grain.gallery", untitled)
                .unwrap_err()
                .message,
            "expected string"
        );
        let place = json!({"title": "t", "createdAt": NOW,
            "address": {"country": "x".repeat(11)}});
        let e = indexed("social.grain.gallery", place).unwrap_err();
        assert_eq!(e.path, "address.country");
        let profile = json!({"displayName": "n".repeat(641)});
        let e = indexed("social.grain.actor.profile", profile).unwrap_err();
        assert_eq!(e.message, "string too long (max 640)");
    }

    #[test]
    fn a_view_cuts_by_graphemes() {
        assert_eq!(cut("abc", 5), "abc");
        assert_eq!(cut("abc", 2), "ab");
        let accented = "e\u{301}".repeat(3);
        assert_eq!(cut(&accented, 2), "e\u{301}e\u{301}");
        assert_eq!(cut(&"\u{e9}".repeat(120), 100).chars().count(), 100);
    }

    #[test]
    fn records_that_do_not_fit_are_refused() {
        let item = |position: Value| {
            json!({"createdAt": NOW, "gallery": "at://did:plc:a/social.grain.gallery/k",
                   "item": "at://did:plc:a/social.grain.photo/k", "position": position})
        };
        assert_eq!(
            refused("social.grain.gallery.item", item(json!(1.5))).message,
            "expected integer"
        );
        check("social.grain.gallery.item", item(json!(2))).unwrap();
        let missing = refused("social.grain.gallery", json!({"createdAt": NOW}));
        assert_eq!(missing.message, "required field 'title' is missing");
        let long = refused(
            "social.grain.gallery",
            json!({"title": "x".repeat(101), "createdAt": NOW}),
        );
        assert_eq!(
            (long.path.as_str(), long.message.as_str()),
            ("title", "string too long (max 100)")
        );
        let null = refused(
            "social.grain.gallery",
            json!({"title": "t", "createdAt": NOW, "description": null}),
        );
        assert_eq!(null.message, "null not allowed");
        for bad in [
            "2026-02-30T00:00:00Z",
            "2026-10-31 12:00:00Z",
            "2026-10-31T12:00:00",
            "2026-10-31T12:00:00-00:00",
            "yesterday",
        ] {
            let e = refused(
                "social.grain.favorite",
                json!({"createdAt": bad, "subject": "at://did:plc:a/social.grain.gallery/k"}),
            );
            assert_eq!(e.message, "invalid datetime format", "{bad}");
        }
        let uri = refused(
            "social.grain.favorite",
            json!({"createdAt": NOW, "subject": "https://grain.social"}),
        );
        assert_eq!(
            (uri.path.as_str(), uri.message.as_str()),
            ("subject", "invalid at-uri format")
        );
        let did = refused(
            "social.grain.graph.follow",
            json!({"createdAt": NOW, "subject": "alice.test"}),
        );
        assert_eq!(did.message, "invalid did format");
        let blob = |b: Value| json!({"createdAt": NOW, "aspectRatio": {"width": 1, "height": 1}, "photo": b});
        let cases = [
            (
                json!({"$type": "blob", "ref": {"$link": "bafyreia4w4bbvc5lqzkvexqlbwbagz5yfjfzzrqhfwqkhkk2xgekh4c6ai"}, "mimeType": "image/png", "size": 1}),
                "blob CID must use raw multicodec",
            ),
            (
                json!({"cid": BLOB, "mimeType": "image/png"}),
                "blob must have $type: \"blob\"",
            ),
            (
                json!({"$type": "blob", "ref": {"$link": BLOB}, "mimeType": "video/mp4", "size": 1}),
                "MIME type video/mp4 not accepted",
            ),
            (
                json!({"$type": "blob", "ref": {"$link": BLOB}, "mimeType": "image/png", "size": 2_000_000}),
                "blob size exceeds maxSize (1000000)",
            ),
            (
                json!({"$type": "blob", "ref": {"$link": BLOB}, "mimeType": "image/png", "size": 1, "extra": 1}),
                "unexpected field 'extra' in blob",
            ),
        ];
        for (b, message) in cases {
            assert_eq!(refused("social.grain.photo", blob(b)).message, message);
        }
        let ratio = refused(
            "social.grain.photo",
            json!({"createdAt": NOW, "aspectRatio": {"width": 0, "height": 1},
            "photo": {"$type": "blob", "ref": {"$link": BLOB}, "mimeType": "image/png", "size": 1}}),
        );
        assert_eq!(
            (ratio.path.as_str(), ratio.message.as_str()),
            ("aspectRatio.width", "value below minimum (1)")
        );
        let graphemes = refused(
            "social.grain.actor.profile",
            json!({"displayName": "e\u{301}".repeat(65)}),
        );
        assert_eq!(graphemes.message, "too many graphemes (max 64)");
        check(
            "social.grain.actor.profile",
            json!({"displayName": "👩‍👩‍👧".repeat(30)}),
        )
        .unwrap();
        let union = refused(
            "social.grain.gallery",
            json!({"title": "t", "createdAt": NOW, "labels": {"values": []}}),
        );
        assert_eq!(union.message, "union value must have $type");
        let unknown_type = refused(
            "social.grain.gallery",
            json!({"title": "t", "createdAt": NOW, "labels": {"$type": "com.example.nope"}}),
        );
        assert_eq!(unknown_type.message, "Lexicon 'com.example.nope' not found");
        let bytes = refused(
            "com.germnetwork.declaration",
            json!({"version": "1.0.0", "currentKey": {"$bytes": "!!"}}),
        );
        assert_eq!(bytes.message, "invalid base64 in $bytes");
        assert_eq!(
            refused("social.grain.nope", json!({})).message,
            "unknown collection: social.grain.nope"
        );
        assert_eq!(
            refused("social.grain.defs", json!({})).message,
            "lexicon social.grain.defs has no main definition"
        );
        assert_eq!(
            refused("social.grain.gallery", json!([])).message,
            "expected object"
        );
    }

    #[test]
    fn formats() {
        for ok in [
            "did:plc:abc123",
            "did:web:localhost%3A2583",
            "did:web:host:path",
        ] {
            assert!(valid_did(ok), "{ok}");
        }
        for bad in [
            "did:PLC:a",
            "did:plc:",
            "did:plc:a%",
            "plc:a",
            "did:plc:a b",
        ] {
            assert!(!valid_did(bad), "{bad}");
        }
        assert!(valid_handle("alice.grain.social"));
        for bad in ["alice", "alice.test.local", "-a.com", "a..com", "a_b.com"] {
            assert!(!valid_handle(bad), "{bad}");
        }
        assert!(valid_at_uri("at://alice.grain.social"));
        assert!(valid_at_uri(
            "at://did:plc:a/social.grain.gallery/3l3qo2vuowo2a"
        ));
        assert!(valid_at_uri(
            "at://did:plc:a/space/fyi.opensocial.members/self"
        ));
        assert!(valid_at_uri(
            "at://did:plc:a/space/social.grain.group/k/did:plc:b/social.grain.gallery/r"
        ));
        assert!(!valid_at_uri(
            "at://did:plc:a/space/social.grain.group/k/did:plc:b"
        ));
        assert!(!valid_at_uri("at://did:plc:a/notansid/k"));
        assert!(valid_tid("3l3qo2vuowo2a") && !valid_tid("kl3qo2vuowo2a") && !valid_tid("3l3qo"));
        assert!(valid_record_key("self") && !valid_record_key("..") && !valid_record_key("a/b"));
        assert!(valid_cid(BLOB) && !valid_cid("Qmbabcdefgh") && !valid_cid("short"));
        assert!(valid_language("en") && valid_language("pt-BR") && valid_language("i-klingon"));
        assert!(!valid_language("english") && !valid_language("en-"));
        assert!(
            valid_nsid("social.grain.gallery")
                && !valid_nsid("grain.gallery")
                && !valid_nsid("social.grain.Gallery")
        );
        assert!(
            valid_uri("https://grain.social/x")
                && valid_uri("mailto:a@b.c")
                && !valid_uri("no scheme")
        );
        assert!(
            valid_datetime("2024-02-29T23:59:59.999999Z")
                && !valid_datetime("2023-02-29T00:00:00Z")
        );
        assert!(valid_datetime("2026-01-02T01:00:00+05:00"));
        assert!(!valid_datetime("2026-13-01T00:00:00Z") && !valid_datetime("2026-01-01T24:00:00Z"));
        assert!(
            !valid_datetime("2026-01-01T00:00:00.Z") && !valid_datetime("2026-01-01T00:00:00+5:00")
        );
        assert!(valid_format("space-ref", "anything"));
        let formats = [
            ("handle", "alice.test"),
            ("did", "did:plc:a"),
            ("uri", "https://a.b"),
            ("tid", "3l3qo2vuowo2a"),
            ("record-key", "self"),
            ("cid", BLOB),
            ("language", "en"),
            ("nsid", "a.b.c"),
            ("at-identifier", "did:plc:a"),
            ("at-identifier", "alice.test"),
        ];
        for (format, ok) in formats {
            assert!(valid_format(format, ok), "{format}");
            assert!(!valid_format(format, " "), "{format}");
        }
        for bad in [
            "20x6-10-31T12:00:00Z",
            "2026-04-31T00:00:00Z",
            "1900-02-29T00:00:00Z",
            "2026-01-01T00:00:00+24:00",
            "2026-01-01T00:00:60Z",
        ] {
            assert!(!valid_datetime(bad), "{bad}");
        }
        assert!(valid_datetime("2026-01-01T00:00:00-08:00"));
        assert!(!valid_handle(&format!("{}.com", "a".repeat(250))));
        assert!(!valid_did(&format!("did:plc:{}", "a".repeat(2048))) && !valid_did("did:plc"));
        assert!(
            !valid_uri(&"a".repeat(8193))
                && !valid_uri("1a:b")
                && !valid_uri("a:")
                && !valid_uri("")
        );
        assert!(!valid_at_uri(&format!(
            "at://did:plc:a/{}",
            "a".repeat(8192)
        )));
        assert!(
            !valid_at_uri("did:plc:a")
                && !valid_at_uri("at:///a.b.c")
                && valid_at_uri("at://did:plc:a/")
        );
        assert!(!valid_language("") && !valid_language("e1"));
        assert!(
            !valid_nsid(&format!("a.b.{}", "c".repeat(320)))
                && !valid_nsid("a.-b.c")
                && !valid_nsid("")
        );
    }

    #[test]
    fn every_rule() {
        let mut lexicons = Lexicons::grain();
        lexicons.add(json!({"defs": {}}));
        lexicons.add(
            json!({"lexicon": 1, "id": "com.example.obj", "defs": {"main": {"type": "object"}}}),
        );
        lexicons.add(json!({"lexicon": 1, "id": "com.example.all", "defs": {
            "main": {"type": "record", "record": {"type": "object", "nullable": ["maybe"], "properties": {
                "flag": {"type": "boolean"},
                "tok": {"type": "token"},
                "any": {"type": "unknown"},
                "link": {"type": "cid-link"},
                "loop": {"type": "ref", "ref": "#loopA"},
                "noref": {"type": "ref"},
                "missingDef": {"type": "ref", "ref": "#nope"},
                "chain": {"type": "ref", "ref": "#chainA"},
                "list": {"type": "array", "minLength": 1, "maxLength": 2,
                         "items": {"type": "integer", "maximum": 5, "enum": [1, 2, 5]}},
                "short": {"type": "string", "minLength": 2, "minGraphemes": 2},
                "pick": {"type": "string", "enum": ["a"]},
                "fixed": {"type": "string", "const": "x"},
                "raw": {"type": "bytes", "minLength": 2, "maxLength": 3},
                "pic": {"type": "blob"},
                "choice": {"type": "union", "refs": ["#branch"], "closed": true},
                "open": {"type": "union", "refs": ["#branch"]},
                "untyped": {"type": "weird"},
                "typeless": {"description": "no type"},
                "maybe": {"type": "string"},
            }}},
            "loopA": {"type": "ref", "ref": "#loopB"},
            "loopB": {"type": "ref", "ref": "#loopA"},
            "chainA": {"type": "ref", "ref": "#chainB"},
            "chainB": {"type": "object", "properties": {}},
            "branch": {"type": "object", "required": ["n"], "properties": {"n": {"type": "integer"}}},
        }}));
        let blob = |extra: Value| {
            let mut b = json!({"$type": "blob", "ref": {"$link": BLOB}, "mimeType": "image/png", "size": 1});
            for (k, v) in extra.as_object().unwrap() {
                match v {
                    Value::Null => b.as_object_mut().unwrap().remove(k),
                    v => b.as_object_mut().unwrap().insert(k.clone(), v.clone()),
                };
            }
            b
        };
        let cases = [
            (
                json!({"flag": true, "tok": "a", "any": {}, "link": {"$link": BLOB}, "chain": {},
                    "list": [1], "short": "ab", "pick": "a", "fixed": "x", "raw": {"$bytes": "AQI"},
                    "pic": blob(json!({})), "choice": {"$type": "#branch", "n": 1},
                    "open": {"$type": "branch", "n": 1}, "maybe": null}),
                "",
            ),
            (json!({"flag": 1}), "expected boolean"),
            (json!({"tok": ""}), "token cannot be empty"),
            (json!({"tok": 1}), "expected string for token"),
            (
                json!({"any": {"$bytes": "AQ"}}),
                "unknown cannot be a bytes object",
            ),
            (
                json!({"any": {"$type": "blob"}}),
                "unknown cannot be a blob",
            ),
            (json!({"any": []}), "unknown cannot be an array"),
            (json!({"any": 1}), "unknown must be an object"),
            (json!({"link": 1}), "expected CID link object"),
            (json!({"link": {}}), "CID link must have $link field"),
            (
                json!({"link": {"$link": "!"}}),
                "invalid CID format in $link",
            ),
            (
                json!({"link": {"$link": 1}}),
                "CID link $link must be a string",
            ),
            (
                json!({"loop": {}}),
                "Circular reference detected: com.example.all#loopA",
            ),
            (json!({"noref": {}}), "ref schema missing ref field"),
            (
                json!({"missingDef": {}}),
                "Definition 'nope' not found in lexicon 'com.example.all'",
            ),
            (json!({"list": []}), "array too short (min 1)"),
            (json!({"list": [1, 2, 5]}), "array too long (max 2)"),
            (json!({"list": [6]}), "value above maximum (5)"),
            (json!({"list": [3]}), "value not in enum"),
            (json!({"list": "x"}), "expected array"),
            (json!({"list": ["1"]}), "expected integer"),
            (json!({"short": "a"}), "string too short (min 2)"),
            (json!({"short": "e\u{301}"}), "too few graphemes (min 2)"),
            (json!({"short": 1}), "expected string"),
            (json!({"pick": "b"}), "value not in enum"),
            (json!({"fixed": "y"}), "value must be \"x\""),
            (json!({"raw": {"$bytes": "AQ"}}), "bytes too short (min 2)"),
            (
                json!({"raw": {"$bytes": "AQIDBA"}}),
                "bytes too long (max 3)",
            ),
            (json!({"raw": "x"}), "expected bytes object"),
            (json!({"raw": {}}), "bytes object must have $bytes field"),
            (json!({"raw": {"$bytes": 1}}), "$bytes must be a string"),
            (
                json!({"raw": {"$bytes": "AQI", "x": 1}}),
                "bytes object must have exactly one field",
            ),
            (json!({"pic": 1}), "expected blob object"),
            (
                json!({"pic": blob(json!({"ref": {}}))}),
                "blob must have ref.$link",
            ),
            (
                json!({"pic": blob(json!({"ref": {"$link": "!!!!!!!!"}}))}),
                "invalid CID in blob ref",
            ),
            (
                json!({"pic": blob(json!({"mimeType": ""}))}),
                "blob must have non-empty mimeType",
            ),
            (
                json!({"pic": blob(json!({"size": null}))}),
                "blob must have size",
            ),
            (
                json!({"pic": blob(json!({"size": -1}))}),
                "blob size must be non-negative",
            ),
            (json!({"choice": 1}), "union value must be an object"),
            (
                json!({"choice": {"$type": "branch", "n": 1}}),
                "$type 'branch' not in union refs",
            ),
            (
                json!({"open": {"$type": "branch"}}),
                "required field 'n' is missing",
            ),
            (json!({"untyped": 1}), "unknown type: weird"),
            (json!({"typeless": 1}), "missing schema type"),
            (json!({"maybe": null, "fixed": null}), "null not allowed"),
        ];
        for (record, message) in cases {
            let said = lexicons.validate_record("com.example.all", &record);
            assert_eq!(
                said.err().map(|e| e.message).unwrap_or_default(),
                message,
                "{record}"
            );
        }
        let obj = lexicons
            .validate_record("com.example.obj", &json!({}))
            .unwrap_err();
        assert_eq!(obj.to_string(), "com.example.obj is not a record type");
        let at = lexicons
            .validate_record("com.example.all", &json!({"flag": 0}))
            .unwrap_err();
        assert_eq!(at.to_string(), "flag: expected boolean");
        assert_eq!(
            lexicons.get("com.example.all").unwrap()["id"],
            "com.example.all"
        );
    }
}
