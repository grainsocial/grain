//! For You: galleries favorited by those who favorited what the viewer
//! did, ranked with spacecowboy17's weights; and where the viewer has favorited nothing
//! anyone else has, the month's most favorited.
//!
//! A ranking reads every favorite of up to a thousand co-favoriters, so it
//! is kept a minute ([`Rankings`]): the pages after the first, and a page
//! asked for again, read it rather than rank anew. Each page is held to
//! what the viewer may see as it is read, so a block, a mute or a label
//! stands at once.

use super::feed::seen;
use super::views::{ago, put};
use super::{Params, Reader, list};
use crate::xrpc::Failure;
use rusqlite::params;
use serde_json::{Value, json};
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

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
/// How long a viewer's ranking is kept.
const KEPT: Duration = Duration::from_secs(60);
/// The most viewers' rankings kept at once, each a few thousand URIs.
const KEEP: usize = 64;

/// The viewer's latest favorites, and when, as a Julian day.
pub const SEEDS_SQL: &str = "SELECT subject, julianday(created_at) FROM favorite
     WHERE did = ?1 ORDER BY created_at DESC LIMIT ?2";

/// Who else favorited `?2`'s subjects, and when, the latest first.
pub const COLIKERS_SQL: &str = "SELECT did, subject, julianday(created_at) FROM favorite
     WHERE subject IN (SELECT value FROM json_each(?2)) AND did != ?1 ORDER BY created_at DESC";

/// How many favorites each of `?1` holds.
pub const LIKES_SQL: &str = "SELECT did, count(*) FROM favorite
     WHERE did IN (SELECT value FROM json_each(?1)) GROUP BY did";

/// Each favorite of the co-favoriters `?1` other than of the seeds `?2`,
/// who made it and of what, the latest first: a path to a gallery.
pub const PATHS_SQL: &str = "SELECT did, subject FROM favorite
     WHERE did IN (SELECT value FROM json_each(?1))
       AND subject NOT IN (SELECT value FROM json_each(?2))
     ORDER BY created_at DESC, uri";

/// Which of the galleries `?2` the viewer `?1` may see and did not post,
/// each with how many hours old it is and how many favorited it: once a
/// gallery, however many paths reach it.
pub fn shown_sql() -> String {
    format!(
        "SELECT g.uri, (julianday('now') - julianday(g.sort_at)) * 24,
           (SELECT count(*) FROM favorite f WHERE f.subject = g.uri)
         FROM gallery g
         WHERE g.uri IN (SELECT value FROM json_each(?2)) AND g.did != ?1 AND {}",
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

/// A ranking, best first, and when it was made.
type Made = (Instant, Arc<[String]>);

/// Each viewer's ranking made lately, kept [`KEPT`]; past [`KEEP`] the
/// oldest is dropped.
#[derive(Default)]
pub struct Rankings {
    kept: Mutex<HashMap<String, Made>>,
}

impl Rankings {
    /// `viewer`'s ranking, if one was made less than [`KEPT`] before `now`.
    fn get(&self, viewer: &str, now: Instant) -> Option<Arc<[String]>> {
        let kept = self.kept.lock().unwrap();
        let (at, ranked) = kept.get(viewer)?;
        (now.duration_since(*at) < KEPT).then(|| ranked.clone())
    }

    /// Keeps `ranked` as `viewer`'s, made at `now`.
    fn put(&self, viewer: &str, ranked: Arc<[String]>, now: Instant) {
        let mut kept = self.kept.lock().unwrap();
        kept.retain(|_, (at, _)| now.duration_since(*at) < KEPT);
        if kept.len() >= KEEP && !kept.contains_key(viewer) {
            let oldest = kept.iter().min_by_key(|(_, (at, _))| *at);
            if let Some(oldest) = oldest.map(|(v, _)| v.clone()) {
                kept.remove(&oldest);
            }
        }
        kept.insert(viewer.to_string(), (now, ranked));
    }
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
    let now = Instant::now();
    let ranked = match r.rankings.get(viewer, now) {
        Some(ranked) => Some(ranked),
        None => {
            let ranked = ranked(r, viewer)?.map(Arc::<[String]>::from);
            if let Some(ranked) = &ranked {
                r.rankings.put(viewer, ranked.clone(), now);
            }
            ranked
        }
    };
    let (uris, more): (Vec<String>, bool) = match ranked {
        Some(ranked) => {
            let more = offset + limit < ranked.len();
            let page: Vec<&str> = ranked
                .iter()
                .skip(offset)
                .take(limit)
                .map(String::as_str)
                .collect();
            // The page as the viewer may see it now, in its order.
            let shown: HashSet<String> = r
                .all::<(String, Option<f64>, i64)>(&shown_sql(), params![viewer, list(&page)])?
                .into_iter()
                .map(|(uri, _, _)| uri)
                .collect();
            let page = page.into_iter().filter(|u| shown.contains(*u));
            (page.map(str::to_string).collect(), more)
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

    // The paths, then each gallery they reach held to what the viewer
    // may see once, not once a path: most of the network's favorites
    // may be paths, to a few thousand galleries.
    let paths: Vec<(String, String)> =
        r.all(PATHS_SQL, params![list(&colikers), list(&subjects)])?;
    let mut reached: Vec<&str> = paths.iter().map(|(_, g)| g.as_str()).collect();
    reached.sort_unstable();
    reached.dedup();
    let shown: HashMap<String, (Option<f64>, i64)> = r
        .all::<(String, Option<f64>, i64)>(&shown_sql(), params![viewer, list(&reached)])?
        .into_iter()
        .map(|(uri, age, popularity)| (uri, (age, popularity)))
        .collect();
    let likes: HashMap<String, i64> = r
        .all::<(String, i64)>(LIKES_SQL, [list(&colikers)])?
        .into_iter()
        .collect();

    // Each gallery's score and paths, in the order first reached.
    let mut order: Vec<&str> = Vec::new();
    let mut scores: HashMap<&str, (f64, f64)> = HashMap::new();
    for (did, gallery) in &paths {
        if !shown.contains_key(gallery) {
            continue;
        }
        let total = likes.get(did).copied().filter(|n| *n > 0).unwrap_or(1) as f64;
        let entry = scores.entry(gallery.as_str()).or_insert_with(|| {
            order.push(gallery.as_str());
            (0.0, 0.0)
        });
        entry.0 += 1.0 / total.powf(DIVISOR_POWER);
        entry.1 += 1.0;
    }
    let mut scored: Vec<(&str, f64)> = order
        .into_iter()
        .map(|uri| {
            let (score, paths) = scores[uri];
            let (age, popularity) = shown[uri];
            let decay = 0.5f64.powf(age.unwrap_or(f64::INFINITY) / HALF_LIFE_HOURS);
            let score = score * paths.powf(SMOOTHING) * decay
                / (popularity.max(1) as f64).powf(POPULARITY_PENALTY);
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
        PATHS_SQL.into(),
        shown_sql(),
        cold_sql(),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ranking(uri: &str) -> Arc<[String]> {
        Arc::from(vec![uri.to_string()])
    }

    #[test]
    fn a_ranking_is_kept_a_minute() {
        let rankings = Rankings::default();
        let at = Instant::now();
        assert!(rankings.get("did:plc:a", at).is_none());
        rankings.put("did:plc:a", ranking("at://g/1"), at);
        let kept = rankings.get("did:plc:a", at + KEPT - Duration::from_secs(1));
        assert_eq!(kept.as_deref(), Some(&["at://g/1".to_string()][..]));
        assert!(rankings.get("did:plc:b", at).is_none());
        assert!(rankings.get("did:plc:a", at + KEPT).is_none());
    }

    #[test]
    fn past_the_most_kept_the_oldest_goes() {
        let rankings = Rankings::default();
        let at = Instant::now();
        for i in 0..KEEP {
            let viewer = format!("did:plc:{i}");
            rankings.put(
                &viewer,
                ranking("at://g/1"),
                at + Duration::from_millis(i as u64),
            );
        }
        let later = at + Duration::from_secs(1);
        // Made again, one already kept takes its own place.
        rankings.put("did:plc:1", ranking("at://g/2"), later);
        assert!(rankings.get("did:plc:0", later).is_some());
        rankings.put("did:plc:new", ranking("at://g/3"), later);
        assert!(rankings.get("did:plc:0", later).is_none());
        assert!(rankings.get("did:plc:new", later).is_some());
        assert_eq!(rankings.get("did:plc:1", later).unwrap()[0], "at://g/2");
        // Those past their minute go before any is dropped for room: all
        // but the two made a second later.
        let gone = at + KEPT + Duration::from_millis(500);
        rankings.put("did:plc:last", ranking("at://g/4"), gone);
        assert_eq!(rankings.kept.lock().unwrap().len(), 3);
    }
}
