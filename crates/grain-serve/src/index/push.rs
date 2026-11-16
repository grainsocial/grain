//! The devices each account's pushes go to (`push_token`), as
//! `registerPush` and `unregisterPush` keep them ([`crate::push`]): a
//! token and the platform whose service delivers to it, a row each of an
//! account's devices. Nothing rebuilds them from the network.
//!
//! The paths that put what accounts write as they write it (the stream,
//! `indexRecords` and the web's writes) say which records were new to the
//! index ([`Index::arrived`]), for the sender ([`crate::push::send`]) to
//! push. Backfill and the import do not: what they put is old news.

use super::Index;
use rusqlite::params;
use tokio::sync::mpsc::{Sender, error::TrySendError};

/// A device an account's pushes go to.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PushToken {
    /// What the platform's service names the device by.
    pub token: String,
    /// `ios`, `android` or `web`.
    pub platform: String,
}

const TOKENS_SQL: &str = "SELECT token, platform FROM push_token WHERE did = ?1 ORDER BY token";
const DROP_SQL: &str = "DELETE FROM push_token WHERE token = ?1";

impl Index {
    /// Has the records [`Index::arrived`] names sent to `to`, from then
    /// on; whether none was named before.
    pub fn push_to(&self, to: Sender<String>) -> bool {
        self.arrivals.set(to).is_ok()
    }

    /// Says that a live path put the record at `uri`, which the index did
    /// not hold, for it to be pushed, and scored by the classifiers
    /// ([`Index::to_classify`]). Where the sender is behind by
    /// [`crate::push::send::QUEUED`] records, it is not pushed.
    pub fn arrived(&self, uri: &str) {
        self.to_classify(uri);
        let Some(to) = self.arrivals.get() else {
            return;
        };
        match to.try_send(uri.to_string()) {
            Ok(()) => {}
            Err(TrySendError::Full(_)) => tracing::warn!(%uri, "push: behind, not pushed"),
            Err(TrySendError::Closed(_)) => tracing::warn!(%uri, "push: stopped, not pushed"),
        }
    }

    /// Keeps `token`, a device on `platform`, as one of `did`'s, made at
    /// `now`. One it keeps already is kept on `platform` from then on, as
    /// made when it was first.
    pub fn register_push(
        &self,
        did: &str,
        token: &str,
        platform: &str,
        now: &str,
    ) -> rusqlite::Result<()> {
        let db = self.db.lock().unwrap();
        db.execute(
            "INSERT INTO push_token (did, token, platform, created_at) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT (did, token) DO UPDATE SET platform = excluded.platform",
            params![did, token, platform, now],
        )?;
        Ok(())
    }

    /// Stops `did`'s pushes going to `token`; whether they went there.
    pub fn unregister_push(&self, did: &str, token: &str) -> rusqlite::Result<bool> {
        let db = self.db.lock().unwrap();
        let sql = "DELETE FROM push_token WHERE did = ?1 AND token = ?2";
        Ok(db.execute(sql, [did, token])? > 0)
    }

    /// The devices `did`'s pushes go to.
    pub fn push_tokens(&self, did: &str) -> rusqlite::Result<Vec<PushToken>> {
        let db = self.db.lock().unwrap();
        let mut stmt = db.prepare_cached(TOKENS_SQL)?;
        let tokens = stmt.query_map([did], |r| {
            Ok(PushToken {
                token: r.get(0)?,
                platform: r.get(1)?,
            })
        })?;
        tokens.collect()
    }

    /// Forgets `token` for every account it was kept for, as when its
    /// platform's service says no device answers to it any more; for how
    /// many.
    pub fn drop_push_token(&self, token: &str) -> rusqlite::Result<usize> {
        let db = self.db.lock().unwrap();
        db.execute(DROP_SQL, [token])
    }
}

#[cfg(test)]
mod tests {
    use super::super::plan::{scans, sized};
    use super::*;

    fn token(token: &str, platform: &str) -> PushToken {
        PushToken {
            token: token.into(),
            platform: platform.into(),
        }
    }

    #[test]
    fn devices_are_kept_for_their_accounts() {
        let index = Index::memory().unwrap();
        let (a, b) = ("did:plc:a", "did:plc:b");
        assert_eq!(index.push_tokens(a).unwrap(), []);
        index.register_push(a, "t1", "ios", "2026-01-01").unwrap();
        index
            .register_push(a, "t2", "android", "2026-01-02")
            .unwrap();
        index.register_push(b, "t1", "ios", "2026-01-03").unwrap();
        // Registered again, it keeps when it was first.
        index.register_push(a, "t1", "web", "2026-01-04").unwrap();
        let tokens = index.push_tokens(a).unwrap();
        assert_eq!(tokens, [token("t1", "web"), token("t2", "android")]);
        let made: String = index.read(|db| {
            let sql = "SELECT created_at FROM push_token WHERE did = ?1 AND token = 't1'";
            db.query_row(sql, [a], |r| r.get(0)).unwrap()
        });
        assert_eq!(made, "2026-01-01");

        // One account's unregistering leaves another's alone.
        assert!(index.unregister_push(a, "t1").unwrap());
        assert!(!index.unregister_push(a, "t1").unwrap());
        assert_eq!(index.push_tokens(a).unwrap(), [token("t2", "android")]);
        assert_eq!(index.push_tokens(b).unwrap(), [token("t1", "ios")]);

        // A token no device answers to is dropped for every account.
        index.register_push(a, "t1", "ios", "2026-01-05").unwrap();
        assert_eq!(index.drop_push_token("t1").unwrap(), 2);
        assert_eq!(index.drop_push_token("t1").unwrap(), 0);
        assert_eq!(index.push_tokens(b).unwrap(), []);
    }

    #[test]
    fn devices_are_found_by_index() {
        let index = Index::memory().unwrap();
        index.read(|db| {
            sized(db);
            for sql in [TOKENS_SQL, DROP_SQL] {
                assert_eq!(scans(db, sql), Vec::<String>::new(), "{sql}");
            }
        });
    }
}
