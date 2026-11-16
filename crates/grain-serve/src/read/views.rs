//! Records as their views: accounts (`profileView`), galleries with their
//! photos, EXIF and counts (`galleryView`), photos (`photoView`) and
//! stories (`storyView`), each hydrated for many at once.
//!
//! An account the index has no valid handle for, such as one it holds as
//! its DID, is `handle.invalid` in a view, as Bluesky's are, since a DID
//! is no handle. An account's labels are those on its bare DID and on its
//! profile record together. A view that sits in a union carries its
//! `$type`, as the lexicon asks of a union's members.

use super::moderation::{not_orphaned, shown, unblocked};
use super::{Reader, list, place};
use crate::cdn::{AVATAR, FULLSIZE, THUMBNAIL};
use crate::index::Row;
use crate::index::records::{Gallery, GalleryItem, Json, Photo, PhotoExif, Profile, Story};
use grain::lexicon;
use rusqlite::params;
use serde_json::{Map, Value, json};
use std::collections::HashMap;

/// How many of the viewer's follows a gallery's facepile shows.
const FACEPILE: i64 = 3;

/// The most graphemes of a gallery's title a view shows, and of its
/// description: their lexicon's bounds. A gallery's record keeps the whole
/// of a longer one, which the index takes from the network.
pub const TITLE: usize = 100;
pub const DESCRIPTION: usize = 1000;

/// A gallery's title, as a view shows it.
pub fn gallery_title(gallery: &Gallery) -> String {
    lexicon::cut(&gallery.title, TITLE).to_string()
}

/// How long a story stands.
pub const STORY_MICROS: u64 = 24 * 60 * 60 * 1_000_000;

/// An account, as views name it.
#[derive(Debug, Clone)]
pub struct Actor {
    pub did: String,
    /// Its handle, or `handle.invalid` where the index has none that is one.
    pub handle: String,
    pub profile: Option<Row<Profile>>,
}

/// `value` under `key` in `view`, where there is one.
pub fn put(view: &mut Value, key: &str, value: Option<impl Into<Value>>) {
    if let Some(value) = value {
        view[key] = value.into();
    }
}

/// The `$type` a view of `def` carries in a union.
fn typed(def: &str, mut view: Value) -> Value {
    view["$type"] = def.into();
    view
}

/// The time `micros` before now, as records write times.
pub fn ago(micros: u64) -> String {
    grain::keys::iso(grain::keys::now_micros().saturating_sub(micros))
}

/// The handle of each of `?1`.
const HANDLES_SQL: &str =
    "SELECT did, handle FROM repo WHERE did IN (SELECT value FROM json_each(?1))";

/// The profile record of each of `?1`.
const PROFILES_SQL: &str =
    "SELECT * FROM profile p WHERE p.did IN (SELECT value FROM json_each(?1)) ORDER BY p.uri";

/// The labels standing on each of `?1` at `?2`.
const LABELS_SQL: &str = "SELECT l.src, l.uri, l.val, l.cts, l.exp FROM label l
             WHERE l.uri IN (SELECT value FROM json_each(?1)) AND l.neg = 0
               AND (l.exp IS NULL OR l.exp > ?2)
               AND NOT EXISTS (SELECT 1 FROM label n WHERE n.uri = l.uri AND n.val = l.val
                 AND (n.cts > l.cts OR (n.cts = l.cts AND n.id > l.id)))
             ORDER BY l.id";

/// The self-labels on each of `?1`.
const SELF_LABELS_SQL: &str = "SELECT uri, val FROM self_label WHERE uri IN (SELECT value FROM json_each(?1)) ORDER BY uri, val";

/// The viewer `?1`'s favorite of each of `?2`.
const VIEWER_FAVORITES_SQL: &str = "SELECT subject, uri FROM favorite
                   WHERE did = ?1 AND subject IN (SELECT value FROM json_each(?2)) ORDER BY uri";

/// A post of `?1`'s that links to its record `?2`.
const CROSS_POST_SQL: &str = "SELECT p.uri FROM bsky_post p WHERE p.did = ?1 AND p.text LIKE '%/profile/%' || ?2 || '%' LIMIT 1";

/// The pool each of `?1` is in.
const POOLS_SQL: &str = "SELECT i.gallery, i.did, i.uri FROM group_item i
             WHERE i.gallery IN (SELECT value FROM json_each(?1)) ORDER BY i.created_at, i.uri";

/// How many favorited each of `?1`.
const FAV_COUNTS_SQL: &str = "SELECT subject, count(DISTINCT did) FROM favorite
                 WHERE subject IN (SELECT value FROM json_each(?1)) GROUP BY subject";

/// The items of each gallery of `?1`, in order.
const ITEMS_SQL: &str =
    "SELECT * FROM gallery_item i WHERE i.gallery IN (SELECT value FROM json_each(?1))
             ORDER BY i.position, i.uri";

/// The EXIF of each photo of `?1`.
const EXIFS_SQL: &str =
    "SELECT * FROM photo_exif e WHERE e.photo IN (SELECT value FROM json_each(?1)) ORDER BY e.uri";

/// Which of `?2` the viewer `?1` watched.
const VIEWED_SQL: &str = "SELECT subject FROM story_view WHERE did = ?1 AND subject IN (SELECT value FROM json_each(?2))";

impl Reader<'_> {
    /// The accounts `dids` name, each one, known or not.
    pub fn actors(&self, wanted: &[&str]) -> rusqlite::Result<HashMap<String, Actor>> {
        let dids = list(wanted);
        let handles: Vec<(String, Option<String>)> = self.all(HANDLES_SQL, [&dids])?;
        let handles: HashMap<String, Option<String>> = handles.into_iter().collect();
        let profiles = self.rows::<Profile>(PROFILES_SQL, [&dids])?;
        let mut profiles: HashMap<String, Row<Profile>> =
            profiles.into_iter().map(|p| (p.did.clone(), p)).collect();
        Ok(wanted
            .iter()
            .map(|did| {
                let did = did.to_string();
                let handle = handles.get(&did).cloned().flatten();
                let handle = handle.filter(|h| lexicon::valid_handle(h));
                let actor = Actor {
                    handle: handle.unwrap_or_else(|| "handle.invalid".into()),
                    profile: profiles.remove(&did),
                    did: did.clone(),
                };
                (did, actor)
            })
            .collect())
    }

    /// The labels standing on each of `uris`: grain's own, latest first
    /// where one was given again, less those negated since or expired.
    pub fn labels(&self, uris: &[&str]) -> rusqlite::Result<HashMap<String, Vec<Value>>> {
        let rows: Vec<(String, String, String, String, Option<String>)> =
            self.all(LABELS_SQL, params![list(uris), grain::keys::now_iso()])?;
        let mut labels: HashMap<String, Vec<Value>> = HashMap::new();
        for (src, uri, val, cts, exp) in rows {
            let mut label = json!({"src": src, "uri": uri, "val": val, "neg": false, "cts": cts});
            put(&mut label, "exp", exp);
            labels.entry(uri).or_default().push(label);
        }
        Ok(labels)
    }

    /// [`Reader::labels`] on records, with the self-labels their authors
    /// gave them after: of `(uri, did, indexed_at)`, each one's author
    /// its `src`, and when the index first held it its `cts`.
    fn record_labels(
        &self,
        records: &[(&str, &str, &str)],
    ) -> rusqlite::Result<HashMap<String, Vec<Value>>> {
        let uris: Vec<&str> = records.iter().map(|r| r.0).collect();
        let mut labels = self.labels(&uris)?;
        let own: Vec<(String, String)> = self.all(SELF_LABELS_SQL, [list(&uris)])?;
        for (uri, val) in own {
            let (_, did, at) = records
                .iter()
                .find(|r| r.0 == uri)
                .copied()
                .unwrap_or_default();
            let label = json!({"src": did, "uri": uri, "val": val, "cts": at});
            labels.entry(uri).or_default().push(label);
        }
        Ok(labels)
    }

    /// Each of `dids` as a `profileView`.
    pub fn profiles(&self, dids: &[&str]) -> rusqlite::Result<HashMap<String, Value>> {
        let actors = self.actors(dids)?;
        let profile_uris: Vec<&str> = actors
            .values()
            .filter_map(|a| a.profile.as_ref())
            .map(|p| p.uri.as_str())
            .collect();
        let mut subjects = dids.to_vec();
        subjects.extend(profile_uris);
        let labels = self.labels(&subjects)?;
        Ok(actors
            .into_iter()
            .map(|(did, actor)| {
                let view = self.profile_view(&actor, &labels);
                (did, view)
            })
            .collect())
    }

    /// `actor` as a `profileView`, with what of `labels` stands on it.
    pub fn profile_view(&self, actor: &Actor, labels: &HashMap<String, Vec<Value>>) -> Value {
        let mut view = json!({"did": actor.did, "handle": actor.handle});
        let mut on: Vec<Value> = labels.get(&actor.did).cloned().unwrap_or_default();
        if let Some(p) = &actor.profile {
            view["cid"] = p.cid.as_str().into();
            put(&mut view, "displayName", p.record.display_name.clone());
            let avatar = p
                .record
                .avatar
                .as_ref()
                .and_then(|a| self.cdn.url(&p.did, &a.0, AVATAR));
            put(&mut view, "avatar", avatar);
            on.extend(labels.get(&p.uri).cloned().unwrap_or_default());
        }
        put(&mut view, "labels", (!on.is_empty()).then_some(on));
        view
    }

    /// `photo` as a `photoView`, in the union a gallery's items and a
    /// comment's focus are.
    pub fn photo_view(&self, photo: &Row<Photo>) -> Value {
        let blob = &photo.record.photo.0;
        let mut view = json!({
            "uri": photo.uri,
            "cid": photo.cid,
            "thumb": self.cdn.url(&photo.did, blob, THUMBNAIL),
            "fullsize": self.cdn.url(&photo.did, blob, FULLSIZE),
            "aspectRatio": photo.record.aspect_ratio.0,
        });
        put(&mut view, "alt", photo.record.alt.clone());
        typed("social.grain.photo.defs#photoView", view)
    }

    /// The photos `uris` name, of accounts shown, by URI.
    pub fn photos(&self, uris: &[&str]) -> rusqlite::Result<HashMap<String, Row<Photo>>> {
        let sql = photos_sql();
        let photos = self.rows::<Photo>(&sql, [list(uris)])?;
        Ok(photos.into_iter().map(|p| (p.uri.clone(), p)).collect())
    }

    /// How many comments each of `subjects` has: of accounts shown, and
    /// not answering one since deleted.
    pub fn comment_counts(&self, subjects: &[&str]) -> rusqlite::Result<HashMap<String, i64>> {
        let sql = comment_counts_sql();
        Ok(self
            .all::<(String, i64)>(&sql, [list(subjects)])?
            .into_iter()
            .collect())
    }

    /// The viewer's favorite of each of `subjects` they favorited.
    pub fn viewer_favorites(&self, subjects: &[&str]) -> rusqlite::Result<HashMap<String, String>> {
        let sql = VIEWER_FAVORITES_SQL;
        Ok(self
            .all::<(String, String)>(sql, params![self.viewer, list(subjects)])?
            .into_iter()
            .collect())
    }

    /// The Bluesky post each record of `records`, `(uri, did)`, was
    /// cross-posted in, as its URL: one of its author's posts that links
    /// to it, by its `/<kind>/<rkey>`, under the author's handle or DID.
    fn cross_posts(
        &self,
        records: &[(&str, &str)],
        kind: &str,
    ) -> rusqlite::Result<HashMap<String, String>> {
        let mut posts = HashMap::new();
        for &(uri, did) in records {
            let tail = format!("/{kind}/{}", uri.rsplit('/').next().unwrap_or_default());
            let found: Vec<(String,)> = self.all(CROSS_POST_SQL, [did, tail.as_str()])?;
            for (post,) in found {
                let rkey = post.rsplit('/').next().unwrap_or_default();
                posts.insert(
                    uri.to_string(),
                    format!("https://bsky.app/profile/{did}/post/{rkey}"),
                );
            }
        }
        Ok(posts)
    }

    /// The galleries `uris` name, of accounts shown, in that order.
    pub fn galleries_at(&self, uris: &[&str]) -> rusqlite::Result<Vec<Value>> {
        let sql = galleries_at_sql();
        let mut rows: HashMap<String, Row<Gallery>> = self
            .rows::<Gallery>(&sql, [list(uris)])?
            .into_iter()
            .map(|g| (g.uri.clone(), g))
            .collect();
        let ordered = uris.iter().filter_map(|u| rows.remove(*u)).collect();
        self.galleries(ordered)
    }

    /// Each of `rows` as a `galleryView`.
    pub fn galleries(&self, rows: Vec<Row<Gallery>>) -> rusqlite::Result<Vec<Value>> {
        let uris: Vec<&str> = rows.iter().map(|g| g.uri.as_str()).collect();
        let uri_list = list(&uris);
        let favorites = self.viewer_favorites(&uris)?;
        // The viewer's follows who favorited each, most recent first: one
        // row an account, however many favorites or follows it holds.
        let pile_sql = facepile_sql();
        let facepiles: Vec<(String, String)> =
            self.all(&pile_sql, params![self.viewer, uri_list, FACEPILE])?;
        // The pool each is in: the latest, where it is in more than one.
        let pooled: Vec<(String, String, String)> = self.all(POOLS_SQL, [&uri_list])?;
        let groups: HashMap<&str, (&str, &str)> = pooled
            .iter()
            .map(|(g, did, item)| (g.as_str(), (did.as_str(), item.as_str())))
            .collect();
        let mut dids: Vec<&str> = rows.iter().map(|g| g.did.as_str()).collect();
        dids.extend(facepiles.iter().map(|(_, did)| did.as_str()));
        dids.extend(groups.values().map(|(did, _)| *did));
        dids.sort_unstable();
        dids.dedup();
        let actors = self.actors(&dids)?;
        let creators = self.profiles(&dids)?;
        let fav_counts: HashMap<String, i64> = self
            .all::<(String, i64)>(FAV_COUNTS_SQL, [&uri_list])?
            .into_iter()
            .collect();
        let comment_counts = self.comment_counts(&uris)?;
        let records: Vec<(&str, &str, &str)> = rows
            .iter()
            .map(|g| (g.uri.as_str(), g.did.as_str(), g.indexed_at.as_str()))
            .collect();
        let labels = self.record_labels(&records)?;
        let items = self.rows::<GalleryItem>(ITEMS_SQL, [&uri_list])?;
        let photo_uris: Vec<&str> = items.iter().map(|i| i.record.item.as_str()).collect();
        let photos = self.photos(&photo_uris)?;
        let exifs = self.rows::<PhotoExif>(EXIFS_SQL, [list(&photo_uris)])?;
        let exifs: HashMap<&str, &Row<PhotoExif>> =
            exifs.iter().map(|e| (e.record.photo.as_str(), e)).collect();
        let authored: Vec<(&str, &str)> = rows
            .iter()
            .map(|g| (g.uri.as_str(), g.did.as_str()))
            .collect();
        let cross_posts = self.cross_posts(&authored, "gallery")?;

        Ok(rows
            .iter()
            .map(|g| {
                let r = &g.record;
                let photos: Vec<Value> = items
                    .iter()
                    .filter(|i| i.record.gallery == g.uri)
                    .filter_map(|i| {
                        let photo = photos.get(&i.record.item)?;
                        let mut view = self.photo_view(photo);
                        put(&mut view, "exif", exifs.get(photo.uri.as_str()).copied().map(exif_view));
                        view["gallery"] = json!({
                            "item": i.uri, "itemCreatedAt": i.record.created_at, "itemPosition": i.record.position,
                        });
                        Some(view)
                    })
                    .collect();
                let mut view = json!({
                    "uri": g.uri,
                    "cid": g.cid,
                    "record": gallery_record(r),
                    "indexedAt": g.indexed_at,
                    "title": gallery_title(r),
                    "createdAt": r.created_at,
                    "favCount": fav_counts.get(&g.uri).copied().unwrap_or(0),
                    "commentCount": comment_counts.get(&g.uri).copied().unwrap_or(0),
                    "creator": creators[&g.did],
                    "items": photos,
                });
                let description = r.description.as_deref();
                put(&mut view, "description", description.map(|d| lexicon::cut(d, DESCRIPTION)));
                locate(&mut view, r.location.as_ref(), r.address.as_ref());
                put(&mut view, "labels", labels.get(&g.uri).cloned());
                let pile: Vec<Value> = facepiles
                    .iter()
                    .filter(|(s, _)| *s == g.uri)
                    .map(|(_, did)| creators[did].clone())
                    .collect();
                put(&mut view, "favedByFollowing", (!pile.is_empty()).then_some(pile));
                put(&mut view, "viewer", favorites.get(&g.uri).map(|fav| json!({"fav": fav})));
                put(&mut view, "crossPost", cross_posts.get(&g.uri).map(|url| json!({"url": url})));
                if let Some((did, item)) = groups.get(g.uri.as_str()) {
                    let group = &actors[*did];
                    let mut at = json!({"did": did, "handle": group.handle, "item": item});
                    put(&mut at, "displayName", group.profile.as_ref().and_then(|p| p.record.display_name.clone()));
                    view["group"] = at;
                }
                view
            })
            .collect())
    }

    /// Each of `rows` as a `storyView`.
    pub fn stories(&self, rows: Vec<Row<Story>>) -> rusqlite::Result<Vec<Value>> {
        let uris: Vec<&str> = rows.iter().map(|s| s.uri.as_str()).collect();
        let favorites = self.viewer_favorites(&uris)?;
        let viewed: Vec<(String,)> = self.all(VIEWED_SQL, params![self.viewer, list(&uris)])?;
        let mut dids: Vec<&str> = rows.iter().map(|s| s.did.as_str()).collect();
        dids.sort_unstable();
        dids.dedup();
        let creators = self.profiles(&dids)?;
        let records: Vec<(&str, &str, &str)> = rows
            .iter()
            .map(|s| (s.uri.as_str(), s.did.as_str(), s.indexed_at.as_str()))
            .collect();
        let labels = self.record_labels(&records)?;
        let comment_counts = self.comment_counts(&uris)?;
        let authored: Vec<(&str, &str)> = rows
            .iter()
            .map(|s| (s.uri.as_str(), s.did.as_str()))
            .collect();
        let cross_posts = self.cross_posts(&authored, "story")?;
        let expired_before = ago(STORY_MICROS);
        Ok(rows
            .iter()
            .map(|s| {
                let r = &s.record;
                let mut view = json!({
                    "uri": s.uri,
                    "cid": s.cid,
                    "creator": creators[&s.did],
                    "thumb": self.cdn.url(&s.did, &r.media.0, THUMBNAIL),
                    "fullsize": self.cdn.url(&s.did, &r.media.0, FULLSIZE),
                    "aspectRatio": r.aspect_ratio.0,
                    "createdAt": r.created_at,
                    "expired": r.created_at < expired_before,
                    "commentCount": comment_counts.get(&s.uri).copied().unwrap_or(0),
                });
                locate(&mut view, r.location.as_ref(), r.address.as_ref());
                put(&mut view, "labels", labels.get(&s.uri).cloned());
                put(
                    &mut view,
                    "crossPost",
                    cross_posts.get(&s.uri).map(|url| json!({"url": url})),
                );
                let mut viewer = Map::new();
                if let Some(fav) = favorites.get(&s.uri) {
                    viewer.insert("fav".into(), fav.as_str().into());
                }
                if viewed.iter().any(|(v,)| *v == s.uri) {
                    viewer.insert("viewed".into(), true.into());
                }
                put(&mut view, "viewer", (!viewer.is_empty()).then_some(viewer));
                view
            })
            .collect())
    }
}

/// Where a gallery or story was, on its view: the place, its address,
/// and the label shown for them.
fn locate(view: &mut Value, location: Option<&Json>, address: Option<&Json>) {
    let Some(Json(location)) = location else {
        return;
    };
    let mut at = json!({"value": location["value"]});
    put(&mut at, "name", location["name"].as_str());
    view["location"] = at;
    let address = address.map(|a| a.0.clone());
    view["locationDisplay"] =
        place::display(location, address.as_ref().unwrap_or(&Value::Null)).into();
    put(view, "address", address);
}

/// A gallery's record, as its author wrote it, from the row the index
/// keeps of it.
fn gallery_record(g: &Gallery) -> Value {
    let mut record =
        json!({"$type": "social.grain.gallery", "title": g.title, "createdAt": g.created_at});
    put(&mut record, "description", g.description.clone());
    for (key, value) in [
        ("facets", &g.facets),
        ("labels", &g.labels),
        ("location", &g.location),
        ("address", &g.address),
    ] {
        put(&mut record, key, value.as_ref().map(|v| v.0.clone()));
    }
    put(&mut record, "updatedAt", g.updated_at.clone());
    record
}

/// The EXIF a photo carries, as an `exifView`: its decimals, scaled by a
/// million in the record, read as a photographer writes them, and what is
/// zero or empty left out.
pub fn exif_view(e: &Row<PhotoExif>) -> Value {
    const SCALE: f64 = 1_000_000.0;
    let r = &e.record;
    let mut view = json!({"uri": e.uri, "cid": e.cid, "photo": r.photo, "createdAt": r.created_at});
    let given = |v: Option<i64>| v.filter(|v| *v != 0).map(|v| v as f64 / SCALE);
    let text = |v: &Option<String>| v.clone().filter(|v| !v.is_empty());
    put(&mut view, "dateTimeOriginal", text(&r.date_time_original));
    let exposure = given(r.exposure_time).map(|s| match s >= 1.0 {
        true => format!("{s}s"),
        false => format!("1/{}s", (1.0 / s).round()),
    });
    put(&mut view, "exposureTime", exposure);
    put(
        &mut view,
        "fNumber",
        given(r.f_number).map(|f| format!("f/{f:.1}")),
    );
    put(&mut view, "flash", text(&r.flash));
    put(
        &mut view,
        "focalLengthIn35mmFormat",
        given(r.focal_length_in35mm_format).map(|f| format!("{}mm", f.round())),
    );
    put(&mut view, "iSO", given(r.iso).map(|i| i.round() as i64));
    put(&mut view, "lensMake", text(&r.lens_make));
    put(&mut view, "lensModel", text(&r.lens_model));
    put(&mut view, "make", text(&r.make));
    put(&mut view, "model", text(&r.model));
    view
}

/// The photos `?1` names, of accounts shown.
pub fn photos_sql() -> String {
    format!(
        "SELECT * FROM photo p WHERE p.uri IN (SELECT value FROM json_each(?1)) AND {}",
        shown("p.did")
    )
}

/// How many comments each of `?1` has that a thread shows.
pub fn comment_counts_sql() -> String {
    format!(
            "SELECT c.subject, count(*) FROM comment c WHERE c.subject IN (SELECT value FROM json_each(?1))
               AND {} AND {} GROUP BY c.subject",
            shown("c.did"),
            not_orphaned("c")
        )
}

/// The galleries `?1` names, of accounts shown.
pub fn galleries_at_sql() -> String {
    format!(
        "SELECT * FROM gallery g WHERE g.uri IN (SELECT value FROM json_each(?1)) AND {}",
        shown("g.did")
    )
}

/// The viewer `?1`'s follows who favorited each of `?2`, the latest first, `?3` a gallery.
pub fn facepile_sql() -> String {
    format!(
            "SELECT subject, did FROM (
               SELECT subject, did, row_number() OVER (PARTITION BY subject ORDER BY latest DESC, did) AS n
               FROM (SELECT f.subject AS subject, f.did AS did, max(f.created_at) AS latest
                     FROM favorite f JOIN follow o ON o.did = ?1 AND o.subject = f.did
                     WHERE f.subject IN (SELECT value FROM json_each(?2)) AND f.did <> ?1
                       AND {} AND {}
                     GROUP BY f.subject, f.did))
             WHERE n <= ?3 ORDER BY subject, n",
            shown("f.did"),
            unblocked("f.did", "?1")
        )
}

#[cfg(test)]
pub fn queries() -> Vec<String> {
    let mut queries: Vec<String> = [
        HANDLES_SQL,
        PROFILES_SQL,
        LABELS_SQL,
        SELF_LABELS_SQL,
        VIEWER_FAVORITES_SQL,
        CROSS_POST_SQL,
        POOLS_SQL,
        FAV_COUNTS_SQL,
        ITEMS_SQL,
        EXIFS_SQL,
        VIEWED_SQL,
    ]
    .into_iter()
    .map(String::from)
    .collect();
    queries.extend([
        photos_sql(),
        comment_counts_sql(),
        galleries_at_sql(),
        facepile_sql(),
    ]);
    queries
}
