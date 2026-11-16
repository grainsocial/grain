//! `social.grain.server.getSitemap`: a page of the profiles or galleries a
//! search engine may index, for the web's `/sitemap.xml`.
//!
//! A search engine's index can neither blur nor warn, so a gallery is
//! listed only where nothing would have it so: its author is shown, no
//! label of grain's stands on it or on its author ([`unlabeled`]), its
//! author gave it no self-label, and it has a photo. A profile is listed
//! where it has such a gallery and no label stands on its record: an
//! account with none is a thin page. What the index holds is what the
//! network serves, so nothing in a space is here.
//!
//! A page is [`PAGE`] entries, well under the protocol's 50,000 URLs a
//! file, each a path on the site, named by handle where the account has
//! a valid one, and when it last changed.

use super::moderation::{shown, unlabeled};
use super::views::put;
use super::{Params, Reader};
use crate::xrpc::Failure;
use grain::lexicon;
use rusqlite::params;
use serde_json::{Value, json};

/// The entries a page holds.
pub const PAGE: i64 = 10_000;

/// SQL that holds where the gallery `g` may be indexed.
fn indexable() -> String {
    format!(
        "{} AND {} AND {}
         AND NOT EXISTS (SELECT 1 FROM self_label sl WHERE sl.uri = g.uri)
         AND EXISTS (SELECT 1 FROM gallery_item i WHERE i.gallery = g.uri)",
        shown("g.did"),
        unlabeled("g.uri"),
        unlabeled("g.did"),
    )
}

/// The galleries that may be indexed, the latest first, a page of them
/// from `?2`, and how many they are.
pub fn galleries_sql() -> (String, String) {
    let rows = format!(
        "SELECT g.uri, g.did, r.handle,
                strftime('%Y-%m-%dT%H:%M:%fZ', coalesce(g.updated_at, g.created_at))
         FROM gallery g LEFT JOIN repo r ON r.did = g.did
         WHERE {} ORDER BY g.sort_at DESC, g.uri LIMIT ?1 OFFSET ?2
         -- scans: gallery, as the sitemap lists every gallery, a page at a time, for crawlers",
        indexable()
    );
    let count = format!(
        "SELECT count(*) FROM gallery g WHERE {}\n-- scans: gallery, as the sitemap lists every gallery, a page at a time, for crawlers",
        indexable()
    );
    (rows, count)
}

/// The accounts with a gallery that may be indexed and a profile with no
/// label, by DID, a page of them from `?2`, each with the latest time such
/// a gallery was made or edited, in UTC as a gallery's own is; and how
/// many they are.
pub fn profiles_sql() -> (String, String) {
    let from = format!(
        "FROM gallery g JOIN profile p ON p.did = g.did WHERE {} AND {}\n-- scans: gallery, as the sitemap lists every gallery, a page at a time, for crawlers\n",
        indexable(),
        unlabeled("p.uri")
    );
    let rows = format!(
        "SELECT g.did, (SELECT handle FROM repo WHERE did = g.did),
                max(strftime('%Y-%m-%dT%H:%M:%fZ', coalesce(g.updated_at, g.created_at)))
         {from} GROUP BY g.did ORDER BY g.did LIMIT ?1 OFFSET ?2"
    );
    let count = format!("SELECT count(DISTINCT g.did) {from}");
    (rows, count)
}

/// How an account is named in a path: its handle, where it has a valid
/// one, else its DID.
fn segment<'a>(did: &'a str, handle: Option<&'a str>) -> &'a str {
    handle.filter(|h| lexicon::valid_handle(h)).unwrap_or(did)
}

fn entry(path: String, lastmod: Option<String>) -> Value {
    let mut entry = json!({ "path": path });
    put(&mut entry, "lastmod", lastmod);
    entry
}

/// `social.grain.server.getSitemap`.
pub fn get_sitemap(r: &Reader, p: &Params) -> Result<Value, Failure> {
    let kind = p.required("kind")?;
    let page: i64 = match p.get("page") {
        None => 0,
        Some(n) => n
            .parse()
            .ok()
            .filter(|n| *n >= 0)
            .ok_or_else(|| Failure::invalid("page must be an integer, 0 or more"))?,
    };
    let offset = page.saturating_mul(PAGE);
    type Rows = Vec<(String, String, Option<String>, Option<String>)>;
    let (entries, count) = match kind {
        "galleries" => {
            let (rows, count) = galleries_sql();
            let rows: Rows = r.all(&rows, params![PAGE, offset])?;
            let entries = rows.into_iter().map(|(uri, did, handle, lastmod)| {
                let rkey = uri.rsplit('/').next().unwrap_or_default();
                let actor = segment(&did, handle.as_deref());
                entry(format!("/profile/{actor}/gallery/{rkey}"), lastmod)
            });
            (entries.collect::<Vec<_>>(), count)
        }
        "profiles" => {
            let (rows, count) = profiles_sql();
            let rows: Vec<(String, Option<String>, Option<String>)> =
                r.all(&rows, params![PAGE, offset])?;
            let entries = rows.into_iter().map(|(did, handle, lastmod)| {
                let actor = segment(&did, handle.as_deref());
                entry(format!("/profile/{actor}"), lastmod)
            });
            (entries.collect(), count)
        }
        _ => return Err(Failure::invalid("kind is profiles or galleries")),
    };
    let n: i64 = r.db.query_row(&count, [], |row| row.get(0))?;
    let pages = (n + PAGE - 1) / PAGE;
    Ok(json!({ "entries": entries, "pageCount": pages }))
}

/// The pages' queries, which read by index. Their counts are left out:
/// a sitemap names every gallery, so counting them reads every one.
#[cfg(test)]
pub fn queries() -> Vec<String> {
    vec![galleries_sql().0, profiles_sql().0]
}
