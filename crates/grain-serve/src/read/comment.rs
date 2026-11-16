//! `social.grain.comment.getThread`: the comments on a gallery or story.

use super::moderation::{not_orphaned, shown, unblocked};
use super::views::put;
use super::{Params, Reader, list, page};
use crate::index::records::Comment;
use crate::xrpc::Failure;
use rusqlite::params;
use serde_json::{Value, json};
use std::collections::HashMap;

/// A page of the comments on `?1`, the oldest first, and how many they
/// are: of accounts shown, neither blocking nor blocked by the viewer
/// `?2`, and not answering a comment since deleted. One whose author the
/// viewer muted is kept, and said to be muted, for the client to fold.
pub fn thread_sql() -> (String, String) {
    let filter = format!(
        "c.subject = ?1 AND {} AND {} AND {}",
        shown("c.did"),
        not_orphaned("c"),
        unblocked("c.did", "?2")
    );
    let rows = format!(
        "SELECT * FROM comment c WHERE {filter} AND (c.created_at, c.uri) > (?3, ?4)
         ORDER BY c.created_at, c.uri LIMIT ?5"
    );
    (
        rows,
        format!("SELECT count(*) FROM comment c WHERE {filter}"),
    )
}

/// `social.grain.comment.getThread`.
pub fn get_thread(r: &Reader, p: &Params) -> Result<Value, Failure> {
    let subject = r.record_uri(p, "subject")?;
    let limit = p.limit(20, 100)?;
    let (at, after) = p.after(true)?;
    let (rows_sql, count_sql) = thread_sql();
    let rows = r.rows::<Comment>(
        &rows_sql,
        params![subject, r.viewer, at, after, (limit + 1) as i64],
    )?;
    let total: i64 =
        r.db.query_row(&count_sql, params![subject, r.viewer], |row| row.get(0))?;
    let (rows, cursor) = page(rows, limit, |c| {
        (c.record.created_at.as_str(), c.uri.as_str())
    });
    let mut dids: Vec<&str> = rows.iter().map(|c| c.did.as_str()).collect();
    dids.sort_unstable();
    dids.dedup();
    let authors = r.profiles(&dids)?;
    let muted: Vec<(String,)> = r.all(
        "SELECT subject FROM mute WHERE did = ?1 AND subject IN (SELECT value FROM json_each(?2))",
        params![r.viewer, list(&dids)],
    )?;
    let focus: Vec<&str> = rows
        .iter()
        .filter_map(|c| c.record.focus.as_deref())
        .collect();
    let photos = r.photos(&focus)?;
    let uris: Vec<&str> = rows.iter().map(|c| c.uri.as_str()).collect();
    let favorites = r.viewer_favorites(&uris)?;
    let fav_counts: HashMap<String, i64> = r
        .all::<(String, i64)>(
            "SELECT subject, count(DISTINCT did) FROM favorite
             WHERE subject IN (SELECT value FROM json_each(?1)) GROUP BY subject",
            [list(&uris)],
        )?
        .into_iter()
        .collect();
    let comments: Vec<Value> = rows
        .iter()
        .map(|c| {
            let record = &c.record;
            let mut view = json!({
                "uri": c.uri,
                "cid": c.cid,
                "author": authors[&c.did],
                "text": record.text,
                "createdAt": record.created_at,
                "favCount": fav_counts.get(&c.uri).copied().unwrap_or(0),
            });
            put(
                &mut view,
                "facets",
                record.facets.as_ref().map(|f| f.0.clone()),
            );
            put(&mut view, "replyTo", record.reply_to.clone());
            let photo = record.focus.as_ref().and_then(|f| photos.get(f));
            put(&mut view, "focus", photo.map(|photo| r.photo_view(photo)));
            put(
                &mut view,
                "viewer",
                favorites.get(&c.uri).map(|fav| json!({"fav": fav})),
            );
            put(
                &mut view,
                "muted",
                muted.iter().any(|(m,)| *m == c.did).then_some(true),
            );
            view
        })
        .collect();
    let mut answer = json!({"comments": comments, "totalCount": total});
    put(&mut answer, "cursor", cursor);
    Ok(answer)
}

#[cfg(test)]
pub fn queries() -> Vec<String> {
    let (rows, count) = thread_sql();
    vec![rows, count]
}
