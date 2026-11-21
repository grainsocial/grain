//! Records checked against their lexicons before anything keeps them: the
//! schemas of the collections grain indexes, built in, checked by the
//! `atproto` crate's validator as atproto's reference implementation
//! checks one, and what grain does beside that: a gallery from the network
//! whose strings run long is kept, and cut where it is shown.

use atproto::lexicon::LexiconError;
use serde_json::Value;
use unicode_segmentation::UnicodeSegmentation;

/// The lexicons of every collection grain indexes, and of every
/// definition their records reach.
const BUILT_IN: &[&str] = &[
    include_str!("../../../lexicons/app/bsky/embed/defs.json"),
    include_str!("../../../lexicons/app/bsky/embed/external.json"),
    include_str!("../../../lexicons/app/bsky/embed/gallery.json"),
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

/// The built-in lexicons, as JSON.
fn built_in() -> impl Iterator<Item = Value> {
    BUILT_IN
        .iter()
        .map(|doc| serde_json::from_str(doc).expect("a built-in lexicon is JSON"))
}

/// The lexicons records are checked against.
pub struct Lexicons(atproto::lexicon::Lexicons);

impl Lexicons {
    /// The lexicons grain builds in ([`BUILT_IN`]).
    pub fn grain() -> Lexicons {
        Lexicons(atproto::lexicon::Lexicons::new(built_in()))
    }

    /// Checks `record` against the record schema of `collection`.
    pub fn validate_record(&self, collection: &str, record: &Value) -> Result<(), LexiconError> {
        if let Some(def) = self.0.def(collection)
            && def["type"] != "record"
        {
            return Err(LexiconError {
                path: "record".into(),
                message: format!("{collection} is not a record type"),
            });
        }
        self.0.validate(collection, record)
    }

    /// Checks `record` as an index takes one from the network: as
    /// [`Lexicons::validate_record`] does, but for a gallery whose own
    /// strings run past their `maxLength`, which is kept. Galleries with
    /// titles past it are on the network; a view cuts them with [`cut`].
    /// A write is checked by [`Lexicons::validate_record`].
    pub fn validate_indexed(&self, collection: &str, record: &Value) -> Result<(), LexiconError> {
        if collection != GALLERY {
            return self.validate_record(collection, record);
        }
        let properties = self
            .0
            .def(collection)
            .and_then(|d| d["record"]["properties"].as_object());
        let properties = properties.expect("the built-in gallery lexicon names its properties");
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

/// The TLDs atproto refuses a handle in: `handle.invalid` is what an
/// account whose handle does not resolve back is shown as.
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

/// A handle that may name an account: well formed, and in none of the
/// TLDs atproto refuses.
pub fn valid_handle(value: &str) -> bool {
    let tld = value.rsplit('.').next().unwrap_or_default();
    atproto::syntax::is_handle(value)
        && !DISALLOWED_TLDS.contains(&tld.to_ascii_lowercase().as_str())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    const BLOB: &str = "bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy";
    const NOW: &str = "2026-10-31T12:00:00.000Z";

    fn check(collection: &str, record: Value) -> Result<(), LexiconError> {
        Lexicons::grain().validate_record(collection, &record)
    }

    fn refused(collection: &str, record: Value) -> LexiconError {
        check(collection, record).expect_err("refused")
    }

    /// Every ref and union a built-in record reaches names a def that is
    /// built in, so none is refused for a lexicon grain left out.
    #[test]
    fn every_built_in_ref_resolves() {
        let lexicons = Lexicons::grain();
        fn walk(lexicons: &Lexicons, node: &Value, nsid: &str, seen: &mut Vec<String>) {
            match node {
                Value::Object(o) => {
                    let mut targets: Vec<&str> = Vec::new();
                    if node["type"] == "ref" {
                        targets.extend(node["ref"].as_str());
                    }
                    if node["type"] == "union" {
                        let refs = o["refs"].as_array().unwrap();
                        targets.extend(refs.iter().filter_map(Value::as_str));
                    }
                    for target in targets {
                        let target = match target.strip_prefix('#') {
                            Some(name) => format!("{nsid}#{name}"),
                            None => target.to_string(),
                        };
                        if seen.contains(&target) {
                            continue;
                        }
                        seen.push(target.clone());
                        let def = lexicons.0.def(&target);
                        let def = def.unwrap_or_else(|| panic!("{target} is not built in"));
                        let within = target.split('#').next().unwrap();
                        walk(lexicons, def, within, seen);
                    }
                    for (k, v) in o {
                        if k != "refs" {
                            walk(lexicons, v, nsid, seen);
                        }
                    }
                }
                Value::Array(a) => a.iter().for_each(|v| walk(lexicons, v, nsid, seen)),
                _ => {}
            }
        }
        let mut collections = 0;
        for doc in built_in() {
            let main = &doc["defs"]["main"];
            if main["type"] == "record" {
                let nsid = doc["id"].as_str().unwrap();
                walk(&lexicons, &main["record"], nsid, &mut Vec::new());
                collections += 1;
            }
        }
        assert!(collections > 10, "{collections}");
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
        // Its bound falling inside a character, it is fitted short of that
        // character, not split through it.
        let split = json!({"title": format!("a{long}"), "createdAt": NOW});
        indexed("social.grain.gallery", split).unwrap();
        let titled = json!({"title": long, "createdAt": NOW});
        assert_eq!(
            refused("social.grain.gallery", titled).to_string(),
            "record.title must not be longer than 100 bytes"
        );
        // Only a gallery's length runs past its bound.
        let wrong = json!({"title": long, "createdAt": "yesterday"});
        let e = indexed("social.grain.gallery", wrong).unwrap_err();
        assert_eq!(e.to_string(), "record.createdAt must be a valid datetime");
        let untitled = json!({"title": 7, "createdAt": NOW});
        let e = indexed("social.grain.gallery", untitled).unwrap_err();
        assert_eq!(e.to_string(), "record.title must be a string");
        let place = json!({"title": "t", "createdAt": NOW,
            "address": {"country": "x".repeat(11)}});
        let e = indexed("social.grain.gallery", place).unwrap_err();
        assert_eq!(e.path, "record.address.country");
        let profile = json!({"displayName": "n".repeat(641)});
        let e = indexed("social.grain.actor.profile", profile).unwrap_err();
        assert_eq!(e.message, "must not be longer than 640 bytes");
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
    fn only_a_built_in_collection_is_a_record() {
        let nope = refused("social.grain.nope", json!({}));
        assert_eq!(nope.message, "no lexicon social.grain.nope");
        let defs = refused("social.grain.defs", json!({}));
        assert_eq!(defs.message, "no lexicon social.grain.defs");
        let object = refused("app.bsky.embed.external", json!({}));
        assert_eq!(
            object.message,
            "app.bsky.embed.external is not a record type"
        );
        let missing = refused("social.grain.gallery", json!({"createdAt": NOW}));
        assert_eq!(missing.message, "must have the property \"title\"");
    }

    #[test]
    fn handles_in_a_refused_tld_name_no_one() {
        assert!(valid_handle("alice.grain.social") && valid_handle("alice.test"));
        for bad in [
            "alice",
            "handle.invalid",
            "alice.test.LOCAL",
            "-a.com",
            "a_b.com",
        ] {
            assert!(!valid_handle(bad), "{bad}");
        }
    }
}
