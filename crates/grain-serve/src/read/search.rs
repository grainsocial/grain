//! Search: `social.grain.actor.searchActors`, `searchActorsTypeahead` and
//! `social.grain.gallery.searchGalleries`, read from the index's FTS5
//! tables (`profile_search`, `gallery_search`), which hold an account's
//! handle and the words of its profile or gallery, Porter-stemmed and
//! folded to their unaccented letters.
//!
//! A query is its words, less English stop words unless it is nothing
//! else, each matched as a phrase, all of them, so that every word a
//! search names must be found and none that says nothing of what is
//! wanted (`the`, `of`) must. Results are ranked
//! by BM25 and paged by an offset, since a rank has no key to resume
//! from.

use super::feed::listed;
use super::moderation::shown;
use super::views::put;
use super::{Params, Reader};
use crate::cdn::AVATAR;
use crate::xrpc::Failure;
use axum::Json;
use axum::extract::State;
use axum::http::{HeaderMap, Uri};
use rusqlite::params;
use serde_json::{Map, Value, json};
use std::sync::Arc;
use std::time::Duration;

/// Bluesky's public appview, whose typeahead fills out grain's.
pub const BSKY_APPVIEW: &str = "https://public.api.bsky.app";

/// How long typeahead waits on Bluesky's before answering without it.
const BSKY_WAIT: Duration = Duration::from_secs(3);

/// The FTS5 query `q` asks: each word a phrase, the last a prefix of a
/// word where `prefix`, as typeahead reads what is still being typed,
/// and never dropped as a stop word; none where it holds no word.
pub fn query(q: &str, prefix: bool) -> Option<String> {
    let words: Vec<&str> = q
        .split_whitespace()
        .filter(|w| w.chars().any(char::is_alphanumeric))
        .collect();
    // A word still being typed is kept: "the" may be the start of "theo".
    let typing = if prefix {
        words.len().saturating_sub(1)
    } else {
        words.len()
    };
    let kept: Vec<&str> = words
        .iter()
        .enumerate()
        .filter(|(i, w)| *i == typing || !STOP_WORDS.contains(&w.to_lowercase().as_str()))
        .map(|(_, w)| *w)
        .collect();
    let words = if kept.is_empty() { words } else { kept };
    let mut phrases: Vec<String> = words
        .iter()
        .map(|w| format!("\"{}\"", w.replace('"', "\"\"")))
        .collect();
    if prefix && let Some(last) = phrases.last_mut() {
        last.push('*');
    }
    (!phrases.is_empty()).then(|| phrases.join(" "))
}

/// Where a ranked page starts: the offset its cursor names.
fn offset(p: &Params) -> Result<usize, Failure> {
    p.get("cursor").map_or(Ok(0), |c| {
        c.parse().map_err(|_| Failure::invalid("malformed cursor"))
    })
}

/// The accounts whose profile matches `?1`, of accounts shown, best
/// first: `?2` of them from `?3`.
pub fn actors_sql() -> String {
    format!(
        "SELECT p.did FROM profile_search JOIN search_doc d ON d.id = profile_search.rowid
         JOIN profile p ON p.uri = d.uri
         WHERE profile_search MATCH ?1 AND {}
         ORDER BY profile_search.rank, p.did LIMIT ?2 OFFSET ?3",
        shown("p.did")
    )
}

/// The galleries whose words match `?1`, of those a list shows, best
/// first: `?2` of them from `?3`.
pub fn galleries_sql() -> String {
    format!(
        "SELECT g.uri FROM gallery_search JOIN search_doc d ON d.id = gallery_search.rowid
         JOIN gallery g ON g.uri = d.uri
         WHERE gallery_search MATCH ?1 AND {}
         ORDER BY gallery_search.rank, g.uri LIMIT ?2 OFFSET ?3",
        listed("g")
    )
}

/// The rows `sql` ranks for `q` from `from`, one past `limit`, and
/// whether there are more.
fn ranked(
    r: &Reader,
    sql: &str,
    q: Option<String>,
    limit: usize,
    from: usize,
) -> Result<(Vec<String>, bool), Failure> {
    let Some(q) = q else {
        return Ok((vec![], false));
    };
    let mut rows: Vec<String> = r
        .all::<(String,)>(sql, params![q, (limit + 1) as i64, from as i64])?
        .into_iter()
        .map(|(v,)| v)
        .collect();
    let more = rows.len() > limit;
    rows.truncate(limit);
    Ok((rows, more))
}

/// The page's answer: `key` the items, and a cursor past them where
/// there are more.
fn paged(key: &str, items: Vec<Value>, more: bool, next: usize) -> Value {
    let mut answer = json!({ key: items });
    put(&mut answer, "cursor", more.then(|| next.to_string()));
    answer
}

/// Each of `dids`, with its profile, as search lists it: with its
/// description where `described`.
fn profiles(r: &Reader, dids: &[&str], described: bool) -> rusqlite::Result<Vec<Value>> {
    let actors = r.actors(dids)?;
    Ok(dids
        .iter()
        .map(|did| {
            let actor = &actors[*did];
            let mut item = json!({"did": did, "handle": actor.handle});
            if let Some(p) = &actor.profile {
                put(&mut item, "displayName", p.record.display_name.clone());
                if described {
                    put(&mut item, "description", p.record.description.clone());
                }
                let avatar = p.record.avatar.as_ref();
                put(
                    &mut item,
                    "avatar",
                    avatar.and_then(|a| r.cdn.url(&p.did, &a.0, AVATAR)),
                );
            }
            item
        })
        .collect())
}

/// `social.grain.actor.searchActors`.
pub fn search_actors(r: &Reader, p: &Params) -> Result<Value, Failure> {
    let q = query(p.required("q")?, false);
    let limit = p.limit(30, 100)?;
    let from = offset(p)?;
    let (dids, more) = ranked(r, &actors_sql(), q, limit, from)?;
    let dids: Vec<&str> = dids.iter().map(String::as_str).collect();
    Ok(paged(
        "items",
        profiles(r, &dids, true)?,
        more,
        from + limit,
    ))
}

/// `social.grain.gallery.searchGalleries`.
pub fn search_galleries(r: &Reader, p: &Params) -> Result<Value, Failure> {
    let q = query(p.required("q")?, false);
    let limit = p.limit(30, 100)?;
    let from = offset(p)?;
    let (uris, more) = ranked(r, &galleries_sql(), q, limit, from)?;
    let uris: Vec<&str> = uris.iter().map(String::as_str).collect();
    Ok(paged("items", r.galleries_at(&uris)?, more, from + limit))
}

/// grain's part of `searchActorsTypeahead`: the accounts whose profile
/// matches what is typed so far.
pub fn typeahead_grain(r: &Reader, p: &Params) -> Result<Value, Failure> {
    let q = query(p.required("q")?, true);
    let limit = p.limit(5, 10)?;
    let (dids, _) = ranked(r, &actors_sql(), q, limit, 0)?;
    let dids: Vec<&str> = dids.iter().map(String::as_str).collect();
    Ok(json!({"actors": profiles(r, &dids, false)?}))
}

/// `social.grain.actor.searchActorsTypeahead`: grain's accounts first,
/// then Bluesky's that are not among them, as many as asked for in all.
/// Bluesky's are asked of the appview `--bsky-appview` names, and
/// left out where it does not answer: grain's accounts alone are still an
/// answer.
pub async fn typeahead(
    State(app): State<Arc<crate::App>>,
    headers: HeaderMap,
    uri: Uri,
) -> Result<Json<Value>, Failure> {
    const NSID: &str = "social.grain.actor.searchActorsTypeahead";
    let Json(mut answer) =
        super::answer(app.clone(), headers, uri.clone(), NSID, typeahead_grain).await?;
    let Some(appview) = &app.bsky_appview else {
        return Ok(Json(answer));
    };
    let p = super::params(&uri);
    let (q, limit) = (p.get("q").unwrap_or_default(), p.limit(5, 10)?);
    let n = limit.to_string();
    let url = format!("{appview}/xrpc/app.bsky.actor.searchActorsTypeahead");
    let asked = app
        .ctx
        .http
        .get(url)
        .query(&[("q", q), ("limit", n.as_str())])
        .timeout(BSKY_WAIT)
        .send()
        .await;
    let theirs: Value = match asked {
        Ok(res) if res.status().is_success() => res.json().await.unwrap_or_default(),
        _ => Value::Null,
    };
    let actors = answer["actors"]
        .as_array_mut()
        .expect("typeahead answers actors");
    for actor in theirs["actors"].as_array().into_iter().flatten() {
        let Some(did) = actor["did"].as_str() else {
            continue;
        };
        if actors.len() >= limit || actors.iter().any(|a| a["did"] == did) {
            continue;
        }
        let mut item = Map::new();
        item.insert("did".into(), did.into());
        for key in ["handle", "displayName", "avatar"] {
            if let Some(v) = actor[key].as_str() {
                item.insert(key.into(), v.into());
            }
        }
        actors.push(Value::Object(item));
    }
    Ok(Json(answer))
}

/// English stop words, left out of a search: DuckDB's full-text search
/// list.
const STOP_WORDS: &[&str] = &[
    "a",
    "a's",
    "able",
    "about",
    "above",
    "according",
    "accordingly",
    "across",
    "actually",
    "after",
    "afterwards",
    "again",
    "against",
    "ain't",
    "all",
    "allow",
    "allows",
    "almost",
    "alone",
    "along",
    "already",
    "also",
    "although",
    "always",
    "am",
    "among",
    "amongst",
    "an",
    "and",
    "another",
    "any",
    "anybody",
    "anyhow",
    "anyone",
    "anything",
    "anyway",
    "anyways",
    "anywhere",
    "apart",
    "appear",
    "appreciate",
    "appropriate",
    "are",
    "aren't",
    "around",
    "as",
    "aside",
    "ask",
    "asking",
    "associated",
    "at",
    "available",
    "away",
    "awfully",
    "b",
    "be",
    "became",
    "because",
    "become",
    "becomes",
    "becoming",
    "been",
    "before",
    "beforehand",
    "behind",
    "being",
    "believe",
    "below",
    "beside",
    "besides",
    "best",
    "better",
    "between",
    "beyond",
    "both",
    "brief",
    "but",
    "by",
    "c",
    "c'mon",
    "c's",
    "came",
    "can",
    "can't",
    "cannot",
    "cant",
    "cause",
    "causes",
    "certain",
    "certainly",
    "changes",
    "clearly",
    "co",
    "com",
    "come",
    "comes",
    "concerning",
    "consequently",
    "consider",
    "considering",
    "contain",
    "containing",
    "contains",
    "corresponding",
    "could",
    "couldn't",
    "course",
    "currently",
    "d",
    "definitely",
    "described",
    "despite",
    "did",
    "didn't",
    "different",
    "do",
    "does",
    "doesn't",
    "doing",
    "don't",
    "done",
    "down",
    "downwards",
    "during",
    "e",
    "each",
    "edu",
    "eg",
    "eight",
    "either",
    "else",
    "elsewhere",
    "enough",
    "entirely",
    "especially",
    "et",
    "etc",
    "even",
    "ever",
    "every",
    "everybody",
    "everyone",
    "everything",
    "everywhere",
    "ex",
    "exactly",
    "example",
    "except",
    "f",
    "far",
    "few",
    "fifth",
    "first",
    "five",
    "followed",
    "following",
    "follows",
    "for",
    "former",
    "formerly",
    "forth",
    "four",
    "from",
    "further",
    "furthermore",
    "g",
    "get",
    "gets",
    "getting",
    "given",
    "gives",
    "go",
    "goes",
    "going",
    "gone",
    "got",
    "gotten",
    "greetings",
    "h",
    "had",
    "hadn't",
    "happens",
    "hardly",
    "has",
    "hasn't",
    "have",
    "haven't",
    "having",
    "he",
    "he's",
    "hello",
    "help",
    "hence",
    "her",
    "here",
    "here's",
    "hereafter",
    "hereby",
    "herein",
    "hereupon",
    "hers",
    "herself",
    "hi",
    "him",
    "himself",
    "his",
    "hither",
    "hopefully",
    "how",
    "howbeit",
    "however",
    "i",
    "i'd",
    "i'll",
    "i'm",
    "i've",
    "ie",
    "if",
    "ignored",
    "immediate",
    "in",
    "inasmuch",
    "inc",
    "indeed",
    "indicate",
    "indicated",
    "indicates",
    "inner",
    "insofar",
    "instead",
    "into",
    "inward",
    "is",
    "isn't",
    "it",
    "it'd",
    "it'll",
    "it's",
    "its",
    "itself",
    "j",
    "just",
    "k",
    "keep",
    "keeps",
    "kept",
    "know",
    "known",
    "knows",
    "l",
    "last",
    "lately",
    "later",
    "latter",
    "latterly",
    "least",
    "less",
    "lest",
    "let",
    "let's",
    "like",
    "liked",
    "likely",
    "little",
    "look",
    "looking",
    "looks",
    "ltd",
    "m",
    "mainly",
    "many",
    "may",
    "maybe",
    "me",
    "mean",
    "meanwhile",
    "merely",
    "might",
    "more",
    "moreover",
    "most",
    "mostly",
    "much",
    "must",
    "my",
    "myself",
    "n",
    "name",
    "namely",
    "nd",
    "near",
    "nearly",
    "necessary",
    "need",
    "needs",
    "neither",
    "never",
    "nevertheless",
    "new",
    "next",
    "nine",
    "no",
    "nobody",
    "non",
    "none",
    "noone",
    "nor",
    "normally",
    "not",
    "nothing",
    "novel",
    "now",
    "nowhere",
    "o",
    "obviously",
    "of",
    "off",
    "often",
    "oh",
    "ok",
    "okay",
    "old",
    "on",
    "once",
    "one",
    "ones",
    "only",
    "onto",
    "or",
    "other",
    "others",
    "otherwise",
    "ought",
    "our",
    "ours",
    "ourselves",
    "out",
    "outside",
    "over",
    "overall",
    "own",
    "p",
    "particular",
    "particularly",
    "per",
    "perhaps",
    "placed",
    "please",
    "plus",
    "possible",
    "presumably",
    "probably",
    "provides",
    "q",
    "que",
    "quite",
    "qv",
    "r",
    "rather",
    "rd",
    "re",
    "really",
    "reasonably",
    "regarding",
    "regardless",
    "regards",
    "relatively",
    "respectively",
    "right",
    "s",
    "said",
    "same",
    "saw",
    "say",
    "saying",
    "says",
    "second",
    "secondly",
    "see",
    "seeing",
    "seem",
    "seemed",
    "seeming",
    "seems",
    "seen",
    "self",
    "selves",
    "sensible",
    "sent",
    "serious",
    "seriously",
    "seven",
    "several",
    "shall",
    "she",
    "should",
    "shouldn't",
    "since",
    "six",
    "so",
    "some",
    "somebody",
    "somehow",
    "someone",
    "something",
    "sometime",
    "sometimes",
    "somewhat",
    "somewhere",
    "soon",
    "sorry",
    "specified",
    "specify",
    "specifying",
    "still",
    "sub",
    "such",
    "sup",
    "sure",
    "t",
    "t's",
    "take",
    "taken",
    "tell",
    "tends",
    "th",
    "than",
    "thank",
    "thanks",
    "thanx",
    "that",
    "that's",
    "thats",
    "the",
    "their",
    "theirs",
    "them",
    "themselves",
    "then",
    "thence",
    "there",
    "there's",
    "thereafter",
    "thereby",
    "therefore",
    "therein",
    "theres",
    "thereupon",
    "these",
    "they",
    "they'd",
    "they'll",
    "they're",
    "they've",
    "think",
    "third",
    "this",
    "thorough",
    "thoroughly",
    "those",
    "though",
    "three",
    "through",
    "throughout",
    "thru",
    "thus",
    "to",
    "together",
    "too",
    "took",
    "toward",
    "towards",
    "tried",
    "tries",
    "truly",
    "try",
    "trying",
    "twice",
    "two",
    "u",
    "un",
    "under",
    "unfortunately",
    "unless",
    "unlikely",
    "until",
    "unto",
    "up",
    "upon",
    "us",
    "use",
    "used",
    "useful",
    "uses",
    "using",
    "usually",
    "uucp",
    "v",
    "value",
    "various",
    "very",
    "via",
    "viz",
    "vs",
    "w",
    "want",
    "wants",
    "was",
    "wasn't",
    "way",
    "we",
    "we'd",
    "we'll",
    "we're",
    "we've",
    "welcome",
    "well",
    "went",
    "were",
    "weren't",
    "what",
    "what's",
    "whatever",
    "when",
    "whence",
    "whenever",
    "where",
    "where's",
    "whereafter",
    "whereas",
    "whereby",
    "wherein",
    "whereupon",
    "wherever",
    "whether",
    "which",
    "while",
    "whither",
    "who",
    "who's",
    "whoever",
    "whole",
    "whom",
    "whose",
    "why",
    "will",
    "willing",
    "wish",
    "with",
    "within",
    "without",
    "won't",
    "wonder",
    "would",
    "wouldn't",
    "x",
    "y",
    "yes",
    "yet",
    "you",
    "you'd",
    "you'll",
    "you're",
    "you've",
    "your",
    "yours",
    "yourself",
    "yourselves",
    "z",
    "zero",
];

#[cfg(test)]
pub fn queries() -> Vec<String> {
    vec![actors_sql(), galleries_sql()]
}

#[cfg(test)]
mod tests {
    use super::query;

    #[test]
    fn a_query_is_its_words_less_the_stop_words() {
        assert_eq!(
            query("the fog of Paris", false).as_deref(),
            Some("\"fog\" \"Paris\"")
        );
        assert_eq!(query("the", false).as_deref(), Some("\"the\""));
        assert_eq!(query("cha", true).as_deref(), Some("\"cha\"*"));
        assert_eq!(
            query("the fog the", true).as_deref(),
            Some("\"fog\" \"the\"*")
        );
        assert_eq!(
            query("fog \"hi\"", false).as_deref(),
            Some("\"fog\" \"\"\"hi\"\"\"")
        );
        assert_eq!(
            query("alice.test", false).as_deref(),
            Some("\"alice.test\"")
        );
        assert_eq!(query(" . - ", true), None);
        assert_eq!(query("", false), None);
    }
}
