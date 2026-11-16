//! What grain keeps of permissioned spaces: `space_support`, whether each
//! PDS was last found to serve them ([`crate::spaces::support`]). It is
//! not rebuilt from the network.

use super::Index;
use crate::spaces::Support;
use rusqlite::{OptionalExtension, params};

impl Index {
    /// What was last found of `pds`, and how many seconds ago.
    pub fn space_support(&self, pds: &str) -> rusqlite::Result<Option<(Support, i64)>> {
        let db = self.db.lock().unwrap();
        let sql = "SELECT supported, missing, checked_at,
                     unixepoch('now') - unixepoch(checked_at)
                   FROM space_support WHERE pds_endpoint = ?1";
        let row = db.query_row(sql, [pds], |r| {
            let missing: String = r.get(1)?;
            let support = Support {
                supported: r.get(0)?,
                pds: pds.to_string(),
                checked_at: r.get(2)?,
                missing: serde_json::from_str(&missing).unwrap_or_default(),
            };
            // A time that does not read as one is as old as can be.
            let age: Option<i64> = r.get(3)?;
            Ok((support, age.unwrap_or(i64::MAX)))
        });
        row.optional()
    }

    /// Keeps `support` as what was last found of its PDS.
    pub fn keep_space_support(&self, support: &Support) -> rusqlite::Result<()> {
        let db = self.db.lock().unwrap();
        let missing = serde_json::to_string(&support.missing).expect("names serialize");
        db.execute(
            "INSERT INTO space_support (pds_endpoint, supported, missing, checked_at)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT (pds_endpoint) DO UPDATE SET supported = excluded.supported,
               missing = excluded.missing, checked_at = excluded.checked_at",
            params![support.pds, support.supported, missing, support.checked_at],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn support_is_kept_by_pds_and_aged() {
        let index = Index::memory().unwrap();
        assert_eq!(index.space_support("https://pds.test").unwrap(), None);
        let mut support = Support {
            supported: false,
            pds: "https://pds.test".into(),
            checked_at: grain::keys::now_iso(),
            missing: vec!["com.atproto.space.getBlob".into()],
        };
        index.keep_space_support(&support).unwrap();
        let (kept, age) = index.space_support("https://pds.test").unwrap().unwrap();
        assert_eq!(kept, support);
        assert!((0..5).contains(&age), "{age}");
        support.supported = true;
        support.missing.clear();
        support.checked_at = "2026-10-31T00:00:00.000Z".into();
        index.keep_space_support(&support).unwrap();
        let (kept, age) = index.space_support("https://pds.test").unwrap().unwrap();
        assert_eq!(kept, support);
        assert!(age > 3600, "{age}");
        support.checked_at = "a while ago".into();
        index.keep_space_support(&support).unwrap();
        let (_, age) = index.space_support("https://pds.test").unwrap().unwrap();
        assert_eq!(age, i64::MAX);
    }
}
