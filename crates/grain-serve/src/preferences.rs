//! An account's grain preferences: `social.grain.actor.getPreferences`
//! and `putPreferences`, the whole set at once, as Bluesky's
//! `app.bsky.actor.getPreferences` and `putPreferences` take them, each of
//! `social.grain.actor.defs#preferences`' kinds at most once.
//!
//! The index keeps them as [`crate::index::preferences`] does: the pinned
//! feeds, the photo metadata an upload keeps and the theme are values of
//! `preference` by key (`pinnedFeeds`, `includeExif`, `includeLocation`,
//! `theme`); how each kind of notification reaches the account is
//! `notification_pref`, which listing notifications reads, one row for
//! each kind set and none for a kind left at its default.

use crate::App;
use crate::index::preferences::{NotificationPref, Preferences};
use crate::xrpc::Failure;
use axum::Json;
use axum::body::Bytes;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::sync::Arc;

pub const GET: &str = "social.grain.actor.getPreferences";
pub const PUT: &str = "social.grain.actor.putPreferences";

/// The `preference` keys these methods set, every one of them.
const KEYS: &[&str] = &["pinnedFeeds", "includeExif", "includeLocation", "theme"];

/// The kinds of notification a `notificationsPref` names.
const KINDS: &[&str] = &["favorites", "follows", "comments", "mentions"];

#[derive(Deserialize, Serialize, Debug, Clone, PartialEq)]
#[serde(tag = "$type")]
enum Pref {
    #[serde(rename = "social.grain.actor.defs#pinnedFeedsPref")]
    PinnedFeeds { items: Vec<PinnedFeed> },
    #[serde(
        rename = "social.grain.actor.defs#photoMetadataPref",
        rename_all = "camelCase"
    )]
    PhotoMetadata {
        #[serde(skip_serializing_if = "Option::is_none")]
        include_exif: Option<bool>,
        #[serde(skip_serializing_if = "Option::is_none")]
        include_location: Option<bool>,
    },
    #[serde(rename = "social.grain.actor.defs#themePref")]
    Theme { theme: String },
    #[serde(rename = "social.grain.actor.defs#notificationsPref")]
    Notifications(std::collections::BTreeMap<String, Reach>),
}

#[derive(Deserialize, Serialize, Debug, Clone, PartialEq)]
struct PinnedFeed {
    id: String,
    label: String,
    #[serde(rename = "type")]
    kind: String,
    path: String,
}

/// How a kind of notification reaches the account.
#[derive(Deserialize, Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
struct Reach {
    push: bool,
    in_app: bool,
    from: String,
}

impl Pref {
    fn name(&self) -> &'static str {
        match self {
            Pref::PinnedFeeds { .. } => "pinnedFeedsPref",
            Pref::PhotoMetadata { .. } => "photoMetadataPref",
            Pref::Theme { .. } => "themePref",
            Pref::Notifications(_) => "notificationsPref",
        }
    }
}

/// `prefs` as the index keeps them, or why they are not preferences.
fn kept(prefs: Vec<Pref>) -> Result<Preferences, Failure> {
    let mut to = Preferences::default();
    let mut seen = Vec::new();
    for pref in prefs {
        if seen.contains(&pref.name()) {
            let why = format!("{} is set twice", pref.name());
            return Err(Failure::invalid(why));
        }
        seen.push(pref.name());
        match pref {
            Pref::PinnedFeeds { items } => to.values.push(("pinnedFeeds".into(), json(&items))),
            Pref::PhotoMetadata {
                include_exif,
                include_location,
            } => {
                let set = [
                    ("includeExif", include_exif),
                    ("includeLocation", include_location),
                ];
                for (key, value) in set {
                    if let Some(value) = value {
                        to.values.push((key.into(), json(&value)));
                    }
                }
            }
            Pref::Theme { theme } => to.values.push(("theme".into(), json(&theme))),
            Pref::Notifications(kinds) => {
                for (kind, reach) in kinds {
                    if !KINDS.contains(&kind.as_str()) {
                        let why = format!("{kind} is not a kind of notification");
                        return Err(Failure::invalid(why));
                    }
                    if !["all", "follows"].contains(&reach.from.as_str()) {
                        let why = format!("{kind} is from all or follows, not {}", reach.from);
                        return Err(Failure::invalid(why));
                    }
                    to.notifications.push(NotificationPref {
                        kind,
                        push: reach.push,
                        in_app: reach.in_app,
                        from_follows: reach.from == "follows",
                    });
                }
            }
        }
    }
    Ok(to)
}

/// What the index keeps, as preferences: a kind with nothing kept is
/// left out, as is a value that no longer reads as what its key holds.
fn read(kept: Preferences) -> Vec<Pref> {
    let value = |key: &str| {
        let found = kept.values.iter().find(|(k, _)| k == key);
        found.and_then(|(_, v)| serde_json::from_str::<Value>(v).ok())
    };
    let mut prefs = Vec::new();
    if let Some(items) = value("pinnedFeeds").and_then(|v| serde_json::from_value(v).ok()) {
        prefs.push(Pref::PinnedFeeds { items });
    }
    let include_exif = value("includeExif").and_then(|v| v.as_bool());
    let include_location = value("includeLocation").and_then(|v| v.as_bool());
    if include_exif.is_some() || include_location.is_some() {
        prefs.push(Pref::PhotoMetadata {
            include_exif,
            include_location,
        });
    }
    if let Some(Value::String(theme)) = value("theme") {
        prefs.push(Pref::Theme { theme });
    }
    if !kept.notifications.is_empty() {
        let kinds = kept.notifications.into_iter().map(|n| {
            let from = if n.from_follows { "follows" } else { "all" };
            let reach = Reach {
                push: n.push,
                in_app: n.in_app,
                from: from.into(),
            };
            (n.kind, reach)
        });
        prefs.push(Pref::Notifications(kinds.collect()));
    }
    prefs
}

/// `value` as JSON text.
fn json(value: &impl Serialize) -> String {
    serde_json::to_string(value).expect("a preference serializes")
}

fn index(app: &App) -> Result<&crate::index::Index, Failure> {
    let why = "this server keeps no index";
    let none = || Failure::new(StatusCode::NOT_IMPLEMENTED, "MethodNotImplemented", why);
    app.index.as_deref().ok_or_else(none)
}

/// `social.grain.actor.getPreferences`: the caller's, which only an
/// account may ask for.
pub async fn get_preferences(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
) -> Result<Json<Value>, Failure> {
    let index = index(&app)?;
    let did = crate::viewer::viewer(&app, &headers, GET).await?;
    let did = did.ok_or_else(Failure::authentication_required)?;
    crate::viewer::unshared();
    let prefs = read(index.preferences(&did, KEYS)?);
    Ok(Json(json!({ "preferences": prefs })))
}

#[derive(Deserialize)]
struct Input {
    preferences: Vec<Pref>,
}

/// `social.grain.actor.putPreferences`: the caller's set to the input,
/// every kind it leaves out unset.
pub async fn put_preferences(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Value>, Failure> {
    let index = index(&app)?;
    let did = crate::viewer::writer(&app, &headers, PUT).await?;
    let input: Input = serde_json::from_slice(&body)
        .map_err(|e| Failure::invalid(format!("the input is not {{preferences}}: {e}")))?;
    let to = kept(input.preferences)?;
    index.put_preferences(&did, KEYS, &to, &grain::keys::now_iso())?;
    Ok(Json(json!({})))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn prefs(value: Value) -> Vec<Pref> {
        serde_json::from_value(value).unwrap()
    }

    #[test]
    fn preferences_keep_and_read_back_as_they_were() {
        let set = prefs(json!([
            {
                "$type": "social.grain.actor.defs#pinnedFeedsPref",
                "items": [{ "id": "recent", "label": "Recent", "type": "feed", "path": "/" }],
            },
            { "$type": "social.grain.actor.defs#photoMetadataPref", "includeExif": false },
            { "$type": "social.grain.actor.defs#themePref", "theme": "dark" },
            {
                "$type": "social.grain.actor.defs#notificationsPref",
                "follows": { "push": false, "inApp": true, "from": "follows" },
                "comments": { "push": true, "inApp": false, "from": "all" },
            },
        ]));
        let to = kept(set.clone()).unwrap();
        assert_eq!(
            to.values
                .iter()
                .map(|(k, _)| k.as_str())
                .collect::<Vec<_>>(),
            ["pinnedFeeds", "includeExif", "theme"]
        );
        let follows = to
            .notifications
            .iter()
            .find(|n| n.kind == "follows")
            .unwrap();
        assert!(!follows.push && follows.in_app && follows.from_follows);
        assert_eq!(read(to), set);
        assert!(read(Preferences::default()).is_empty());
    }

    #[test]
    fn what_is_not_a_preference_is_refused_or_read_as_none() {
        let twice = prefs(json!([
            { "$type": "social.grain.actor.defs#themePref", "theme": "dark" },
            { "$type": "social.grain.actor.defs#themePref", "theme": "light" },
        ]));
        assert_eq!(kept(twice).unwrap_err().error, "InvalidRequest");
        let odd = prefs(json!([{
            "$type": "social.grain.actor.defs#notificationsPref",
            "likes": { "push": true, "inApp": true, "from": "all" },
        }]));
        assert_eq!(kept(odd).unwrap_err().error, "InvalidRequest");
        let typo = prefs(json!([{
            "$type": "social.grain.actor.defs#notificationsPref",
            "follows": { "push": true, "inApp": true, "from": "follow" },
        }]));
        assert_eq!(kept(typo).unwrap_err().error, "InvalidRequest");
        assert!(serde_json::from_value::<Vec<Pref>>(json!([{ "$type": "other" }])).is_err());
        // Values kept another way read as nothing.
        let stale = Preferences {
            values: vec![
                ("pinnedFeeds".into(), "{}".into()),
                ("includeExif".into(), "not json".into()),
                ("theme".into(), "1".into()),
            ],
            notifications: Vec::new(),
        };
        assert!(read(stale).is_empty());
    }
}
