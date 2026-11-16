//! `social.grain.story.*`: the stories posted in the last day, by author,
//! one story by its URI, and an account's every story, expired or not.

use super::moderation::{shown, unblocked, unhidden, unhidden_by_author, unmuted};
use super::views::{STORY_MICROS, ago, put};
use super::{Params, Reader, page};
use crate::index::records::Story;
use crate::xrpc::Failure;
use rusqlite::params;
use serde_json::{Map, Value, json};

/// What leaves a story `s` out of a list: its author not shown, or a
/// label that hides, whether from grain's labeler or its author.
fn listed() -> String {
    format!(
        "{} AND {} AND {}",
        shown("s.did"),
        unhidden("s.uri"),
        unhidden_by_author("s.uri")
    )
}

/// The stories `?1` posted since `?2`, the oldest first.
pub fn stories_sql() -> String {
    format!(
        "SELECT * FROM story s WHERE s.did = ?1 AND s.created_at > ?2 AND {}
         ORDER BY s.created_at, s.uri",
        listed()
    )
}

/// `social.grain.story.getStories`: an account's stories that stand.
pub fn get_stories(r: &Reader, p: &Params) -> Result<Value, Failure> {
    let did = r.actor(p)?;
    let rows = r.rows::<Story>(&stories_sql(), params![did, ago(STORY_MICROS)])?;
    Ok(json!({ "stories": r.stories(rows)? }))
}

/// The story `?1`, of an account shown.
pub fn story_sql() -> String {
    format!(
        "SELECT * FROM story s WHERE s.uri = ?1 AND {}",
        shown("s.did")
    )
}

/// `social.grain.story.getStory`: the story, labels and all, expired or
/// not; nothing where there is none to show.
pub fn get_story(r: &Reader, p: &Params) -> Result<Value, Failure> {
    let uri = r.record_uri(p, "story")?;
    let rows = r.rows::<Story>(&story_sql(), [&uri])?;
    let mut answer = json!({});
    put(&mut answer, "story", r.stories(rows)?.pop());
    Ok(answer)
}

/// The stories `?1` posted, expired or not, that a list shows the viewer
/// `?2`, the latest first, after the cursor's `?3` and `?4`.
pub fn archive_sql() -> String {
    format!(
        "SELECT * FROM story s WHERE s.did = ?1 AND {} AND {}
           AND (s.created_at, s.uri) < (?3, ?4)
         ORDER BY s.created_at DESC, s.uri DESC LIMIT ?5",
        listed(),
        unblocked("s.did", "?2")
    )
}

/// `social.grain.story.getArchive`: an account's stories, the latest
/// first, those that have expired as well as those that stand.
pub fn get_archive(r: &Reader, p: &Params) -> Result<Value, Failure> {
    let did = r.actor(p)?;
    let limit = p.limit(50, 100)?;
    let (at, after) = p.after(false)?;
    let params = params![did, r.viewer, at, after, (limit + 1) as i64];
    let rows = r.rows::<Story>(&archive_sql(), params)?;
    let (rows, cursor) = page(rows, limit, |s| {
        (s.record.created_at.as_str(), s.uri.as_str())
    });
    let mut answer = json!({ "stories": r.stories(rows)? });
    put(&mut answer, "cursor", cursor);
    Ok(answer)
}

/// Each account with stories since `?1` that a list shows the viewer
/// `?2`, the latest first: how many, the latest, and of those the viewer
/// watched, the latest, and how many they did not.
pub fn authors_sql() -> String {
    format!(
        "SELECT s.did, count(*), max(s.created_at) AS latest,
                max(CASE WHEN v.subject IS NOT NULL THEN s.created_at END),
                sum(CASE WHEN v.subject IS NULL THEN 1 ELSE 0 END)
         FROM story s LEFT JOIN story_view v ON v.did = ?2 AND v.subject = s.uri
         WHERE s.created_at > ?1 AND {} AND {} AND {}
         GROUP BY s.did ORDER BY latest DESC, s.did",
        listed(),
        unblocked("s.did", "?2"),
        unmuted("s.did", "?2")
    )
}

/// `social.grain.story.getAuthors`.
pub fn get_authors(r: &Reader, _: &Params) -> Result<Value, Failure> {
    let rows: Vec<(String, i64, String, Option<String>, i64)> =
        r.all(&authors_sql(), params![ago(STORY_MICROS), r.viewer])?;
    let dids: Vec<&str> = rows.iter().map(|row| row.0.as_str()).collect();
    let profiles = r.profiles(&dids)?;
    let authors: Vec<Value> = rows
        .iter()
        .map(|(did, count, latest, last_viewed, unviewed)| {
            let mut author = Map::new();
            author.insert("profile".into(), profiles[did].clone());
            author.insert("storyCount".into(), (*count).into());
            author.insert("latestAt".into(), latest.as_str().into());
            if r.viewer.is_some() {
                author.insert("unviewedCount".into(), (*unviewed).into());
                if let Some(at) = last_viewed {
                    author.insert("lastViewedAt".into(), at.as_str().into());
                }
            }
            Value::Object(author)
        })
        .collect();
    Ok(json!({ "authors": authors }))
}

#[cfg(test)]
pub fn queries() -> Vec<String> {
    vec![stories_sql(), story_sql(), authors_sql(), archive_sql()]
}
