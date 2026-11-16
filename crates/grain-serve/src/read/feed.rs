//! `social.grain.feed.*`: grain's gallery feeds, each named by a URI as a
//! feed generator is on Bluesky.
//!
//! A feed's URI is `at://<the server's DID>/social.grain.feed.generator/<name>`.
//! The chronological feeds page by a cursor naming the last gallery's sort
//! key and URI; For You, which ranks rather than sorts, by an offset.

use super::moderation::{shown, unblocked, unhidden, unhidden_by_author, unmuted};
use super::views::put;
use super::{Params, Reader, camera, foryou, list, location, page};
use crate::xrpc::Failure;
use axum::http::StatusCode;
use rusqlite::types::Value as Sql;
use serde_json::{Value, json};

/// The collection a feed's URI names.
pub const COLLECTION: &str = "social.grain.feed.generator";

/// A feed: its page of galleries for the call.
pub type Feed = fn(&Reader, &Params) -> Result<Value, Failure>;

/// Each feed served: its name, what a reader sees it called, and its
/// generator, in the order `describeFeeds` lists them.
pub const FEEDS: &[(&str, &str, Feed)] = &[
    ("actor", "Actor Galleries", actor),
    ("camera", "Camera", camera::feed),
    ("following", "Following", following),
    ("foryou", "For You", foryou::feed),
    ("group", "Group Pool", group),
    ("groups", "Groups", groups),
    ("hashtag", "Hashtag", hashtag),
    ("location", "Location", location::feed),
    ("recent", "Recent Galleries", recent),
];

/// `social.grain.feed.describeFeeds`.
pub fn describe_feeds(r: &Reader, _: &Params) -> Result<Value, Failure> {
    let did = service(r)?;
    let feeds: Vec<Value> = FEEDS
        .iter()
        .map(|(name, label, _)| {
            json!({"uri": format!("at://{did}/{COLLECTION}/{name}"), "name": name, "label": label})
        })
        .collect();
    Ok(json!({"did": did, "feeds": feeds}))
}

/// `social.grain.feed.getFeed`: a page of the feed `feed` names.
pub fn get_feed(r: &Reader, p: &Params) -> Result<Value, Failure> {
    let uri = p.at_uri("feed")?;
    let did = service(r)?;
    let prefix = format!("at://{did}/{COLLECTION}/");
    let name = uri.strip_prefix(&prefix).unwrap_or_default();
    let Some((_, _, feed)) = FEEDS.iter().find(|(n, _, _)| *n == name) else {
        let why = format!("no feed {uri}");
        return Err(Failure::new(StatusCode::BAD_REQUEST, "UnknownFeed", why));
    };
    feed(r, p)
}

/// The DID the server names its feeds by.
fn service<'a>(r: &Reader<'a>) -> Result<&'a str, Failure> {
    r.service.ok_or_else(|| {
        let why = "this server has no DID to name its feeds by";
        Failure::new(StatusCode::NOT_IMPLEMENTED, "MethodNotImplemented", why)
    })
}

/// A feed with nothing in it, as one asked for without what it filters by
/// answers.
pub fn empty() -> Value {
    json!({"items": []})
}

/// SQL that holds where the gallery `g` has photos and is not hidden: of
/// an account shown, and carrying no label that hides, from grain's
/// labeler or its author.
pub fn listed(g: &str) -> String {
    format!(
        "{} AND {} AND {} AND EXISTS (SELECT 1 FROM gallery_item gi WHERE gi.gallery = {g}.uri)",
        shown(&format!("{g}.did")),
        unhidden(&format!("{g}.uri")),
        unhidden_by_author(&format!("{g}.uri")),
    )
}

/// [`listed`], of an account neither blocking nor blocked by the viewer
/// `?1`, nor muted by them.
pub fn seen(g: &str) -> String {
    let did = format!("{g}.did");
    format!(
        "{} AND {} AND {}",
        listed(g),
        unblocked(&did, "?1"),
        unmuted(&did, "?1")
    )
}

/// A page of a chronological feed: the galleries `uri` names, from
/// `from` where `filter` holds, the latest by `key` first, ties broken by
/// `tie`. `?1` is the viewer, `?2` and `?3` the cursor's key and tie, `?4`
/// one past the limit; a feed's own parameters come after.
pub fn chronological(from: &str, uri: &str, key: &str, tie: &str, filter: &str) -> String {
    format!(
        "SELECT {uri}, {key}, {tie} FROM {from} WHERE {filter} AND ({key}, {tie}) < (?2, ?3)
         ORDER BY {key} DESC, {tie} DESC LIMIT ?4"
    )
}

/// The galleries of `sql`, a [`chronological`] page, with `own` the
/// feed's parameters from `?5`.
pub fn run(r: &Reader, p: &Params, sql: &str, own: Vec<Sql>) -> Result<Value, Failure> {
    let limit = p.limit(30, 100)?;
    let (at, after) = p.after(false)?;
    let mut bound = vec![
        r.viewer.map_or(Sql::Null, |v| Sql::Text(v.into())),
        Sql::Text(at),
        Sql::Text(after),
        Sql::Integer((limit + 1) as i64),
    ];
    bound.extend(own);
    let rows: Vec<(String, String, String)> = r.all(sql, rusqlite::params_from_iter(bound))?;
    let (rows, cursor) = page(rows, limit, |(_, key, tie)| (key.as_str(), tie.as_str()));
    let uris: Vec<&str> = rows.iter().map(|(uri, _, _)| uri.as_str()).collect();
    let mut answer = json!({"items": r.galleries_at(&uris)?});
    put(&mut answer, "cursor", cursor);
    Ok(answer)
}

fn text(s: impl Into<String>) -> Sql {
    Sql::Text(s.into())
}

/// Recent Galleries: every gallery the viewer may see.
pub fn recent_sql() -> String {
    filtered_sql("1")
}

fn recent(r: &Reader, p: &Params) -> Result<Value, Failure> {
    run(r, p, &recent_sql(), vec![])
}

/// Following: the galleries of the accounts the viewer follows.
pub fn following_sql() -> String {
    filtered_sql("g.did IN (SELECT subject FROM follow WHERE did = ?1)")
}

fn following(r: &Reader, p: &Params) -> Result<Value, Failure> {
    r.signed_in()?;
    run(r, p, &following_sql(), vec![])
}

/// Actor Galleries: the galleries of the account `?5`, by when it says
/// it posted them, whoever is looking.
pub fn actor_sql() -> String {
    let filter = format!("g.did = ?5 AND {}", listed("g"));
    chronological("gallery g", "g.uri", "g.created_at", "g.uri", &filter)
}

fn actor(r: &Reader, p: &Params) -> Result<Value, Failure> {
    let Some(did) = p.get("actor").map(|a| r.resolve(a)).transpose()?.flatten() else {
        return Ok(empty());
    };
    run(r, p, &actor_sql(), vec![text(did)])
}

/// Hashtag: the galleries whose description, or a comment on which,
/// holds `?5`'s `#tag`.
pub fn hashtag_sql() -> String {
    filtered_sql(
        "(g.description LIKE ?5
          OR EXISTS (SELECT 1 FROM comment c WHERE c.subject = g.uri AND c.text LIKE ?5))",
    )
}

fn hashtag(r: &Reader, p: &Params) -> Result<Value, Failure> {
    let Some(tag) = p.get("tag") else {
        return Ok(empty());
    };
    run(r, p, &hashtag_sql(), vec![text(format!("%#{tag}%"))])
}

/// The galleries pooled in a group, latest pooled first.
fn pooled(filter: &str) -> String {
    let from = "group_item p JOIN gallery g ON g.uri = p.gallery";
    chronological(from, "g.uri", "p.created_at", "p.uri", filter)
}

/// Group Pool: what the group `?5` pooled, whoever is looking.
pub fn group_sql() -> String {
    pooled(&format!("p.did = ?5 AND {}", listed("g")))
}

fn group(r: &Reader, p: &Params) -> Result<Value, Failure> {
    let Some(group) = p.get("group") else {
        return Ok(empty());
    };
    run(r, p, &group_sql(), vec![text(group)])
}

/// Groups: what every group pooled.
pub fn groups_sql() -> String {
    pooled(&seen("g"))
}

fn groups(r: &Reader, p: &Params) -> Result<Value, Failure> {
    run(r, p, &groups_sql(), vec![])
}

/// A page of the galleries in `gallery g` where `filter` holds that the
/// viewer may see, by when they were posted, unless that is still to
/// come.
pub fn filtered(r: &Reader, p: &Params, filter: &str, own: Vec<Sql>) -> Result<Value, Failure> {
    run(r, p, &filtered_sql(filter), own)
}

/// The page [`filtered`] reads.
pub fn filtered_sql(filter: &str) -> String {
    let filter = format!("{filter} AND {}", seen("g"));
    chronological("gallery g", "g.uri", "g.sort_at", "g.uri", &filter)
}

/// `items` as a JSON list bound as one parameter.
pub fn listed_param<S: AsRef<str>>(items: &[S]) -> Sql {
    Sql::Text(list(items))
}

#[cfg(test)]
pub fn queries() -> Vec<String> {
    let mut queries = vec![
        recent_sql(),
        following_sql(),
        actor_sql(),
        hashtag_sql(),
        group_sql(),
        groups_sql(),
    ];
    queries.extend(camera::queries());
    queries.extend(location::queries());
    queries.extend(foryou::queries());
    queries
}
