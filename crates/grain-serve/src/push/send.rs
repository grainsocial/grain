//! The sender: a task that pushes the notifications each record new to
//! the index gives rise to, off the path that put it.
//!
//! A live path says a record arrived ([`Index::arrived`]); the sender
//! then, in turn:
//!
//! - leaves it be if it says it was made more than [`RECENT`] ago, or
//!   says no time it was made: an account's old records put again, as a
//!   repo moved to a new host is, are not news;
//! - keeps that it was pushed (`push_record`), and leaves it be if it
//!   was already, as one deleted and made again is;
//! - finds whom it notifies, where they want it pushed
//!   ([`notification::arising`]), which leaves out an author taken down,
//!   blocking or blocked, or muted, and a record a label hides;
//! - makes each a [`Message`]: what the author did, by their profile's
//!   name, where a tap goes, and the recipient's unread count as the
//!   badge;
//! - pushes it to each of the recipient's devices, each on its own task,
//!   trying one again [`Retry::tries`] times in all; a device its service
//!   says is gone is forgotten.

use super::{Message, Outcome, Transports};
use crate::index::{Index, record_uri, records};
use crate::read::notification;
use rusqlite::{Connection, OptionalExtension};
use std::collections::BTreeMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;

/// How many records may wait to be pushed; past that, one arriving is not.
pub const QUEUED: usize = 10_000;

/// How long ago a record may say it was made and still be pushed.
pub const RECENT: &str = "-1 hour";

/// How long a pushed record is kept as pushed.
pub const KEPT: &str = "-1 day";

/// The tables of the records that notify anyone ([`notification`]'s
/// arms).
pub const NOTIFYING: [&str; 4] = ["favorite", "follow", "comment", "gallery"];

/// How a push that may go if tried again is tried.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Retry {
    /// How many times in all.
    pub tries: u32,
    /// The wait before the second, doubled before each after.
    pub wait: Duration,
}

impl Default for Retry {
    fn default() -> Retry {
        Retry {
            tries: 4,
            wait: Duration::from_secs(2),
        }
    }
}

/// What finds the pushes of a record: [`pushes`], but for tests.
type Find = fn(&Connection, &str) -> rusqlite::Result<Vec<(String, Message)>>;

/// Starts pushing what `index` says arrives, by `transports`, on the
/// runtime this is called on.
pub fn start(index: Arc<Index>, transports: Arc<Transports>, retry: Retry) {
    start_finding(index, transports, retry, pushes)
}

/// [`start`], finding each record's pushes with `find`. One whose finding
/// panics is logged and left, and the next is pushed as ever.
pub(crate) fn start_finding(
    index: Arc<Index>,
    transports: Arc<Transports>,
    retry: Retry,
    find: Find,
) {
    let (to, mut from) = mpsc::channel::<String>(QUEUED);
    if !index.push_to(to) {
        tracing::warn!("push: already started");
        return;
    }
    tokio::spawn(async move {
        while let Some(uri) = from.recv().await {
            // Off the runtime's threads, as it holds the index's lock; and
            // a panic is caught while it does, so the lock is not poisoned.
            let found = (index.clone(), uri.clone());
            let pushes = tokio::task::spawn_blocking(move || {
                let (index, uri) = found;
                index.read(|db| {
                    std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| find(db, &uri)))
                })
            });
            let pushes = match pushes.await {
                Ok(Ok(Ok(pushes))) => pushes,
                Ok(Ok(Err(e))) => {
                    tracing::error!(%uri, error = %e, "push: the index failed");
                    continue;
                }
                // Caught, or past catching, as on a lock already poisoned.
                Ok(Err(_)) | Err(_) => {
                    tracing::error!(%uri, "push: finding what to push panicked; not pushed");
                    continue;
                }
            };
            for (did, message) in pushes {
                let tokens = match index.push_tokens(&did) {
                    Ok(tokens) => tokens,
                    Err(e) => {
                        tracing::error!(%did, error = %e, "push: the index failed");
                        continue;
                    }
                };
                for device in tokens {
                    let (index, transports) = (index.clone(), transports.clone());
                    let (did, message) = (did.clone(), message.clone());
                    tokio::spawn(async move {
                        deliver(&index, &transports, retry, &did, &device, &message).await
                    });
                }
            }
        }
    });
}

/// Pushes `message` to `device`, one of `did`'s, as [`Retry`] says.
async fn deliver(
    index: &Index,
    transports: &Transports,
    retry: Retry,
    did: &str,
    device: &crate::index::push::PushToken,
    message: &Message,
) {
    let platform = device.platform.as_str();
    let mut wait = retry.wait;
    for tried in 1..=retry.tries {
        let Some(outcome) = transports.send(platform, &device.token, message).await else {
            return;
        };
        match outcome {
            Outcome::Sent => {
                tracing::info!(%did, platform, "push: sent");
                return;
            }
            Outcome::Gone => {
                if let Err(e) = index.drop_push_token(&device.token) {
                    tracing::error!(%did, error = %e, "push: the index failed");
                }
                tracing::info!(%did, platform, "push: the device is gone, and forgotten");
                return;
            }
            Outcome::Failed(why) => {
                tracing::warn!(%did, platform, %why, "push: failed");
                return;
            }
            Outcome::Retry(why) if tried == retry.tries => {
                tracing::warn!(%did, platform, %why, tried, "push: failed, and not tried again");
            }
            Outcome::Retry(why) => {
                tracing::info!(%did, platform, %why, tried, "push: to try again");
                tokio::time::sleep(wait).await;
                wait *= 2;
            }
        }
    }
}

/// Whether the record at `uri`, in `table`, says it was made within
/// [`RECENT`]; or later, as a clock set ahead says.
const RECENT_SQL: &str = "SELECT strftime('%Y-%m-%dT%H:%M:%fZ', created_at)
    >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?2) FROM {table} WHERE uri = ?1";

const PUSHED_SQL: &str = "INSERT OR IGNORE INTO push_record VALUES (?1, ?2)";
const FORGET_SQL: &str =
    "DELETE FROM push_record WHERE at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?1)";
const NAME_SQL: &str = "SELECT display_name FROM profile WHERE did = ?1 AND display_name <> ''";
const SUBJECT_SQL: &str = "SELECT subject FROM favorite WHERE uri = ?1
    UNION ALL SELECT subject FROM comment WHERE uri = ?1";

/// What the record at `uri` pushes, to whom: none if it is not recent,
/// was pushed already, or notifies no one who wants it pushed.
pub fn pushes(db: &Connection, uri: &str) -> rusqlite::Result<Vec<(String, Message)>> {
    let Some((author, collection, _)) = record_uri(uri) else {
        return Ok(Vec::new());
    };
    let Some(table) = records::table_of(collection).filter(|t| NOTIFYING.contains(t)) else {
        return Ok(Vec::new());
    };
    let recent: Option<Option<bool>> = db
        .query_row(&RECENT_SQL.replace("{table}", table), (uri, RECENT), |r| {
            r.get(0)
        })
        .optional()?;
    if recent.flatten() != Some(true) {
        return Ok(Vec::new());
    }
    db.execute(FORGET_SQL, [KEPT])?;
    if db.execute(PUSHED_SQL, (uri, grain::keys::now_iso()))? == 0 {
        return Ok(Vec::new());
    }
    let arising = notification::arising(db, uri)?;
    if arising.is_empty() {
        return Ok(Vec::new());
    }
    let name: Option<String> = db.query_row(NAME_SQL, [author], |r| r.get(0)).optional()?;
    let name = name.as_deref().unwrap_or("Someone");
    let subject: Option<String> = db.query_row(SUBJECT_SQL, [uri], |r| r.get(0)).optional()?;
    let mut pushes = Vec::new();
    for (recipient, reason) in arising {
        let Some(mut message) = message(&reason, name) else {
            continue;
        };
        let about = match reason.as_str() {
            "follow" => ("did", author),
            "gallery-mention" => ("uri", uri),
            _ => ("uri", subject.as_deref().unwrap_or(uri)),
        };
        message.data.insert(about.0.into(), about.1.into());
        message.badge = Some(notification::unread_count(db, &recipient)?);
        pushes.push((recipient, message));
    }
    Ok(pushes)
}

/// The notification `reason` names, of something `name` did: its title,
/// body and `type`, without what it is about or the badge.
pub fn message(reason: &str, name: &str) -> Option<Message> {
    let (title, body, kind) = match reason {
        "gallery-favorite" => ("New favorite", "favorited your gallery", reason),
        "story-favorite" => ("New favorite", "favorited your story", reason),
        "comment-favorite" => ("New favorite", "favorited your comment", reason),
        "follow" => ("New follower", "followed you", reason),
        "reply" => ("New reply", "replied to your comment", "comment-reply"),
        "gallery-comment" => ("New comment", "commented on your gallery", reason),
        "story-comment" => ("New comment", "commented on your story", reason),
        "gallery-comment-mention" => ("New mention", "mentioned you in a comment", reason),
        "gallery-mention" => ("New mention", "mentioned you in a gallery", reason),
        _ => return None,
    };
    Some(Message {
        title: title.into(),
        body: format!("{name} {body}"),
        data: BTreeMap::from([("type".to_string(), kind.to_string())]),
        badge: None,
    })
}

#[cfg(test)]
pub fn queries() -> Vec<String> {
    let mut all: Vec<String> = NOTIFYING
        .iter()
        .map(|table| RECENT_SQL.replace("{table}", table))
        .collect();
    all.extend([PUSHED_SQL, FORGET_SQL, NAME_SQL, SUBJECT_SQL].map(str::to_string));
    all
}
