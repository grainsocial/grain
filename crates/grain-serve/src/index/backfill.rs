//! Backfill's side of the index: the queue of accounts waiting to be read,
//! kept in `repo`, and a repo read whole made the index's, what is newer
//! standing ([`super::schema`]'s `record_rev`).

use super::{Index, records};
use rusqlite::{OptionalExtension, params};
use std::collections::HashSet;

/// Where an account stands in backfill's queue.
#[derive(Debug, Clone, PartialEq)]
pub struct Queued {
    /// `pending`, `active`, `failed` or `skipped`.
    pub state: String,
    /// The revision its repo was last read at.
    pub rev: Option<String>,
    pub retry_count: i64,
    /// When it is next tried, in seconds since the epoch.
    pub retry_after: i64,
    pub last_error: Option<String>,
}

impl Index {
    /// Up to `limit` accounts waiting to be read by `now`, in seconds
    /// since the epoch, the longest waiting first: of those whose host
    /// does not say they are gone.
    pub fn pending(&self, now: i64, limit: usize) -> rusqlite::Result<Vec<String>> {
        let db = self.db.lock().unwrap();
        let mut stmt = db.prepare_cached(
            "SELECT did FROM repo WHERE state = 'pending' AND retry_after <= ?1
               AND host_status IS NULL ORDER BY retry_after LIMIT ?2",
        )?;
        let dids = stmt.query_map(params![now, limit as i64], |r| r.get(0))?;
        dids.collect()
    }

    /// Where `did` stands in backfill's queue, if it is tracked.
    pub fn queued(&self, did: &str) -> rusqlite::Result<Option<Queued>> {
        let db = self.db.lock().unwrap();
        let sql =
            "SELECT state, rev, retry_count, retry_after, last_error FROM repo WHERE did = ?1";
        db.query_row(sql, [did], |r| {
            Ok(Queued {
                state: r.get(0)?,
                rev: r.get(1)?,
                retry_count: r.get(2)?,
                retry_after: r.get(3)?,
                last_error: r.get(4)?,
            })
        })
        .optional()
    }

    /// Queues `did` to be read again now, tracking it if it was not.
    pub fn resync(&self, did: &str) -> rusqlite::Result<()> {
        let db = self.db.lock().unwrap();
        db.execute(
            "INSERT INTO repo (did) VALUES (?1) ON CONFLICT (did) DO UPDATE SET
               state = 'pending', retry_count = 0, retry_after = 0, last_error = NULL",
            [did],
        )?;
        self.tracked.lock().unwrap().insert(did.to_string());
        Ok(())
    }

    /// A read of `did` that failed, for `error`: tried again at
    /// `retry_after`, or given up on (`failed`) when that is none.
    pub fn backfill_failed(
        &self,
        did: &str,
        error: &str,
        retry_after: Option<i64>,
    ) -> rusqlite::Result<()> {
        let db = self.db.lock().unwrap();
        db.execute(
            "UPDATE repo SET retry_count = retry_count + 1, last_error = ?2,
               state = CASE WHEN ?3 IS NULL THEN 'failed' ELSE state END,
               retry_after = coalesce(?3, retry_after)
             WHERE did = ?1",
            params![did, error, retry_after],
        )?;
        Ok(())
    }

    /// `did` left unread, for `why`: its host is one backfill skips.
    pub fn backfill_skipped(&self, did: &str, why: &str) -> rusqlite::Result<()> {
        let db = self.db.lock().unwrap();
        let sql = "UPDATE repo SET state = 'skipped', last_error = ?2 WHERE did = ?1";
        db.execute(sql, [did, why])?;
        Ok(())
    }

    /// `did`'s repo, read whole at `rev`, holds `present`: the URIs of its
    /// records of the collections the index keeps, each put already with
    /// [`Index::put_rev`]. What the index has of `did` that it does not, and
    /// had from before `rev`, was deleted since, and is deleted here; the
    /// deletions `rev` covers are forgotten; and the account is backfilled.
    /// How many records were deleted.
    pub fn backfilled(
        &self,
        did: &str,
        rev: &str,
        present: &HashSet<String>,
    ) -> rusqlite::Result<usize> {
        let mut db = self.db.lock().unwrap();
        let tx = db.transaction()?;
        let mut gone = Vec::new();
        for (_, table) in records::COLLECTIONS {
            let sql = format!(
                "SELECT t.uri FROM {table} t LEFT JOIN record_rev r ON r.uri = t.uri
                 WHERE t.did = ?1 AND (r.rev IS NULL OR r.rev < ?2)"
            );
            let mut stmt = tx.prepare_cached(&sql)?;
            let uris = stmt.query_map(params![did, rev], |r| r.get::<_, String>(0))?;
            for uri in uris {
                let uri = uri?;
                if !present.contains(&uri) {
                    gone.push((table, uri));
                }
            }
        }
        for (table, uri) in &gone {
            tx.execute(&format!("DELETE FROM {table} WHERE uri = ?1"), [uri])?;
            tx.execute("DELETE FROM self_label WHERE uri = ?1", [uri])?;
            tx.execute("DELETE FROM record_rev WHERE uri = ?1", [uri])?;
        }
        let (from, to) = (format!("at://{did}/"), format!("at://{did}0"));
        tx.execute(
            "DELETE FROM record_rev WHERE uri >= ?1 AND uri < ?2 AND gone = 1 AND rev <= ?3",
            [&from, &to, rev],
        )?;
        tx.execute(
            "UPDATE repo SET state = 'active', rev = max(coalesce(rev, ''), ?2),
               backfilled_at = ?3, retry_count = 0, retry_after = 0, last_error = NULL
             WHERE did = ?1",
            [did, rev, &grain::keys::now_iso()],
        )?;
        tx.commit()?;
        Ok(gone.len())
    }

    /// Forgets the deletions from before the revision `rev`, which no repo
    /// read now is as old as; how many.
    pub fn forget_deletions(&self, rev: &str) -> rusqlite::Result<usize> {
        let db = self.db.lock().unwrap();
        db.execute("DELETE FROM record_rev WHERE gone = 1 AND rev < ?1", [rev])
    }
}
