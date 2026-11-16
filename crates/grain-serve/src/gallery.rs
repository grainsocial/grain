//! `social.grain.gallery.deleteGallery`: a gallery deleted with what hangs
//! off it, in one go, for the web. The records go from the account's PDS
//! with the session grain-serve keeps for it, as the web's other writes do
//! ([`crate::write`]), and from the index before it answers.
//!
//! What goes is the account's own: the gallery, its items, the photos
//! they place that no other of its galleries does, those photos' EXIF, and
//! its own favorite of the gallery and comments on it. What others wrote
//! about it is theirs, and stays. Children go before the gallery, so a
//! failure part way leaves a gallery with fewer photos, never photos with
//! no gallery.
//!
//! Only the web calls it, by its cookie, from a page of the site: the apps
//! delete at their own PDS and call `social.grain.sync.indexRecords`, and
//! a service token here is refused.

use crate::App;
use crate::xrpc::Failure;
use axum::Json;
use axum::body::Bytes;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode, header};
use grain::lexicon;
use rusqlite::params;
use serde::Deserialize;
use serde_json::{Value, json};
use std::sync::Arc;

/// The method, as the web's cookie calls it.
pub const DELETE_GALLERY: &str = "social.grain.gallery.deleteGallery";

#[derive(Deserialize)]
struct Input {
    rkey: String,
}

/// The records of `did`'s that go with its gallery `gallery`, children
/// first, the gallery last.
pub const GOING_SQL: &str = "
  SELECT 0, e.uri FROM photo_exif e WHERE e.did = ?2 AND e.photo IN (SELECT p FROM photos)
  UNION ALL SELECT 1, i.uri FROM gallery_item i WHERE i.gallery = ?1 AND i.did = ?2
  UNION ALL SELECT 2, p FROM photos
  UNION ALL SELECT 3, f.uri FROM favorite f WHERE f.subject = ?1 AND f.did = ?2
  UNION ALL SELECT 4, c.uri FROM comment c WHERE c.subject = ?1 AND c.did = ?2
  UNION ALL SELECT 5, g.uri FROM gallery g WHERE g.uri = ?1 AND g.did = ?2
  ORDER BY 1, 2";

/// The photos of `did`'s that its gallery `?1` places and no other of its
/// galleries does, for [`GOING_SQL`] to read.
const PHOTOS_SQL: &str = "WITH photos (p) AS (
  SELECT DISTINCT i.item FROM gallery_item i JOIN photo ph ON ph.uri = i.item AND ph.did = ?2
  WHERE i.gallery = ?1 AND i.did = ?2
    AND NOT EXISTS (SELECT 1 FROM gallery_item o
      WHERE o.item = i.item AND o.did = ?2 AND o.gallery != ?1))";

/// The whole query: the photos, then what goes.
pub fn going_sql() -> String {
    format!("{PHOTOS_SQL} {GOING_SQL}")
}

/// `social.grain.gallery.deleteGallery`.
pub async fn delete_gallery(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Value>, Failure> {
    let Some(index) = app.index.clone() else {
        let why = "this server keeps no index";
        let refused = Failure::new(StatusCode::NOT_IMPLEMENTED, "MethodNotImplemented", why);
        return Err(refused);
    };
    if headers.contains_key(header::AUTHORIZATION) {
        let why = "a service token deletes at its own PDS, then calls \
                   social.grain.sync.indexRecords";
        return Err(Failure::new(StatusCode::FORBIDDEN, "Forbidden", why));
    }
    let did = crate::viewer::writer(&app, &headers, DELETE_GALLERY).await?;
    let input: Input = serde_json::from_slice(&body)
        .map_err(|e| Failure::invalid(format!("the input is not {{rkey}}: {e}")))?;
    if !lexicon::valid_record_key(&input.rkey) {
        return Err(Failure::invalid(format!(
            "not a record key: {}",
            input.rkey
        )));
    }
    let gallery = format!("at://{did}/social.grain.gallery/{}", input.rkey);
    let going: Vec<String> = index.read(|db| {
        let mut stmt = db.prepare_cached(&going_sql())?;
        let rows = stmt.query_map(params![gallery, did], |r| r.get(1))?;
        rows.collect::<rusqlite::Result<_>>()
    })?;
    if going.last() != Some(&gallery) {
        let why = "Gallery not found";
        return Err(Failure::new(StatusCode::BAD_REQUEST, "NotFound", why));
    }
    let writes: Vec<Value> = going
        .iter()
        .filter_map(|uri| crate::index::record_uri(uri))
        .map(|(_, collection, rkey)| {
            json!({
                "$type": "com.atproto.repo.applyWrites#delete",
                "collection": collection,
                "rkey": rkey,
            })
        })
        .collect();
    let mut missed = Vec::new();
    for (chunk, uris) in writes
        .chunks(crate::write::MOST_WRITES)
        .zip(going.chunks(crate::write::MOST_WRITES))
    {
        let body = json!({ "repo": did, "writes": chunk });
        crate::write::at_pds(&app, &did, "com.atproto.repo.applyWrites", &body).await?;
        // What the index fails to drop, Jetstream drops as the PDS says.
        missed.extend(uris.iter().filter_map(|uri| index.delete(uri).err()));
    }
    let records = going.len();
    tracing::info!(%did, %gallery, records, unindexed = ?missed, "deleted a gallery");
    Ok(Json(json!({})))
}
