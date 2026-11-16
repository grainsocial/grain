//! A typed row for each collection the index keeps: its fields as the
//! record names them, its columns as the table does, and the table.
//!
//! A row holds what grain's queries and views read. Strings, integers and
//! datetimes are columns of their own; anything with structure (a blob, a
//! facet list, a location) is one JSON column, so a view is built from the
//! row and nothing else.

use rusqlite::ToSql;
use rusqlite::types::{FromSql, FromSqlError, FromSqlResult, ToSqlOutput, ValueRef};
use serde::Deserialize;
use serde_json::Value;

/// A JSON value kept as its text.
#[derive(Debug, Clone, Default, PartialEq, Deserialize)]
#[serde(transparent)]
pub struct Json(pub Value);

impl ToSql for Json {
    fn to_sql(&self) -> rusqlite::Result<ToSqlOutput<'_>> {
        Ok(ToSqlOutput::from(self.0.to_string()))
    }
}

impl FromSql for Json {
    fn column_result(value: ValueRef<'_>) -> FromSqlResult<Self> {
        let text = value.as_str()?;
        serde_json::from_str(text)
            .map(Json)
            .map_err(|e| FromSqlError::Other(Box::new(e)))
    }
}

/// A collection's row.
pub trait Record: Sized {
    /// The collection, `social.grain.gallery`.
    const NSID: &'static str;
    /// Its table, `gallery`.
    const TABLE: &'static str;
    /// Its columns past the envelope (`uri`, `cid`, `did`, `indexed_at`),
    /// each a field of the row by the same name.
    const COLUMNS: &'static [&'static str];
    /// The row's values, in the order of [`Record::COLUMNS`].
    fn params(&self) -> Vec<&dyn ToSql>;
    /// The row from a result row that names its columns.
    fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self>;
}

macro_rules! records {
    ($(
        $(#[$doc:meta])*
        $name:ident: $nsid:tt => $table:tt {
            $( $field:ident: $ty:ty = $json:tt, )*
        }
    )*) => {
        $(
            $(#[$doc])*
            #[derive(Debug, Clone, Default, PartialEq, Deserialize)]
            #[serde(default)]
            pub struct $name {
                $( #[serde(rename = $json)] pub $field: $ty, )*
            }

            impl Record for $name {
                const NSID: &'static str = $nsid;
                const TABLE: &'static str = $table;
                const COLUMNS: &'static [&'static str] = &[$(stringify!($field)),*];
                fn params(&self) -> Vec<&dyn ToSql> {
                    vec![$(&self.$field),*]
                }
                fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
                    Ok($name { $( $field: row.get(stringify!($field))?, )* })
                }
            }
        )*

        /// A row of any collection the index keeps.
        #[derive(Debug, Clone, PartialEq)]
        pub enum Any {
            $( $name($name), )*
        }

        impl Any {
            /// `value` as the row of `collection`, or `None` when the index
            /// keeps no such collection.
            pub fn parse(collection: &str, value: &Value) -> Option<serde_json::Result<Any>> {
                match collection {
                    $( $nsid => Some($name::deserialize(value).map(Any::$name)), )*
                    _ => None,
                }
            }

            pub fn table(&self) -> &'static str {
                match self { $( Any::$name(_) => $name::TABLE, )* }
            }

            pub fn columns(&self) -> &'static [&'static str] {
                match self { $( Any::$name(_) => $name::COLUMNS, )* }
            }

            pub fn params(&self) -> Vec<&dyn ToSql> {
                match self { $( Any::$name(r) => r.params(), )* }
            }
        }

        /// The collections the index keeps, and each one's table.
        pub const COLLECTIONS: &[(&str, &str)] = &[ $( ($nsid, $table), )* ];

        /// Each table's columns past the envelope.
        pub const COLUMNS: &[(&str, &[&str])] = &[ $( ($table, $name::COLUMNS), )* ];

        /// Each table's columns past the envelope, as the fields they hold.
        pub const FIELDS: &[(&str, &[Field])] = &[ $( ($table, &[ $( Field {
            column: stringify!($field),
            name: $json,
            json: holds_json(stringify!($ty)),
        }, )* ]), )* ];
    };
}

records! {
    /// A gallery: a titled set of photos, by way of its items.
    Gallery: "social.grain.gallery" => "gallery" {
        title: String = "title",
        description: Option<String> = "description",
        facets: Option<Json> = "facets",
        labels: Option<Json> = "labels",
        location: Option<Json> = "location",
        address: Option<Json> = "address",
        updated_at: Option<String> = "updatedAt",
        created_at: String = "createdAt",
    }

    /// A photo's place in a gallery.
    GalleryItem: "social.grain.gallery.item" => "gallery_item" {
        gallery: String = "gallery",
        item: String = "item",
        position: i64 = "position",
        created_at: String = "createdAt",
    }

    Photo: "social.grain.photo" => "photo" {
        photo: Json = "photo",
        alt: Option<String> = "alt",
        aspect_ratio: Json = "aspectRatio",
        created_at: String = "createdAt",
    }

    /// A photo's EXIF, its decimals scaled by a million.
    PhotoExif: "social.grain.photo.exif" => "photo_exif" {
        photo: String = "photo",
        created_at: String = "createdAt",
        date_time_original: Option<String> = "dateTimeOriginal",
        exposure_time: Option<i64> = "exposureTime",
        f_number: Option<i64> = "fNumber",
        flash: Option<String> = "flash",
        focal_length_in35mm_format: Option<i64> = "focalLengthIn35mmFormat",
        iso: Option<i64> = "iSO",
        lens_make: Option<String> = "lensMake",
        lens_model: Option<String> = "lensModel",
        make: Option<String> = "make",
        model: Option<String> = "model",
    }

    /// An account's grain profile.
    Profile: "social.grain.actor.profile" => "profile" {
        display_name: Option<String> = "displayName",
        description: Option<String> = "description",
        avatar: Option<Json> = "avatar",
        created_at: Option<String> = "createdAt",
    }

    Follow: "social.grain.graph.follow" => "follow" {
        subject: String = "subject",
        created_at: String = "createdAt",
    }

    Block: "social.grain.graph.block" => "block" {
        subject: String = "subject",
        created_at: String = "createdAt",
    }

    Favorite: "social.grain.favorite" => "favorite" {
        subject: String = "subject",
        created_at: String = "createdAt",
    }

    Comment: "social.grain.comment" => "comment" {
        text: String = "text",
        facets: Option<Json> = "facets",
        subject: String = "subject",
        focus: Option<String> = "focus",
        reply_to: Option<String> = "replyTo",
        created_at: String = "createdAt",
    }

    Story: "social.grain.story" => "story" {
        media: Json = "media",
        aspect_ratio: Json = "aspectRatio",
        location: Option<Json> = "location",
        address: Option<Json> = "address",
        labels: Option<Json> = "labels",
        created_at: String = "createdAt",
    }

    /// A gallery in a group's pool, in the group's repo.
    GroupItem: "social.grain.group.item" => "group_item" {
        gallery: String = "gallery",
        submission: Option<String> = "submission",
        created_at: String = "createdAt",
    }

    /// A member offering a gallery to a group, in the member's repo.
    GroupSubmission: "social.grain.group.submission" => "group_submission" {
        group_did: String = "group",
        gallery: String = "gallery",
        created_at: String = "createdAt",
    }

    /// A group turning a submission down, in the group's repo.
    GroupDecline: "social.grain.group.decline" => "group_decline" {
        submission: String = "submission",
        gallery: String = "gallery",
        created_at: String = "createdAt",
    }

    /// That an account is a group.
    GroupDeclaration: "fyi.opensocial.declaration" => "group_declaration" {
        meta: String = "meta",
        created_at: String = "createdAt",
    }

    /// A Bluesky post, kept of accounts grain tracks: a gallery's
    /// cross-post is found among them.
    BskyPost: "app.bsky.feed.post" => "bsky_post" {
        text: String = "text",
        embed: Option<Json> = "embed",
        created_at: String = "createdAt",
    }

    /// A Bluesky follow, kept of accounts grain tracks, for suggesting whom
    /// to follow here.
    BskyFollow: "app.bsky.graph.follow" => "bsky_follow" {
        subject: String = "subject",
        created_at: String = "createdAt",
    }

    /// That an account takes messages on Germ, and from whom.
    GermDeclaration: "com.germnetwork.declaration" => "germ_declaration" {
        version: String = "version",
        current_key: Json = "currentKey",
        message_me: Option<Json> = "messageMe",
        key_package: Option<Json> = "keyPackage",
        continuity_proofs: Option<Json> = "continuityProofs",
    }
}

/// A column of a record's table, and the field of the record it holds.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Field {
    pub column: &'static str,
    /// The field's name in the record.
    pub name: &'static str,
    /// Whether the column holds the field as JSON text ([`Json`]).
    pub json: bool,
}

/// Whether a field of the type written `ty` is kept as [`Json`].
const fn holds_json(ty: &str) -> bool {
    let (ty, word) = (ty.as_bytes(), b"Json");
    let mut at = 0;
    while at + word.len() <= ty.len() {
        let mut same = 0;
        while same < word.len() && ty[at + same] == word[same] {
            same += 1;
        }
        if same == word.len() {
            return true;
        }
        at += 1;
    }
    false
}

/// The record of `collection` a result row holds, as the index keeps it:
/// its fields from the columns of its table ([`FIELDS`]), each the row
/// names, and its `$type`. A field the record does not have is left out.
pub fn value(collection: &str, row: &rusqlite::Row) -> rusqlite::Result<Value> {
    let mut record = serde_json::Map::new();
    record.insert("$type".into(), collection.into());
    let fields = table_of(collection).and_then(|t| FIELDS.iter().find(|(table, _)| *table == t));
    for field in fields.map(|(_, fields)| *fields).unwrap_or_default() {
        // Every column is text or an integer: a field kept as JSON is
        // read as JSON, as it was checked against its lexicon going in.
        let value = match row.get_ref(field.column)? {
            ValueRef::Null => continue,
            ValueRef::Integer(n) => Value::from(n),
            text => {
                let text = String::from_utf8_lossy(text.as_bytes().unwrap_or_default());
                let parsed = field.json.then(|| serde_json::from_str(&text).ok());
                parsed.flatten().unwrap_or(Value::String(text.into_owned()))
            }
        };
        record.insert(field.name.into(), value);
    }
    Ok(Value::Object(record))
}

/// The table of `collection`, if the index keeps it.
pub fn table_of(collection: &str) -> Option<&'static str> {
    COLLECTIONS
        .iter()
        .find(|(nsid, _)| *nsid == collection)
        .map(|(_, table)| *table)
}

/// The self-label values a record carries, `labels.values[].val`.
pub fn self_labels(record: &Value) -> Vec<&str> {
    if record["labels"]["$type"] != "com.atproto.label.defs#selfLabels" {
        return Vec::new();
    }
    record["labels"]["values"]
        .as_array()
        .map(|values| values.iter().filter_map(|v| v["val"].as_str()).collect())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_field_is_kept_as_json_when_its_type_names_it() {
        // The same function [`FIELDS`] is made with, run where a test sees it.
        let kept = std::hint::black_box(holds_json);
        assert!(kept("Json"));
        assert!(kept("Option<Json>"));
        assert!(!kept("String"));
        assert!(!kept("Jso"));
        assert!(!kept(""));
        let gallery = FIELDS.iter().find(|(t, _)| *t == "gallery").unwrap().1;
        let facets = gallery.iter().find(|f| f.name == "facets").unwrap();
        assert!(facets.json);
    }
}
