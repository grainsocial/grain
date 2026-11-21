//! Which stories each account watched (`story_view`): private to it, kept
//! here and nowhere else, so nothing on the network rebuilds them. A view
//! matters only while its story stands, a day, so one is kept a week.

use super::Index;
use rusqlite::params;

/// How long a view is kept, in microseconds: a week.
pub const VIEW_KEPT_MICROS: u64 = 7 * 24 * 60 * 60 * 1_000_000;

impl Index {
    /// Keeps that `did` watched each of `uris` the index holds as a story,
    /// at `at`, and lets go of views older than a week before it; how many
    /// views are new.
    pub fn mark_viewed(&self, did: &str, uris: &[&str], at: &str) -> rusqlite::Result<usize> {
        let mut db = self.db.lock().unwrap();
        let tx = db.transaction()?;
        let uris = serde_json::to_string(uris).expect("strings are JSON");
        let marked = tx.execute(
            "INSERT OR IGNORE INTO story_view (did, subject, created_at)
             SELECT ?1, s.uri, ?3 FROM story s WHERE s.uri IN (SELECT value FROM json_each(?2))",
            params![did, uris, at],
        )?;
        let before = grain::keys::iso(grain::keys::now_micros().saturating_sub(VIEW_KEPT_MICROS));
        tx.execute("DELETE FROM story_view WHERE created_at < ?1", [before])?;
        tx.commit()?;
        Ok(marked)
    }
}

#[cfg(test)]
mod tests {
    use crate::index::Index;
    use serde_json::json;

    #[test]
    fn a_view_is_kept_of_a_story_held_and_for_a_week() {
        let index = Index::memory().unwrap();
        let story = "at://did:plc:a/social.grain.story/3l3";
        let record = json!({"$type": "social.grain.story", "aspectRatio": {"width": 9, "height": 16},
            "media": {"$type": "blob", "ref": {"$link": "bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy"}, "mimeType": "image/jpeg", "size": 1},
            "createdAt": "2026-10-31T12:00:00.000Z"});
        let cid = atproto::Cid::of_cbor(b"story").to_string();
        index.put(story, &cid, &record).unwrap();
        let gone = "at://did:plc:a/social.grain.story/3l4";
        let now = grain::keys::now_iso();
        assert_eq!(
            index
                .mark_viewed("did:plc:b", &[story, gone], &now)
                .unwrap(),
            1
        );
        assert_eq!(index.mark_viewed("did:plc:b", &[story], &now).unwrap(), 0);
        // One a month old is let go of when the next is kept.
        index
            .read(|db| {
                db.execute(
                    "UPDATE story_view SET created_at = '2026-01-01T00:00:00.000Z' -- scans: story_view, a test's own",
                    [],
                )
            })
            .unwrap();
        index.mark_viewed("did:plc:c", &[gone], &now).unwrap();
        let left: i64 = index
            .read(|db| {
                db.query_row(
                    "SELECT count(*) FROM story_view -- scans: story_view, a test's own",
                    [],
                    |r| r.get(0),
                )
            })
            .unwrap();
        assert_eq!(left, 0);
    }
}
