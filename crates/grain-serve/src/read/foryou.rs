//! For You: galleries favorited by those who favorited what the viewer
//! did, ranked with spacecowboy17's weights; and where the viewer has favorited nothing
//! anyone else has, the month's most favorited.

use super::feed::seen;
use super::views::{ago, put};
use super::{Params, Reader, list};
use crate::xrpc::Failure;
use rusqlite::params;
use serde_json::{Value, json};
use std::collections::{HashMap, HashSet};

/// How many hours a gallery's score takes to halve.
const HALF_LIFE_HOURS: f64 = 6.0;
/// How much a gallery reached by more paths gains: its paths to this.
const SMOOTHING: f64 = 0.5;
/// How much a gallery favorited by many loses: its favorites to this.
const POPULARITY_PENALTY: f64 = 0.3;
/// A co-favoriter's favorite counts for one over their favorites to this.
const DIVISOR_POWER: f64 = 1.0;
/// How long, in days, after the viewer a co-favoriter may have favorited
/// a gallery and still count as having got there first.
const TIME_SHIFT_DAYS: f64 = 1.0;
/// How many of the viewer's latest favorites the feed starts from.
const SEEDS: i64 = 500;
/// How many co-favoriters it reads, those sharing most first.
const COLIKERS: usize = 1000;
/// The most a page holds.
const PAGE: usize = 50;
/// How long the cold start looks back.
const MONTH_MICROS: u64 = 30 * 24 * 60 * 60 * 1_000_000;

/// The viewer's latest favorites, and when, as a Julian day.
pub const SEEDS_SQL: &str = "SELECT subject, julianday(created_at) FROM favorite
     WHERE did = ?1 ORDER BY created_at DESC LIMIT ?2";

/// Who else favorited `?2`'s subjects, and when, the latest first.
pub const COLIKERS_SQL: &str = "SELECT did, subject, julianday(created_at) FROM favorite
     WHERE subject IN (SELECT value FROM json_each(?2)) AND did != ?1 ORDER BY created_at DESC";

/// How many favorites each of `?1` holds.
pub const LIKES_SQL: &str = "SELECT did, count(*) FROM favorite
     WHERE did IN (SELECT value FROM json_each(?1)) GROUP BY did";

/// How many favorites each of `?1` has.
pub const POPULARITY_SQL: &str = "SELECT subject, count(*) FROM favorite
     WHERE subject IN (SELECT value FROM json_each(?1)) GROUP BY subject";

/// Each gallery the co-favoriters `?2` favorited, other than the seeds
/// `?3` and the viewer `?1`'s own, with who and how many hours old.
pub fn candidates_sql() -> String {
    format!(
        "SELECT f.did, f.subject, (julianday('now') - julianday(g.sort_at)) * 24 FROM favorite f
         JOIN gallery g ON g.uri = f.subject
         WHERE f.did IN (SELECT value FROM json_each(?2))
           AND f.subject NOT IN (SELECT value FROM json_each(?3))
           AND g.did != ?1 AND {}
         ORDER BY f.created_at DESC, f.uri",
        seen("g")
    )
}

/// The most favorited galleries since `?2` that the viewer `?1` did not
/// post, the latest first among those as favorited.
pub fn cold_sql() -> String {
    format!(
        "SELECT g.uri FROM gallery g
         WHERE g.did != ?1 AND g.sort_at > ?2 AND {}
         ORDER BY (SELECT count(*) FROM favorite f WHERE f.subject = g.uri) DESC,
           g.sort_at DESC, g.uri LIMIT ?3 OFFSET ?4
         -- sorts: gallery, those since ?2, a window of days, by how many favorited each",
        seen("g")
    )
}

/// For You, for the viewer, from the offset `cursor` names.
pub fn feed(r: &Reader, p: &Params) -> Result<Value, Failure> {
    let viewer = r.signed_in()?;
    let limit = p.limit(PAGE, 100)?.min(PAGE);
    let offset: usize = match p.get("cursor") {
        None => 0,
        Some(c) => c
            .parse()
            .map_err(|_| Failure::invalid("malformed cursor"))?,
    };
    let (uris, more): (Vec<String>, bool) = match ranked(r, viewer)? {
        Some(ranked) => {
            let more = offset + limit < ranked.len();
            let page = ranked.into_iter().skip(offset).take(limit).collect();
            (page, more)
        }
        None => {
            let rows: Vec<(String,)> = r.all(
                &cold_sql(),
                params![viewer, ago(MONTH_MICROS), (limit + 1) as i64, offset as i64],
            )?;
            let more = rows.len() > limit;
            (rows.into_iter().take(limit).map(|(u,)| u).collect(), more)
        }
    };
    let uris: Vec<&str> = uris.iter().map(String::as_str).collect();
    let mut answer = json!({"items": r.galleries_at(&uris)?});
    put(
        &mut answer,
        "cursor",
        more.then(|| (offset + limit).to_string()),
    );
    Ok(answer)
}

/// What there is to show the viewer, best first; none where no one else
/// favorited what they did before them.
fn ranked(r: &Reader, viewer: &str) -> rusqlite::Result<Option<Vec<String>>> {
    let seeds: Vec<(String, Option<f64>)> = r.all(SEEDS_SQL, params![viewer, SEEDS])?;
    // When the viewer favorited each, the first time where they did twice.
    let mut liked: HashMap<&str, Option<f64>> = HashMap::new();
    for (subject, at) in &seeds {
        liked.insert(subject.as_str(), *at);
    }
    let subjects: Vec<&str> = seeds.iter().map(|(s, _)| s.as_str()).collect();
    let rows: Vec<(String, String, Option<f64>)> =
        r.all(COLIKERS_SQL, params![viewer, list(&subjects)])?;
    // Who got to a seed first, or within a day after, and to which.
    let mut colikers: Vec<&str> = Vec::new();
    let mut shared: HashMap<&str, HashSet<&str>> = HashMap::new();
    for (did, subject, at) in &rows {
        let Some(Some(mine)) = liked.get(subject.as_str()) else {
            continue;
        };
        if at.is_some_and(|at| at <= mine + TIME_SHIFT_DAYS) {
            let to = shared.entry(did.as_str()).or_default();
            if to.is_empty() {
                colikers.push(did.as_str());
            }
            to.insert(subject.as_str());
        }
    }
    if colikers.is_empty() {
        return Ok(None);
    }
    colikers.sort_by_key(|did| std::cmp::Reverse(shared[did].len()));
    colikers.truncate(COLIKERS);

    let candidates: Vec<(String, String, Option<f64>)> = r.all(
        &candidates_sql(),
        params![viewer, list(&colikers), list(&subjects)],
    )?;
    let likes: HashMap<String, i64> = r
        .all::<(String, i64)>(LIKES_SQL, [list(&colikers)])?
        .into_iter()
        .collect();
    let mut galleries: Vec<&str> = candidates.iter().map(|c| c.1.as_str()).collect();
    galleries.sort_unstable();
    galleries.dedup();
    let popularity: HashMap<String, i64> = r
        .all::<(String, i64)>(POPULARITY_SQL, [list(&galleries)])?
        .into_iter()
        .collect();

    // Each gallery's score, its paths and age, in the order first reached.
    let mut order: Vec<&str> = Vec::new();
    let mut scores: HashMap<&str, (f64, f64, Option<f64>)> = HashMap::new();
    for (did, gallery, age) in &candidates {
        let total = likes.get(did).copied().filter(|n| *n > 0).unwrap_or(1) as f64;
        let entry = scores.entry(gallery.as_str()).or_insert_with(|| {
            order.push(gallery.as_str());
            (0.0, 0.0, *age)
        });
        entry.0 += 1.0 / total.powf(DIVISOR_POWER);
        entry.1 += 1.0;
    }
    let mut scored: Vec<(&str, f64)> = order
        .into_iter()
        .map(|uri| {
            let (score, paths, age) = scores[uri];
            let popularity = popularity.get(uri).copied().filter(|n| *n > 0).unwrap_or(1);
            let decay = 0.5f64.powf(age.unwrap_or(f64::INFINITY) / HALF_LIFE_HOURS);
            let score = score * paths.powf(SMOOTHING) * decay
                / (popularity as f64).powf(POPULARITY_PENALTY);
            (uri, score)
        })
        .collect();
    scored.sort_by(|a, b| b.1.total_cmp(&a.1));
    Ok(Some(
        scored.into_iter().map(|(u, _)| u.to_string()).collect(),
    ))
}

#[cfg(test)]
pub fn queries() -> Vec<String> {
    vec![
        SEEDS_SQL.into(),
        COLIKERS_SQL.into(),
        LIKES_SQL.into(),
        POPULARITY_SQL.into(),
        candidates_sql(),
        cold_sql(),
    ]
}
