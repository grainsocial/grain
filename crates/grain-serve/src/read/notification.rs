//! `social.grain.notification.*`: what others did that concerns the
//! viewer, as `app.bsky.notification.listNotifications` and
//! `getUnreadCount` answer it.
//!
//! A notification is not kept: it is a record that concerns an account,
//! found as it is asked for. Each [`ARMS`] is one way a record does:
//!
//! - a favorite of the account's gallery, story or comment;
//! - a follow of it;
//! - a reply to its comment;
//! - a top-level comment on its gallery (a `gallery-comment-mention` if
//!   it mentions the account too) or its story;
//! - a comment or gallery mentioning it ([`schema`]'s `mention`), but not
//!   a comment already one of those above, so that each record is one
//!   notification at most.
//!
//! None is of the account's own doing, and each leaves out what reads
//! leave out ([`moderation`]): an author not shown, one blocking or
//! blocked by the account, one it muted, and a record carrying a label
//! that hides. Its preferences ([`schema`]'s `notification_pref`) leave
//! out a kind it turned off, or one it hears of only from accounts it
//! follows when the author is not one.
//!
//! They run the latest first by `indexedAt`: when the index first held
//! the record, or when the record says it was made if that is earlier,
//! as Bluesky sorts them. One is read where the viewer's `seenAt`
//! ([`crate::notification`]) is at or past it, and the unread count is
//! of those past it.
//!
//! # Push
//!
//! The same arms answer the other way round, for a record rather than an
//! account: [`arising`] is who the record notifies, with the push
//! preference in place of the in-app one. The step that sends pushes
//! calls it for each record the stream creates (not backfill's, which are
//! old news), and [`unread_count`] for the badge.
//!
//! [`schema`]: crate::index::schema
//! [`moderation`]: super::moderation

use super::moderation::{shown, unblocked, unhidden, unhidden_by_author, unmuted};
use super::views::{galleries_at_sql, gallery_title, put};
use super::{Params, Reader, list, page};
use crate::cdn::AVATAR;
use crate::index::records::{Gallery, GalleryItem, Story};
use crate::xrpc::Failure;
use rusqlite::{Connection, OptionalExtension, params};
use serde_json::{Value, json};
use std::collections::HashMap;

/// One way a record notifies an account.
struct Arm {
    /// The record, `a`, and what it joins to find whom it concerns.
    from: &'static str,
    /// Whom it notifies.
    recipient: &'static str,
    /// The notification's `reason`, as SQL.
    reason: &'static str,
    /// The kind of notification preferences name it by.
    kind: &'static str,
    /// The gallery or story it is about, if any.
    on: &'static str,
    /// The text it carries, if any.
    text: &'static str,
    /// The text of the comment it answers, if it is a reply.
    reply_text: &'static str,
    /// What else it must hold.
    only: &'static str,
}

/// Each way a record notifies an account ([the module](self)).
const ARMS: &[Arm] = &[
    Arm {
        from: "favorite a JOIN gallery s ON s.uri = a.subject",
        recipient: "s.did",
        reason: "'gallery-favorite'",
        kind: "favorites",
        on: "s.uri",
        text: "NULL",
        reply_text: "NULL",
        only: "1",
    },
    Arm {
        from: "favorite a JOIN story s ON s.uri = a.subject",
        recipient: "s.did",
        reason: "'story-favorite'",
        kind: "favorites",
        on: "s.uri",
        text: "NULL",
        reply_text: "NULL",
        only: "1",
    },
    Arm {
        from: "favorite a JOIN comment s ON s.uri = a.subject",
        recipient: "s.did",
        reason: "'comment-favorite'",
        kind: "favorites",
        on: "s.subject",
        text: "s.text",
        reply_text: "NULL",
        only: "1",
    },
    Arm {
        from: "follow a",
        recipient: "a.subject",
        reason: "'follow'",
        kind: "follows",
        on: "NULL",
        text: "NULL",
        reply_text: "NULL",
        only: "1",
    },
    Arm {
        from: "comment a JOIN comment s ON s.uri = a.reply_to",
        recipient: "s.did",
        reason: "'reply'",
        kind: "comments",
        on: "a.subject",
        text: "a.text",
        reply_text: "s.text",
        only: "1",
    },
    Arm {
        from: "comment a JOIN gallery s ON s.uri = a.subject",
        recipient: "s.did",
        reason: "CASE WHEN EXISTS (SELECT 1 FROM mention m WHERE m.did = s.did AND m.uri = a.uri)
                 THEN 'gallery-comment-mention' ELSE 'gallery-comment' END",
        kind: "comments",
        on: "s.uri",
        text: "a.text",
        reply_text: "NULL",
        only: "a.reply_to IS NULL",
    },
    Arm {
        from: "comment a JOIN story s ON s.uri = a.subject",
        recipient: "s.did",
        reason: "'story-comment'",
        kind: "comments",
        on: "s.uri",
        text: "a.text",
        reply_text: "NULL",
        only: "a.reply_to IS NULL",
    },
    Arm {
        from: "mention m JOIN comment a ON a.uri = m.uri",
        recipient: "m.did",
        reason: "'gallery-comment-mention'",
        kind: "mentions",
        on: "a.subject",
        text: "a.text",
        reply_text: "NULL",
        // Not a reply to the account, nor a top-level comment on its
        // gallery or story: those notify it as such.
        only: "NOT EXISTS (SELECT 1 FROM comment p WHERE p.uri = a.reply_to AND p.did = m.did)
               AND NOT (a.reply_to IS NULL
                 AND (EXISTS (SELECT 1 FROM gallery g WHERE g.uri = a.subject AND g.did = m.did)
                   OR EXISTS (SELECT 1 FROM story t WHERE t.uri = a.subject AND t.did = m.did)))",
    },
    Arm {
        from: "mention m JOIN gallery a ON a.uri = m.uri",
        recipient: "m.did",
        reason: "'gallery-mention'",
        kind: "mentions",
        on: "a.uri",
        text: "a.description",
        reply_text: "NULL",
        only: "1",
    },
];

/// Which notifications a query finds.
#[derive(Clone, Copy)]
pub enum Of {
    /// Those of the account `?1`.
    Recipient,
    /// Those the record `?1` gives rise to.
    Record,
}

/// How a notification reaches its recipient, which their preferences
/// say for each kind.
#[derive(Clone, Copy)]
pub enum Way {
    InApp,
    Push,
}

/// A record's `indexedAt`, as notifications sort: when the index first
/// held it, or when it says it was made if that is earlier, in UTC.
const SORT_AT: &str =
    "min(coalesce(strftime('%Y-%m-%dT%H:%M:%fZ', a.created_at), a.indexed_at), a.indexed_at)";

/// The notifications `of` names, reaching their recipients `way`: a row
/// each, of `recipient, uri, did, created_at, sort_at, reason, on_uri,
/// text, reply_text`.
pub fn union(of: Of, way: Way) -> String {
    let wanted = match way {
        Way::InApp => "in_app",
        Way::Push => "push",
    };
    ARMS.iter()
        .map(|arm| {
            let r = arm.recipient;
            let pick = match of {
                Of::Recipient => format!("{r} = ?1"),
                Of::Record => "a.uri = ?1".to_string(),
            };
            format!(
                "SELECT {r} AS recipient, a.uri AS uri, a.did AS did, a.created_at AS created_at,
                   {SORT_AT} AS sort_at, {reason} AS reason, {on} AS on_uri, {text} AS text,
                   {reply_text} AS reply_text
                 FROM {from}
                 WHERE {pick} AND a.did <> {r} AND ({only}) AND {shown} AND {unblocked}
                   AND {unmuted} AND {unhidden} AND {unhidden_by_author}
                   AND NOT EXISTS (SELECT 1 FROM notification_pref p
                     WHERE p.did = {r} AND p.kind = '{kind}' AND (p.{wanted} = 0
                       OR (p.from_follows = 1 AND NOT EXISTS
                         (SELECT 1 FROM follow o WHERE o.did = {r} AND o.subject = a.did))))",
                reason = arm.reason,
                on = arm.on,
                text = arm.text,
                reply_text = arm.reply_text,
                from = arm.from,
                only = arm.only,
                kind = arm.kind,
                shown = shown("a.did"),
                unblocked = unblocked("a.did", r),
                unmuted = unmuted("a.did", r),
                unhidden = unhidden("a.uri"),
                unhidden_by_author = unhidden_by_author("a.uri"),
            )
        })
        .collect::<Vec<_>>()
        .join("\nUNION ALL\n")
}

/// A page of `?1`'s notifications, the latest first, from past
/// `(?2, ?3)`, `?4` of them.
pub fn list_sql() -> String {
    format!(
        "SELECT uri, did, created_at, sort_at, reason, on_uri, text, reply_text
         FROM ({}) WHERE (sort_at, uri) < (?2, ?3) ORDER BY sort_at DESC, uri DESC LIMIT ?4",
        union(Of::Recipient, Way::InApp)
    )
}

/// How many of `?1`'s notifications are past `?2`.
pub fn count_sql() -> String {
    format!(
        "SELECT count(*) FROM ({}) WHERE sort_at > ?2",
        union(Of::Recipient, Way::InApp)
    )
}

/// Whom the record `?1` notifies, by push, and why.
pub fn arising_sql() -> String {
    format!(
        "SELECT recipient, reason FROM ({}) ORDER BY recipient, reason",
        union(Of::Record, Way::Push)
    )
}

const SEEN_SQL: &str = "SELECT seen_at FROM notification_seen WHERE did = ?1";

/// When `did` last marked its notifications seen, if it has.
pub fn seen(db: &Connection, did: &str) -> rusqlite::Result<Option<String>> {
    db.query_row(SEEN_SQL, [did], |r| r.get(0)).optional()
}

/// How many of `did`'s notifications it has not seen.
pub fn unread_count(db: &Connection, did: &str) -> rusqlite::Result<i64> {
    let seen = seen(db, did)?.unwrap_or_default();
    db.prepare_cached(&count_sql())?
        .query_row(params![did, seen], |r| r.get(0))
}

/// Whom the record at `uri` notifies, and why, where they want it pushed:
/// a `(recipient, reason)` each.
pub fn arising(db: &Connection, uri: &str) -> rusqlite::Result<Vec<(String, String)>> {
    let mut stmt = db.prepare_cached(&arising_sql())?;
    let rows = stmt.query_map([uri], |r| Ok((r.get(0)?, r.get(1)?)))?;
    rows.collect()
}

/// `social.grain.notification.getUnreadCount`.
pub fn get_unread_count(r: &Reader, _: &Params) -> Result<Value, Failure> {
    let viewer = r.signed_in()?;
    Ok(json!({ "count": unread_count(r.db, viewer)? }))
}

/// A notification as the list reads it.
struct Found {
    uri: String,
    did: String,
    created_at: String,
    sort_at: String,
    reason: String,
    on: Option<String>,
    text: Option<String>,
    reply_text: Option<String>,
}

/// The stories of `?1`, of accounts shown.
fn stories_sql() -> String {
    format!(
        "SELECT * FROM story s WHERE s.uri IN (SELECT value FROM json_each(?1)) AND {}",
        shown("s.did")
    )
}

/// The items of each gallery of `?1`, in order.
const ITEMS_SQL: &str = "SELECT * FROM gallery_item i
  WHERE i.gallery IN (SELECT value FROM json_each(?1)) ORDER BY i.position, i.uri";

/// `social.grain.notification.listNotifications`: a page of the viewer's
/// notifications, the latest first, each said read or not.
pub fn list_notifications(r: &Reader, p: &Params) -> Result<Value, Failure> {
    let viewer = r.signed_in()?;
    let limit = p.limit(20, 100)?;
    let (at, after) = p.after(false)?;
    let seen = seen(r.db, viewer)?;
    let mut stmt = r.db.prepare_cached(&list_sql())?;
    let rows = stmt.query_map(params![viewer, at, after, (limit + 1) as i64], |row| {
        Ok(Found {
            uri: row.get(0)?,
            did: row.get(1)?,
            created_at: row.get(2)?,
            sort_at: row.get(3)?,
            reason: row.get(4)?,
            on: row.get(5)?,
            text: row.get(6)?,
            reply_text: row.get(7)?,
        })
    })?;
    let rows = rows.collect::<rusqlite::Result<Vec<_>>>()?;
    let (rows, cursor) = page(rows, limit, |n| (n.sort_at.as_str(), n.uri.as_str()));

    let mut dids: Vec<&str> = rows.iter().map(|n| n.did.as_str()).collect();
    dids.sort_unstable();
    dids.dedup();
    let authors = r.profiles(&dids)?;
    let on: Vec<&str> = rows.iter().filter_map(|n| n.on.as_deref()).collect();
    let on = list(&on);
    let galleries: HashMap<String, String> = r
        .rows::<Gallery>(&galleries_at_sql(), [&on])?
        .into_iter()
        .map(|g| {
            let title = gallery_title(&g.record);
            (g.uri, title)
        })
        .collect();
    let items = r.rows::<GalleryItem>(ITEMS_SQL, [&on])?;
    let photo_uris: Vec<&str> = items.iter().map(|i| i.record.item.as_str()).collect();
    let photos = r.photos(&photo_uris)?;
    let mut covers: HashMap<&str, String> = HashMap::new();
    for item in &items {
        let gallery = item.record.gallery.as_str();
        if covers.contains_key(gallery) {
            continue;
        }
        let photo = photos.get(&item.record.item);
        if let Some(thumb) = photo.and_then(|p| r.cdn.url(&p.did, &p.record.photo.0, AVATAR)) {
            covers.insert(gallery, thumb);
        }
    }
    let stories: HashMap<String, Option<String>> = r
        .rows::<Story>(&stories_sql(), [&on])?
        .into_iter()
        .map(|s| {
            let thumb = r.cdn.url(&s.did, &s.record.media.0, AVATAR);
            (s.uri, thumb)
        })
        .collect();

    let notifications: Vec<Value> = rows
        .iter()
        .map(|n| {
            let mut item = json!({
                "uri": n.uri,
                "reason": n.reason,
                "createdAt": n.created_at,
                "indexedAt": n.sort_at,
                "isRead": seen.as_ref().is_some_and(|seen| n.sort_at <= *seen),
                "author": authors[&n.did],
            });
            if let Some(on) = n.on.as_deref() {
                if let Some(title) = galleries.get(on) {
                    item["galleryUri"] = on.into();
                    item["galleryTitle"] = title.as_str().into();
                    put(&mut item, "galleryThumb", covers.get(on).cloned());
                }
                if let Some(thumb) = stories.get(on) {
                    item["storyUri"] = on.into();
                    put(&mut item, "storyThumb", thumb.clone());
                }
            }
            put(&mut item, "commentText", n.text.clone());
            put(&mut item, "replyToText", n.reply_text.clone());
            item
        })
        .collect();
    let mut answer = json!({ "notifications": notifications });
    put(&mut answer, "cursor", cursor);
    put(&mut answer, "seenAt", seen);
    Ok(answer)
}

#[cfg(test)]
pub fn queries() -> Vec<String> {
    vec![
        list_sql(),
        count_sql(),
        arising_sql(),
        SEEN_SQL.to_string(),
        stories_sql(),
        ITEMS_SQL.to_string(),
    ]
}
