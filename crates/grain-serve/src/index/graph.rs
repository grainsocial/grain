//! The accounts each account muted (`mute`): private to it, kept here and
//! nowhere else, so nothing on the network rebuilds them.

use super::Index;

impl Index {
    /// Mutes `subject` for `did`, at `at`; whether it was not muted already.
    pub fn mute(&self, did: &str, subject: &str, at: &str) -> rusqlite::Result<bool> {
        let db = self.db.lock().unwrap();
        let sql = "INSERT OR IGNORE INTO mute (did, subject, created_at) VALUES (?1, ?2, ?3)";
        Ok(db.execute(sql, [did, subject, at])? > 0)
    }

    /// Unmutes `subject` for `did`; whether it was muted.
    pub fn unmute(&self, did: &str, subject: &str) -> rusqlite::Result<bool> {
        let db = self.db.lock().unwrap();
        let sql = "DELETE FROM mute WHERE did = ?1 AND subject = ?2";
        Ok(db.execute(sql, [did, subject])? > 0)
    }
}

#[cfg(test)]
mod tests {
    use crate::index::Index;

    #[test]
    fn a_mute_is_kept_once_and_taken_back() {
        let index = Index::memory().unwrap();
        let at = "2026-10-31T12:00:00.000Z";
        assert!(index.mute("did:plc:a", "did:plc:b", at).unwrap());
        assert!(!index.mute("did:plc:a", "did:plc:b", at).unwrap());
        assert!(index.unmute("did:plc:a", "did:plc:b").unwrap());
        assert!(!index.unmute("did:plc:a", "did:plc:b").unwrap());
    }
}
