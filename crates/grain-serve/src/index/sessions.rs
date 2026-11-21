//! The web's logins as the index keeps them: the OAuth client's keys
//! (`oauth_key`) and each account's session (`web_session`), which
//! [`crate::login`] reads and writes. Neither is rebuilt from the network.

use super::Index;
use grain::session::Session;
use rusqlite::{OptionalExtension, params};

/// A session kept for the web, and since when its login has held.
#[derive(Debug, Clone, PartialEq)]
pub struct WebSession {
    pub session: Session,
    /// When its login was kept with none before it, in microseconds since
    /// the epoch.
    pub since: u64,
}

impl Index {
    /// The key `kid`, a private JWK as JSON, kept; or, with none kept,
    /// `made`, kept from then on. Whoever asks first keeps theirs.
    pub fn oauth_key(&self, kid: &str, made: impl FnOnce() -> String) -> rusqlite::Result<String> {
        let db = self.db.lock().unwrap();
        let sql = "SELECT jwk FROM oauth_key WHERE kid = ?1";
        if let Some(jwk) = db.query_row(sql, [kid], |r| r.get(0)).optional()? {
            return Ok(jwk);
        }
        let jwk = made();
        db.execute("INSERT INTO oauth_key VALUES (?1, ?2)", [kid, &jwk])?;
        Ok(jwk)
    }

    /// The key of the cookies browsers held before grain-serve's, if the
    /// index holds one ([`crate::login::carryover`]).
    pub fn carried_cookie_key(&self) -> rusqlite::Result<Option<[u8; 32]>> {
        let db = self.db.lock().unwrap();
        let sql = "SELECT key FROM carried_cookie_key LIMIT 1";
        let key: Option<Vec<u8>> = db.query_row(sql, [], |r| r.get(0)).optional()?;
        Ok(key.and_then(|k| k.try_into().ok()))
    }

    /// `time`, an RFC 3339 time, in seconds since the epoch.
    pub fn epoch_secs(&self, time: &str) -> anyhow::Result<u64> {
        anyhow::ensure!(
            atproto::lexicon::is_datetime(time),
            "{time}: not an RFC 3339 time"
        );
        let db = self.db.lock().unwrap();
        let secs: i64 = db.query_row("SELECT unixepoch(?1)", [time], |r| r.get(0))?;
        Ok(secs.max(0) as u64)
    }

    /// The web's session for `did`, if it keeps one. A row that does not
    /// read as a session is none.
    pub fn web_session(&self, did: &str) -> rusqlite::Result<Option<WebSession>> {
        let db = self.db.lock().unwrap();
        let sql = "SELECT session, since FROM web_session WHERE did = ?1";
        let row: Option<(String, i64)> = db
            .query_row(sql, [did], |r| Ok((r.get(0)?, r.get(1)?)))
            .optional()?;
        Ok(row.and_then(|(json, since)| {
            let session = serde_json::from_str(&json).ok()?;
            Some(WebSession {
                session,
                since: since as u64,
            })
        }))
    }

    /// Keeps `session` as the web's for its account, as of `now`, in
    /// microseconds: over the one kept before, if any, whose `since` it
    /// keeps; else since `now`. Returns its `since`.
    pub fn keep_web_session(&self, session: &Session, now: u64) -> rusqlite::Result<u64> {
        let json = serde_json::to_string(session).expect("a session serializes");
        let db = self.db.lock().unwrap();
        db.query_row(
            "INSERT INTO web_session VALUES (?1, ?2, ?3, ?3)
             ON CONFLICT (did) DO UPDATE SET session = excluded.session,
               updated_at = excluded.updated_at
             RETURNING since",
            params![session.did, json, now as i64],
            |r| r.get::<_, i64>(0).map(|since| since as u64),
        )
    }

    /// Keeps `session`, refreshed, over the one kept for its account, as
    /// of `now`, in microseconds; whether there was one to keep it over.
    /// One ended while it was refreshed stays ended.
    pub fn refresh_web_session(&self, session: &Session, now: u64) -> rusqlite::Result<bool> {
        let json = serde_json::to_string(session).expect("a session serializes");
        let db = self.db.lock().unwrap();
        let sql = "UPDATE web_session SET session = ?2, updated_at = ?3 WHERE did = ?1";
        Ok(db.execute(sql, params![session.did, json, now as i64])? > 0)
    }

    /// Forgets the web's session for `did`; whether there was one.
    pub fn end_web_session(&self, did: &str) -> rusqlite::Result<bool> {
        let db = self.db.lock().unwrap();
        let sql = "DELETE FROM web_session WHERE did = ?1";
        Ok(db.execute(sql, [did])? > 0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn session(did: &str, access: &str) -> Session {
        Session {
            did: did.into(),
            handle: "alice.test".into(),
            service: "https://pds.test".into(),
            access_jwt: access.into(),
            refresh_jwt: "refresh".into(),
            oauth: None,
        }
    }

    #[test]
    fn keys_are_made_once() {
        let index = Index::memory().unwrap();
        let first = index.oauth_key("k", || "one".into()).unwrap();
        assert_eq!(first, "one");
        assert_eq!(index.oauth_key("other", || "two".into()).unwrap(), "two");
    }

    #[test]
    fn times_read_as_seconds() {
        let index = Index::memory().unwrap();
        assert_eq!(
            index.epoch_secs("2026-12-01T00:00:00Z").unwrap(),
            1796083200
        );
        assert_eq!(
            index.epoch_secs("2026-12-01T01:00:00+01:00").unwrap(),
            1796083200
        );
        assert!(index.epoch_secs("2026-12-01").is_err());
    }

    #[test]
    fn a_carried_cookie_key_is_32_bytes() {
        let index = Index::memory().unwrap();
        assert_eq!(index.carried_cookie_key().unwrap(), None);
        let db = || index.db.lock().unwrap();
        let short = db().execute("INSERT INTO carried_cookie_key VALUES (x'00')", []);
        assert!(short.is_err());
        db().execute("INSERT INTO carried_cookie_key VALUES (zeroblob(32))", [])
            .unwrap();
        assert_eq!(index.carried_cookie_key().unwrap(), Some([0; 32]));
    }

    #[test]
    fn sessions_keep_when_their_login_was() {
        let index = Index::memory().unwrap();
        assert_eq!(index.web_session("did:plc:a").unwrap(), None);
        assert_eq!(
            index
                .keep_web_session(&session("did:plc:a", "1"), 10)
                .unwrap(),
            10
        );
        // Refreshed, or logged in again over it: since its first login.
        assert_eq!(
            index
                .keep_web_session(&session("did:plc:a", "2"), 20)
                .unwrap(),
            10
        );
        let kept = index.web_session("did:plc:a").unwrap().unwrap();
        assert_eq!((kept.session.access_jwt.as_str(), kept.since), ("2", 10));
        assert!(index.end_web_session("did:plc:a").unwrap());
        assert!(!index.end_web_session("did:plc:a").unwrap());
        assert_eq!(
            index
                .keep_web_session(&session("did:plc:a", "3"), 30)
                .unwrap(),
            30
        );
        // A refresh keeps its since, and ends with a session ended.
        assert!(
            index
                .refresh_web_session(&session("did:plc:a", "4"), 40)
                .unwrap()
        );
        assert_eq!(index.web_session("did:plc:a").unwrap().unwrap().since, 30);
        assert!(
            !index
                .refresh_web_session(&session("did:plc:b", "1"), 40)
                .unwrap()
        );
        assert_eq!(index.web_session("did:plc:b").unwrap(), None);
        // A row that is no session is none.
        index
            .db
            .lock()
            .unwrap()
            .execute(
                "UPDATE web_session SET session = '{' -- scans: web_session, a test's own",
                [],
            )
            .unwrap();
        assert_eq!(index.web_session("did:plc:a").unwrap(), None);
    }
}
