//! What the classifiers ([`crate::classify`]) read and keep in the index.
//!
//! The paths that put what accounts write as they write it (the stream,
//! `indexRecords` and the web's writes) say which records were new to
//! the index ([`Index::arrived`]), for the classifiers to score. Backfill
//! and the import do not: what they put is not new.
//!
//! `classification` keeps each subject's last scores, by classifier, and
//! the fingerprint of what was asked, so that what has not changed is not
//! asked again. It is made from the records, by asking again.

use super::Index;
use crate::classify::clef::Signal;
use crate::index::schema::shown;
use rusqlite::{OptionalExtension, params};
use serde_json::Value;
use tokio::sync::mpsc::{Sender, error::TrySendError};

/// A subject's scores, as `classification` keeps them.
#[derive(Debug, Clone, PartialEq)]
pub struct Classification {
    /// An account's bare DID, or a record's AT-URI.
    pub subject: String,
    pub subject_did: String,
    pub classifier: String,
    pub signals: Vec<(String, Signal)>,
    pub state: Value,
    pub fingerprint: String,
    pub model: String,
    pub scanned_at: String,
}

impl Index {
    /// Has the records [`Index::arrived`] names sent to `to` as well, from
    /// then on; whether none was named before.
    pub fn classify_to(&self, to: Sender<String>) -> bool {
        self.classifying.set(to).is_ok()
    }

    /// Tells the classifiers of the record at `uri`, which a live path put
    /// new in the index ([`Index::arrived`]). Where they are behind by
    /// [`crate::classify::QUEUED`] records, it is not scored.
    pub(super) fn to_classify(&self, uri: &str) {
        let Some(to) = self.classifying.get() else {
            return;
        };
        match to.try_send(uri.to_string()) {
            Ok(()) => {}
            Err(TrySendError::Full(_)) => tracing::warn!(%uri, "classify: behind, not scored"),
            Err(TrySendError::Closed(_)) => tracing::warn!(%uri, "classify: stopped, not scored"),
        }
    }

    /// The fingerprint `classifier` last scored `subject` at, if it did.
    pub fn fingerprint(&self, classifier: &str, subject: &str) -> rusqlite::Result<Option<String>> {
        let db = self.db.lock().unwrap();
        let sql = "SELECT fingerprint FROM classification WHERE classifier = ?1 AND subject = ?2";
        db.query_row(sql, [classifier, subject], |r| r.get(0))
            .optional()
    }

    /// Keeps `c`, in place of what its classifier scored its subject
    /// before.
    pub fn classified(&self, c: &Classification) -> rusqlite::Result<()> {
        let signals: serde_json::Map<String, Value> = c
            .signals
            .iter()
            .map(|(k, s)| (k.clone(), s.json()))
            .collect();
        let (top, score) = crate::classify::classifiers::top(&c.signals);
        let db = self.db.lock().unwrap();
        db.execute(
            "INSERT INTO classification (subject, classifier, subject_did, signals, state,
               top_signal, top_score, fingerprint, model, scanned_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
             ON CONFLICT (subject, classifier) DO UPDATE SET subject_did = excluded.subject_did,
               signals = excluded.signals, state = excluded.state,
               top_signal = excluded.top_signal, top_score = excluded.top_score,
               fingerprint = excluded.fingerprint, model = excluded.model,
               scanned_at = excluded.scanned_at",
            params![
                c.subject,
                c.classifier,
                c.subject_did,
                Value::Object(signals).to_string(),
                c.state.to_string(),
                top,
                score,
                c.fingerprint,
                c.model,
                c.scanned_at
            ],
        )?;
        Ok(())
    }

    /// The scores `classifier` gave `subject`, if it scored it.
    pub fn classification(
        &self,
        classifier: &str,
        subject: &str,
    ) -> rusqlite::Result<Option<(Value, Option<String>, f64)>> {
        let db = self.db.lock().unwrap();
        let sql = "SELECT signals, top_signal, top_score FROM classification
                   WHERE classifier = ?1 AND subject = ?2";
        db.query_row(sql, [classifier, subject], |r| {
            let signals: String = r.get(0)?;
            let signals = serde_json::from_str(&signals).unwrap_or_default();
            Ok((signals, r.get(1)?, r.get(2)?))
        })
        .optional()
    }

    /// Gives out `src`'s `val` on `uri` at `now`, unless any label of
    /// `val` was ever given it, or negated: a moderator who took one off
    /// is not overruled. Whether it gave one.
    pub fn label_once(&self, src: &str, uri: &str, val: &str, now: &str) -> rusqlite::Result<bool> {
        let db = self.db.lock().unwrap();
        let given = db.execute(
            "INSERT INTO label (src, uri, val, neg, cts)
             SELECT ?1, ?2, ?3, 0, ?4 WHERE NOT EXISTS (SELECT 1 FROM label
               WHERE uri = ?2 AND val = ?3)",
            params![src, uri, val, now],
        )?;
        Ok(given > 0)
    }

    /// Whether what the account `did` writes may be shown to a model: it
    /// is shown here, and nothing of it is about the safety of children
    /// ([`Index::child_safety`]: a report by its label or its reason type,
    /// in any state, or a `csae` label, negated since or not, or its
    /// author's own). What a report or label of that is about is for a
    /// person to judge, and is never handed to a model.
    pub fn may_classify(&self, did: &str) -> rusqlite::Result<bool> {
        let shown: bool = {
            let db = self.db.lock().unwrap();
            let sql = format!("SELECT {}", shown("?1"));
            db.query_row(&sql, [did], |r| r.get(0))?
        };
        Ok(shown && !self.child_safety(did)?)
    }

    /// The handle of `did`, if the index tracks it, as it keeps it.
    pub fn handle(&self, did: &str) -> rusqlite::Result<Option<Option<String>>> {
        let db = self.db.lock().unwrap();
        db.query_row("SELECT handle FROM repo WHERE did = ?1", [did], |r| {
            r.get(0)
        })
        .optional()
    }

    /// Whether the index holds the record at `uri`, of `table`.
    pub fn holds(&self, table: &str, uri: &str) -> rusqlite::Result<bool> {
        let db = self.db.lock().unwrap();
        let sql = format!("SELECT 1 FROM {table} WHERE uri = ?1");
        db.prepare(&sql)?.exists([uri])
    }
}
