//! grain's classifiers: what each asks Clef, of which subjects, from what
//! state, and where its scores file a report.
//!
//! The questions, thresholds and labels are those tuned on grain's own
//! moderated data with `clef`; rewording a question changes what a score
//! means, and scores every subject again ([`Classifier::version`]).

use super::clef::Signal;
use rusqlite::{Connection, OptionalExtension};
use serde_json::{Value, json};

/// What a classifier scores.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    /// An account, by its DID, once it has written and settled.
    Account,
    /// A record of one of these collections, as it arrives.
    Record(&'static [&'static str]),
}

/// The thing scored: an account, its `uri` its bare DID, or a record.
#[derive(Debug, Clone, PartialEq)]
pub struct Subject {
    pub uri: String,
    pub did: String,
    pub handle: Option<String>,
}

/// Score at or above which a signal files a report.
#[derive(Debug, Clone, Copy)]
pub enum Threshold {
    /// One for every question.
    All(f64),
    /// One a question; a question not named never files.
    Each(&'static [(&'static str, f64)]),
}

/// A classifier.
#[derive(Clone, Copy)]
pub struct Classifier {
    pub name: &'static str,
    pub kind: Kind,
    /// The questions, in the shape Clef takes.
    pub questions: fn() -> Value,
    pub threshold: Threshold,
    /// The label a report it files asks for, from the signal that crossed.
    pub label: fn(&str) -> &'static str,
    /// The state the model is shown, or none to skip the subject: one a
    /// question cannot be answered of costs nothing.
    pub state: fn(&Connection, &Subject) -> rusqlite::Result<Option<Value>>,
    /// The blobs, `(did, cid)`, whose images the model is shown beside
    /// the state, at most four. The state carries their CIDs, so that a
    /// changed image is scored again.
    pub images: fn(&Value) -> Vec<(String, String)>,
}

impl Classifier {
    /// The threshold `signal` crosses at, if any.
    pub fn threshold(&self, signal: &str) -> Option<f64> {
        match self.threshold {
            Threshold::All(t) => Some(t),
            Threshold::Each(each) => each.iter().find(|(s, _)| *s == signal).map(|(_, t)| *t),
        }
    }

    /// What it asks, as a fingerprint covers it: a reworded question, or
    /// another set of images, is a new version.
    pub fn version(&self) -> String {
        format!("{}:{}", self.name, (self.questions)())
    }

    /// Whether it scores records of `collection`.
    pub fn covers(&self, collection: &str) -> bool {
        matches!(self.kind, Kind::Record(of) if of.contains(&collection))
    }
}

fn no_images(_: &Value) -> Vec<(String, String)> {
    vec![]
}

/// The classifiers, each by its name.
pub static ALL: &[Classifier] = &[
    Classifier {
        name: "gallery-spam",
        kind: Kind::Record(&["social.grain.gallery"]),
        questions: gallery_spam_questions,
        threshold: Threshold::All(0.6),
        label: |_| "spam",
        state: gallery_spam_state,
        images: no_images,
    },
    Classifier {
        name: "impersonation",
        kind: Kind::Account,
        questions: impersonation_questions,
        // Only the stronger claim files: `identity_use` is kept for every
        // account, but a fan account that says so is not on its own against
        // the guidelines as written.
        threshold: Threshold::Each(&[("passing_as", 0.7)]),
        label: |_| "impersonation",
        state: impersonation_state,
        images: no_images,
    },
    Classifier {
        name: "nsfw",
        kind: Kind::Record(&["social.grain.photo"]),
        questions: nsfw_questions,
        // Every admin decision on prod matched, and nothing in 446 random
        // photos reached 0.5 on either; that rests on a handful of real
        // positives, so these are a starting point.
        threshold: Threshold::Each(&[("nudity", 0.5), ("sexual", 0.5)]),
        label: |signal| {
            if signal == "sexual" {
                "sexual"
            } else {
                "nudity"
            }
        },
        state: nsfw_state,
        images: nsfw_images,
    },
    Classifier {
        name: "scam",
        kind: Kind::Account,
        questions: scam_questions,
        // Clef puts an empty-bio account at 0.55 to 0.6 on `romance_persona`,
        // grain's own among them; the personas behind real takedowns scored
        // 0.69 and up.
        threshold: Threshold::Each(&[("romance_persona", 0.65), ("financial_scam", 0.5)]),
        label: |signal| {
            if signal == "financial_scam" {
                "spam"
            } else {
                "other"
            }
        },
        state: scam_state,
        images: no_images,
    },
    Classifier {
        name: "spam",
        kind: Kind::Account,
        questions: spam_questions,
        threshold: Threshold::All(0.5),
        label: |_| "spam",
        state: spam_state,
        images: no_images,
    },
];

/// The galleries an account with fewer than this has posted say too
/// little for `spam` to judge: traffic spam is a volume pattern, and one
/// spam gallery is `gallery-spam`'s to catch.
const MIN_GALLERIES: i64 = 5;

fn count(db: &Connection, sql: &str, did: &str) -> rusqlite::Result<i64> {
    db.query_row(sql, [did], |r| r.get(0))
}

/// `did`'s profile's display name and description, each if not empty.
fn profile(db: &Connection, did: &str) -> rusqlite::Result<(Option<String>, Option<String>)> {
    let sql = "SELECT display_name, description FROM profile WHERE did = ?1 LIMIT 1";
    let found = db.query_row(sql, [did], |r| Ok((r.get(0)?, r.get(1)?)));
    let (name, bio): (Option<String>, Option<String>) = found.optional()?.unwrap_or_default();
    let some = |s: Option<String>| s.filter(|s| !s.is_empty());
    Ok((some(name), some(bio)))
}

/// Up to `limit` of `did`'s galleries, the first made first, each as its
/// title and description.
fn galleries(db: &Connection, did: &str, limit: i64) -> rusqlite::Result<Vec<Value>> {
    let sql = "SELECT title, description FROM gallery WHERE did = ?1
               ORDER BY created_at, uri LIMIT ?2";
    let mut stmt = db.prepare_cached(sql)?;
    let rows = stmt.query_map(rusqlite::params![did, limit], |r| {
        let (title, description): (String, Option<String>) = (r.get(0)?, r.get(1)?);
        let description = description.filter(|d| !d.is_empty());
        Ok(json!({ "title": title, "description": description }))
    })?;
    rows.collect()
}

fn gallery_spam_questions() -> Value {
    json!({
        "promotional_listing": {
            "type": "noul",
            "instructions": "Is this gallery the poster advertising something they profit from, rather than sharing photographs? Every gallery on grain carries photographs; judge what the text is for.",
            "criteria": {
                "true": "Sells or promotes something to the reader on the poster's behalf — a crypto platform, an ebook, a paid service, an affiliate link, a discount, a company's marketing. Use the poster's other galleries: many near-identical listings make it one.",
                "false": "Photographs shared as photographs, whatever they show. Mentioning, joking about, photographing or reviewing a product, an ad, a shop or an event is NOT a promotional listing, and neither is sharing a link to an article, a talk or one's own blog, or selling a single personal item. A photographer naming their own shop, print store, portfolio, or Ko-fi alongside their work is NOT a promotional listing — the photographs are still the point. A poster whose other galleries are varied, personal posts is sharing, not listing."
            }
        },
        "article_not_caption": {
            "type": "noul",
            "instructions": "Is the gallery's text an article or blog post that happens to carry an image, rather than a caption describing the photographs?",
            "criteria": {
                "true": "Reads as written-for-search prose with an explanatory headline and body paragraphs — the kind of content-farm article that exists to rank, not to accompany a picture.",
                "false": "A caption, a title, a place name, a date, a note about the shot or the trip, or nothing at all. Length alone does not make a caption an article: a long, personal story about the photographs is still a caption."
            }
        }
    })
}

/// A gallery's text, and the poster's others: one gallery alone cannot
/// show the pattern that tells a listing from a post. A gallery with
/// almost no text has nothing to judge; the cut is low, as a short title
/// can still be spam.
fn gallery_spam_state(db: &Connection, s: &Subject) -> rusqlite::Result<Option<Value>> {
    let sql = "SELECT title, description FROM gallery WHERE uri = ?1";
    let found = db.query_row(sql, [&s.uri], |r| Ok((r.get(0)?, r.get(1)?)));
    let Some((title, description)) = found.optional()? else {
        return Ok(None);
    };
    let (title, description): (String, Option<String>) = (title, description);
    let title = title.trim().to_string();
    let description = description.unwrap_or_default().trim().to_string();
    if title.encode_utf16().count() + description.encode_utf16().count() < 8 {
        return Ok(None);
    }
    let count = count(db, "SELECT count(*) FROM gallery WHERE did = ?1", &s.did)?;
    let sql = "SELECT title, description FROM gallery WHERE did = ?1 AND uri <> ?2
               ORDER BY created_at DESC, uri LIMIT 6";
    let mut stmt = db.prepare_cached(sql)?;
    let others = stmt.query_map([&s.did, &s.uri], |r| {
        let (title, description): (String, Option<String>) = (r.get(0)?, r.get(1)?);
        let parts: Vec<String> = [Some(title), description]
            .into_iter()
            .flatten()
            .filter(|p| !p.is_empty())
            .collect();
        Ok(parts.join(" — ").chars().take(120).collect::<String>())
    })?;
    let others = others.collect::<rusqlite::Result<Vec<String>>>()?;
    let some = |s: String| (!s.is_empty()).then_some(s);
    Ok(Some(json!({
        "title": some(title),
        "description": some(description),
        "poster": { "galleries": count, "otherGalleries": others },
    })))
}

fn impersonation_questions() -> Value {
    json!({
        "identity_use": {
            "type": "noul",
            "instructions": "Does this account trade on the identity of a specific famous real person, company, or brand — whether or not it admits to being a parody or fan account?",
            "criteria": {
                "true": "The handle, display name, or bio is built around a famous person's or brand's name and draws on their identity for attention. Parody, fan and tribute accounts COUNT as true here.",
                "false": "An ordinary account. A name that merely coincides with, or puns on, a famous one without drawing on that identity is false."
            }
        },
        "passing_as": {
            "type": "noul",
            "instructions": "Does this account claim to BE a specific famous person, company, or brand that it is not — using that famous name as its own identity and writing as though it were them?",
            "criteria": {
                "true": "Adopts a well-known person's or brand's name and speaks as them, asserting their fame, company, or achievements as its own.",
                "false": "An ordinary person describing their own real life and work — INCLUDING their genuine job title, their own company, and their own accomplishments, however senior. Someone who founded a company nobody has heard of is not impersonating anyone. Also false for an openly labelled fan, parody, or commentary account."
            }
        }
    })
}

/// The handle and profile alone, with no gate on what the account
/// posted: an impersonator typically posts nothing.
fn impersonation_state(db: &Connection, s: &Subject) -> rusqlite::Result<Option<Value>> {
    let (name, bio) = profile(db, &s.did)?;
    Ok(Some(
        json!({ "handle": s.handle, "displayName": name, "bio": bio }),
    ))
}

fn nsfw_questions() -> Value {
    json!({
        "nudity": {
            "type": "noul",
            "instructions": "Is a real person in this photograph nude or nearly nude?",
            "criteria": {
                "true": "A person is unclothed or close to it: genitals, female nipples or bare buttocks are visible, OR the person is naked with only a hand, an object, the pose or the crop hiding them, OR sheer clothing shows the body beneath. Artistic, documentary and boudoir photographs all count.",
                "false": "Everyone is dressed, including in swimwear, sportswear, lingerie that fully covers, or costume. A shirtless man at the beach, in sport or at work is false. Drawings, paintings, sketches and sculptures are false: the question is about photographs of real people."
            }
        },
        "sexual": {
            "type": "noul",
            "instructions": "Does this image depict sexual activity or explicitly sexual posing?"
        }
    })
}

/// The photo, by its CID, which is what scores a changed photo again.
fn nsfw_state(db: &Connection, s: &Subject) -> rusqlite::Result<Option<Value>> {
    let sql = "SELECT json_extract(photo, '$.ref.\"$link\"') FROM photo WHERE uri = ?1";
    let cid: Option<Option<String>> = db.query_row(sql, [&s.uri], |r| r.get(0)).optional()?;
    Ok(cid.flatten().map(|cid| json!({ "did": s.did, "cid": cid })))
}

fn nsfw_images(state: &Value) -> Vec<(String, String)> {
    let (did, cid) = (state["did"].as_str(), state["cid"].as_str());
    did.zip(cid)
        .map(|(d, c)| (d.to_string(), c.to_string()))
        .into_iter()
        .collect()
}

fn scam_questions() -> Value {
    json!({
        "romance_persona": {
            "type": "noul",
            "instructions": "Is this profile a fabricated persona of the kind used to run romance or confidence scams?",
            "criteria": {
                "true": "An idealised stranger persona — stated profession and age, emotive bio about love, loneliness or connection, follow-bait — with little real photographic content behind it.",
                "false": "A real person's profile, whatever its tone."
            }
        },
        "financial_scam": {
            "type": "noul",
            "instructions": "Does this account advertise money, winnings, giveaways, crypto, or investment returns in a way characteristic of advance-fee or giveaway scams?",
            "criteria": {
                "true": "Claims of lottery/prize winnings, offers to share money, or promises of guaranteed or fast investment/crypto returns aimed at strangers.",
                "false": "No such offer. Mentioning one's job in finance, or a tip jar, donation link, or Ko-fi for one's own creative work, is not a scam."
            }
        }
    })
}

/// The profile, where scam personas live, and a few galleries: the gate
/// is a profile or anything posted, as these accounts often carry a
/// filled-in profile and a single post.
fn scam_state(db: &Connection, s: &Subject) -> rusqlite::Result<Option<Value>> {
    let (name, bio) = profile(db, &s.did)?;
    let posted = galleries(db, &s.did, 6)?;
    if name.is_none() && bio.is_none() && posted.is_empty() {
        return Ok(None);
    }
    Ok(Some(json!({
        "handle": s.handle, "displayName": name, "bio": bio, "galleries": posted,
    })))
}

fn spam_questions() -> Value {
    json!({
        "traffic_spam": {
            "type": "noul",
            "instructions": "Does this account exist only to drive traffic elsewhere, with no genuine content of its own?",
            "criteria": {
                "true": "The galleries are bare links, repeated identical promotional listings, or keyword-stuffed adverts. Strip the outbound links and nothing of substance remains. Every gallery holds photographs the account uploaded, so judge the gallery text, not the bio: a link in the bio says nothing on its own.",
                "false": "A real photographer, artist, developer, musician or writer sharing their own work, EVEN IF the bio or galleries link to a portfolio, shop, blog, Ko-fi, newsletter, or product they made. A link is not spam. Short, plain or default titles such as 'Untitled photo' are ordinary photo posts, not missing content."
            }
        },
        "undisclosed_automation": {
            "type": "noul",
            "instructions": "Is this account running undisclosed bulk automation? Grain's guidelines prohibit ABUSING automation, not using it — an openly declared bot is permitted.",
            "criteria": {
                "true": "Templated, machine-generated posting at volume with NO disclosure that the account is automated, and no human curation behind it.",
                "false": "Either not automated, OR automated and openly says so (e.g. 'bot', 'robot account', 'automated', names the human who runs it). A person who simply uploads a lot of photos is not automation."
            }
        }
    })
}

/// What an account posted: a sample of its galleries and the true counts,
/// themselves a signal, as nine thousand templated titles say more than
/// any eight of them do.
fn spam_state(db: &Connection, s: &Subject) -> rusqlite::Result<Option<Value>> {
    let posted = count(db, "SELECT count(*) FROM gallery WHERE did = ?1", &s.did)?;
    if posted < MIN_GALLERIES {
        return Ok(None);
    }
    let photos = count(db, "SELECT count(*) FROM photo WHERE did = ?1", &s.did)?;
    let stories = count(db, "SELECT count(*) FROM story WHERE did = ?1", &s.did)?;
    let (_, bio) = profile(db, &s.did)?;
    Ok(Some(json!({
        "handle": s.handle,
        "bio": bio,
        "counts": { "galleries": posted, "photos": photos, "stories": stories },
        "gallerySample": galleries(db, &s.did, 8)?,
    })))
}

/// The collections a bridged account's records are hidden in.
pub const BRIDGED_HIDDEN: [&str; 3] = [
    "social.grain.gallery",
    "social.grain.story",
    "social.grain.comment",
];

/// Whether `did` was bridged in by Bridgy Fed, which writes the image
/// posts of fediverse accounts and websites as grain galleries without
/// anyone choosing to post on grain: by a handle it issued
/// (`*.ap.brid.gy`, `*.web.brid.gy`), or else by the footer it puts on
/// every bridged profile, for one that set a domain handle of its own.
pub fn bridged(db: &Connection, did: &str) -> rusqlite::Result<bool> {
    let sql = "SELECT handle FROM repo WHERE did = ?1";
    let handle: Option<Option<String>> = db.query_row(sql, [did], |r| r.get(0)).optional()?;
    if handle
        .flatten()
        .is_some_and(|h| h.to_lowercase().ends_with(".brid.gy"))
    {
        return Ok(true);
    }
    let (_, bio) = profile(db, did)?;
    let bio = bio.unwrap_or_default();
    Ok(bio.contains("🌉 bridged from")
        && (bio.contains("follow @ap.brid.gy to interact") || bio.contains("https://fed.brid.gy/")))
}

/// Whether `doc`, a DID document, names Bridgy Fed's PDS, which hosts
/// every account it bridges in.
pub fn bridged_host(doc: &Value) -> bool {
    let pds = atproto::did::pds(doc).unwrap_or_default();
    let host = pds.split("://").nth(1).unwrap_or_default();
    let host = host.split(['/', ':']).next().unwrap_or_default();
    host == "brid.gy" || host.ends_with(".brid.gy")
}

/// The top signal of `signals`, by score: none where none scored above 0.
pub fn top(signals: &[(String, Signal)]) -> (Option<&str>, f64) {
    let mut top = (None, 0.0);
    for (name, signal) in signals {
        if signal.score > top.1 {
            top = (Some(name.as_str()), signal.score);
        }
    }
    top
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn thresholds_are_per_question_or_for_all() {
        let by_name = |n: &str| ALL.iter().find(|c| c.name == n).unwrap();
        assert_eq!(by_name("impersonation").threshold("passing_as"), Some(0.7));
        assert_eq!(by_name("impersonation").threshold("identity_use"), None);
        assert_eq!(by_name("spam").threshold("traffic_spam"), Some(0.5));
        assert_eq!((by_name("scam").label)("financial_scam"), "spam");
        assert_eq!((by_name("scam").label)("romance_persona"), "other");
        assert_eq!((by_name("nsfw").label)("sexual"), "sexual");
        assert_eq!((by_name("nsfw").label)("nudity"), "nudity");
        assert_eq!((by_name("gallery-spam").label)("x"), "spam");
        assert_eq!((by_name("impersonation").label)("x"), "impersonation");
        assert_eq!((by_name("spam").label)("x"), "spam");
        assert!(by_name("nsfw").covers("social.grain.photo"));
        assert!(!by_name("spam").covers("social.grain.photo"));
        assert_ne!(by_name("spam").version(), by_name("scam").version());
        assert!(nsfw_images(&json!({})).is_empty());
    }

    #[test]
    fn the_top_signal_scores_highest() {
        let signals = vec![
            ("a".to_string(), Signal::local(0.2)),
            ("b".to_string(), Signal::local(0.9)),
        ];
        assert_eq!(top(&signals), (Some("b"), 0.9));
        assert_eq!(top(&[("a".to_string(), Signal::local(0.0))]), (None, 0.0));
    }

    #[test]
    fn bridgy_feds_pds_hosts_bridged_accounts() {
        let doc = |pds: &str| json!({"service": [{"id": "#atproto_pds", "type": "AtprotoPersonalDataServer", "serviceEndpoint": pds}]});
        assert!(bridged_host(&doc("https://atproto.brid.gy")));
        assert!(bridged_host(&doc("https://atproto.brid.gy:443/")));
        assert!(bridged_host(&doc("https://brid.gy")));
        assert!(!bridged_host(&doc("https://notbrid.gy")));
        assert!(!bridged_host(&doc("https://brid.gy.example.com")));
        assert!(!bridged_host(&doc("https://bsky.social")));
        assert!(!bridged_host(&json!({})));
    }
}
