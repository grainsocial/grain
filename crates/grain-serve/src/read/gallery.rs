//! `social.grain.gallery.*`: one gallery, and who favorited it.

use super::moderation::{shown, unblocked};
use super::views::put;
use super::{Params, Reader, graph, page};
use crate::index::records::Gallery;
use crate::xrpc::Failure;
use axum::http::StatusCode;
use rusqlite::params;
use serde_json::{Value, json};

/// The gallery `?1`, of an account shown.
pub fn gallery_sql() -> String {
    format!(
        "SELECT * FROM gallery g WHERE g.uri = ?1 AND {}",
        shown("g.did")
    )
}

/// `social.grain.gallery.getGallery`: the gallery, as its URI names it by
/// DID or handle, labels and all; none where its author is not shown, as
/// a link to it must not show what no feed does.
pub fn get_gallery(r: &Reader, p: &Params) -> Result<Value, Failure> {
    let uri = r.record_uri(p, "gallery")?;
    let rows = r.rows::<Gallery>(&gallery_sql(), [&uri])?;
    if rows.is_empty() {
        return Err(Failure::new(
            StatusCode::BAD_REQUEST,
            "NotFound",
            "Gallery not found",
        ));
    }
    let gallery = r.galleries(rows)?.remove(0);
    Ok(json!({ "gallery": gallery }))
}

/// A page of who favorited `?1`, the latest first, and how many they are:
/// of accounts shown, neither blocking nor blocked by the viewer `?2`.
pub fn favorites_sql() -> (String, String) {
    let filter = format!(
        "f.subject = ?1 AND {} AND {}",
        shown("f.did"),
        unblocked("f.did", "?2")
    );
    let rows = format!(
        "SELECT f.did, f.created_at, f.uri FROM favorite f WHERE {filter}
           AND (f.created_at, f.uri) < (?3, ?4) ORDER BY f.created_at DESC, f.uri DESC LIMIT ?5"
    );
    (
        rows,
        format!("SELECT count(DISTINCT f.did) FROM favorite f WHERE {filter}"),
    )
}

/// `social.grain.gallery.getFavorites`: who favorited the gallery.
pub fn get_favorites(r: &Reader, p: &Params) -> Result<Value, Failure> {
    let uri = r.record_uri(p, "gallery")?;
    let limit = p.limit(50, 100)?;
    let (at, after) = p.after(false)?;
    let (rows_sql, count_sql) = favorites_sql();
    let rows: Vec<(String, String, String)> = r.all(
        &rows_sql,
        params![uri, r.viewer, at, after, (limit + 1) as i64],
    )?;
    let total: i64 =
        r.db.query_row(&count_sql, params![uri, r.viewer], |row| row.get(0))?;
    let (rows, cursor) = page(rows, limit, |(_, at, uri)| (at.as_str(), uri.as_str()));
    let dids: Vec<&str> = rows.iter().map(|(did, _, _)| did.as_str()).collect();
    let mut answer = json!({"totalCount": total, "items": graph::accounts(r, &dids)?});
    put(&mut answer, "cursor", cursor);
    Ok(answer)
}

#[cfg(test)]
pub fn queries() -> Vec<String> {
    let (rows, count) = favorites_sql();
    vec![gallery_sql(), rows, count]
}
