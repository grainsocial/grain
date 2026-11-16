//! What grain's moderators decide, as the index keeps it: the reports
//! sent in (`report`), the labels grain's labeler gives out (`label`) and
//! the accounts taken down (`takedown`). None of it is rebuilt from the
//! network. [`crate::moderation`] answers the XRPC methods that read and
//! write it.

use super::{Index, Label, records};
use grain::labels;
use rusqlite::{Connection, OptionalExtension, params};
use serde_json::Value;

/// The label that takes what carries it out of view.
pub const TAKEDOWN: &str = "!takedown";

/// A report, as `report` keeps it.
#[derive(Debug, Clone, PartialEq)]
pub struct Report {
    pub id: i64,
    /// An account's bare DID, or a record's AT-URI.
    pub subject: String,
    /// The account the subject is, or whose record it is.
    pub subject_did: String,
    /// The label it asks for.
    pub label: String,
    /// `com.atproto.moderation.defs#reasonType`, for one sent by it.
    pub reason_type: Option<String>,
    pub reason: Option<String>,
    pub reported_by: String,
    /// Its reporter's handle, if the index holds a valid one.
    pub reported_by_handle: Option<String>,
    /// `open`, `resolved` or `dismissed`.
    pub status: String,
    pub resolved_by: Option<String>,
    pub resolved_at: Option<String>,
    pub created_at: String,
}

impl Report {
    /// Whether it is about the safety of children ([`labels::child_safety`]).
    pub fn child_safety(&self) -> bool {
        labels::child_safety(&self.label, self.reason_type.as_deref())
    }
}

/// A report to keep: what [`Index::file_report`] is given.
#[derive(Debug, Clone, PartialEq)]
pub struct NewReport<'a> {
    pub subject: &'a str,
    pub subject_did: &'a str,
    pub label: &'a str,
    pub reason_type: Option<&'a str>,
    pub reason: Option<&'a str>,
    pub reported_by: &'a str,
    pub created_at: &'a str,
}

/// Which reports a list holds.
#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct Filter<'a> {
    /// Of this status, or any.
    pub status: Option<&'a str>,
    /// Asking for this label, or any.
    pub label: Option<&'a str>,
}

/// The reports `filter` names with the rest of a query, `rest`, each with
/// its reporter's handle.
fn reports_where(rest: &str) -> String {
    format!(
        "SELECT r.id, r.subject_uri, r.subject_did, r.label, r.reason_type, r.reason,
           r.reported_by, h.handle, r.status, r.resolved_by, r.resolved_at, r.created_at
         FROM report r LEFT JOIN repo h ON h.did = r.reported_by {rest}"
    )
}

/// SQL that holds where the label `l` stands: no later word on its subject
/// and value, given or negated, and not expired at `now`.
fn standing(l: &str, now: &str) -> String {
    format!(
        "{l}.neg = 0 AND ({l}.exp IS NULL OR {l}.exp > {now})
         AND NOT EXISTS (SELECT 1 FROM label n WHERE n.uri = {l}.uri AND n.val = {l}.val
           AND (n.cts > {l}.cts OR (n.cts = {l}.cts AND n.id > {l}.id)))"
    )
}

/// SQL that holds where the subject `uri` is the account `did` (bound as
/// `{did}`) or one of its records: the records' AT-URIs sort after
/// `at://<did>/` and before `at://<did>0`.
fn of_account(uri: &str, did: &str) -> String {
    format!(
        "({uri} = {did} OR ({uri} > 'at://' || {did} || '/' AND {uri} < 'at://' || {did} || '0'))"
    )
}

fn report(r: &rusqlite::Row) -> rusqlite::Result<Report> {
    let handle: Option<String> = r.get(7)?;
    Ok(Report {
        id: r.get(0)?,
        subject: r.get(1)?,
        subject_did: r.get(2)?,
        label: r.get(3)?,
        reason_type: r.get(4)?,
        reason: r.get(5)?,
        reported_by: r.get(6)?,
        reported_by_handle: handle.filter(|h| grain::lexicon::valid_handle(h)),
        status: r.get(8)?,
        resolved_by: r.get(9)?,
        resolved_at: r.get(10)?,
        created_at: r.get(11)?,
    })
}

fn label(r: &rusqlite::Row) -> rusqlite::Result<Label> {
    Ok(Label {
        src: r.get(0)?,
        uri: r.get(1)?,
        val: r.get(2)?,
        neg: r.get(3)?,
        cts: r.get(4)?,
        exp: r.get(5)?,
    })
}

pub(super) fn give(db: &Connection, label: &Label) -> rusqlite::Result<i64> {
    db.execute(
        "INSERT INTO label (src, uri, val, neg, cts, exp) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            label.src, label.uri, label.val, label.neg, label.cts, label.exp
        ],
    )?;
    Ok(db.last_insert_rowid())
}

impl Index {
    /// Keeps `new`, open; the report as kept.
    pub fn file_report(&self, new: &NewReport) -> rusqlite::Result<Report> {
        let filed = self.file(new, false)?;
        Ok(filed.expect("a report is filed when none is asked to be open"))
    }

    /// Keeps `new`, open, unless a report on its subject asking for its
    /// label is open: a second would only split the review. The report
    /// kept, if one was.
    pub fn file_report_once(&self, new: &NewReport) -> rusqlite::Result<Option<Report>> {
        self.file(new, true)
    }

    fn file(&self, new: &NewReport, once: bool) -> rusqlite::Result<Option<Report>> {
        let db = self.db.lock().unwrap();
        let id: Option<i64> = db
            .query_row(
                "INSERT INTO report (subject_uri, subject_did, label, reason_type, reason,
                   reported_by, created_at)
                 SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7 WHERE NOT ?8 OR NOT EXISTS (
                   SELECT 1 FROM report WHERE subject_uri = ?1 AND label = ?3
                     AND status = 'open')
                 RETURNING id",
                params![
                    new.subject,
                    new.subject_did,
                    new.label,
                    new.reason_type,
                    new.reason,
                    new.reported_by,
                    new.created_at,
                    once
                ],
                |r| r.get(0),
            )
            .optional()?;
        let Some(id) = id else { return Ok(None) };
        db.query_row(&reports_where("WHERE r.id = ?1"), [id], report)
            .map(Some)
    }

    /// The reports `filter` holds, newest first, from before the id
    /// `before` if given, `limit` at most; and how many it holds in all.
    pub fn reports(
        &self,
        filter: Filter,
        before: Option<i64>,
        limit: usize,
    ) -> rusqlite::Result<(Vec<Report>, i64)> {
        let db = self.db.lock().unwrap();
        let before = before.unwrap_or(i64::MAX);
        let sql = reports_where(
            "WHERE (?1 IS NULL OR r.status = ?1) AND (?2 IS NULL OR r.label = ?2) AND r.id < ?3
             ORDER BY r.id DESC LIMIT ?4",
        );
        let mut stmt = db.prepare_cached(&sql)?;
        let at = params![filter.status, filter.label, before, limit as i64];
        let reports = stmt
            .query_map(at, report)?
            .collect::<rusqlite::Result<_>>()?;
        let total = db.query_row(
            "SELECT count(*) FROM report WHERE (?1 IS NULL OR status = ?1)
               AND (?2 IS NULL OR label = ?2)
             -- scans: report, as only moderators ask, and reports are few beside records",
            params![filter.status, filter.label],
            |r| r.get(0),
        )?;
        Ok((reports, total))
    }

    /// Every report against the account `did` or one of its records,
    /// newest first.
    pub fn reports_on(&self, did: &str) -> rusqlite::Result<Vec<Report>> {
        let db = self.db.lock().unwrap();
        let sql = reports_where("WHERE r.subject_did = ?1 ORDER BY r.id DESC");
        let mut stmt = db.prepare_cached(&sql)?;
        let reports = stmt.query_map([did], report)?;
        reports.collect()
    }

    /// The report `id`, if there is one.
    pub fn report(&self, id: i64) -> rusqlite::Result<Option<Report>> {
        let db = self.db.lock().unwrap();
        db.query_row(&reports_where("WHERE r.id = ?1"), [id], report)
            .optional()
    }

    /// Closes the open report `id` as `status` (`resolved` or
    /// `dismissed`), by `by` at `at`, giving out `label` with it, as one
    /// step; the report as it was, or none for one not open.
    pub fn close_report(
        &self,
        id: i64,
        status: &str,
        by: &str,
        at: &str,
        label: Option<&Label>,
    ) -> rusqlite::Result<Option<Report>> {
        let mut db = self.db.lock().unwrap();
        let tx = db.transaction()?;
        let sql = reports_where("WHERE r.id = ?1 AND r.status = 'open'");
        let Some(open) = tx.query_row(&sql, [id], report).optional()? else {
            return Ok(None);
        };
        tx.execute(
            "UPDATE report SET status = ?2, resolved_by = ?3, resolved_at = ?4 WHERE id = ?1",
            params![id, status, by, at],
        )?;
        if let Some(label) = label {
            give(&tx, label)?;
        }
        tx.commit()?;
        Ok(Some(open))
    }

    /// The labels standing on the account `did` and on each of its
    /// records, in the order they were given.
    pub fn labels_on(&self, did: &str) -> rusqlite::Result<Vec<Label>> {
        let db = self.db.lock().unwrap();
        let sql = format!(
            "SELECT l.src, l.uri, l.val, l.neg, l.cts, l.exp FROM label l
             WHERE {} AND {} ORDER BY l.id
             -- sorts: label, an account's own, by the range of its URIs",
            of_account("l.uri", "?1"),
            standing("l", "?2")
        );
        let mut stmt = db.prepare_cached(&sql)?;
        let labels = stmt.query_map(params![did, grain::keys::now_iso()], label)?;
        labels.collect()
    }

    /// The labels standing on a subject `patterns` names, each a subject
    /// or a prefix ending in `*`, from any of `sources` if any are named,
    /// past the label `after`, `limit` at most; each with its id.
    pub fn query_labels(
        &self,
        patterns: &[&str],
        sources: &[&str],
        after: i64,
        limit: usize,
    ) -> rusqlite::Result<Vec<(i64, Label)>> {
        let db = self.db.lock().unwrap();
        let sql = format!(
            "SELECT l.src, l.uri, l.val, l.neg, l.cts, l.exp, l.id FROM label l
             WHERE l.id > ?3 AND EXISTS (SELECT 1 FROM json_each(?1) p WHERE l.uri = p.value
               OR (substr(p.value, -1) = '*'
                 AND substr(l.uri, 1, length(p.value) - 1) = substr(p.value, 1, length(p.value) - 1)))
               AND (json_array_length(?2) = 0 OR l.src IN (SELECT value FROM json_each(?2)))
               AND {}
             ORDER BY l.id LIMIT ?4",
            standing("l", "?5")
        );
        let mut stmt = db.prepare_cached(&sql)?;
        let at = params![
            crate::read::list(patterns),
            crate::read::list(sources),
            after,
            limit as i64,
            grain::keys::now_iso()
        ];
        let labels = stmt.query_map(at, |r| Ok((r.get(6)?, label(r)?)))?;
        labels.collect()
    }

    /// Whether the label `val` stands on `uri`, as `src` gave it.
    pub fn labeled(&self, src: &str, uri: &str, val: &str) -> rusqlite::Result<bool> {
        let db = self.db.lock().unwrap();
        let sql = format!(
            "SELECT 1 FROM label l WHERE l.src = ?1 AND l.uri = ?2 AND l.val = ?3 AND {}",
            standing("l", "?4")
        );
        db.prepare_cached(&sql)?
            .exists(params![src, uri, val, grain::keys::now_iso()])
    }

    /// Whether a child-safety report was ever made against the account
    /// `did` or one of its records, in any state, by its label or its
    /// reason type ([`Report::child_safety`]), or a child-safety label ever
    /// given one of them, negated since or not, or put on one by its
    /// author.
    pub fn child_safety(&self, did: &str) -> rusqlite::Result<bool> {
        if self.reports_on(did)?.iter().any(Report::child_safety) {
            return Ok(true);
        }
        let db = self.db.lock().unwrap();
        let ours = of_account("uri", "?1");
        let sql = format!(
            "SELECT 1 FROM label WHERE val = ?2 AND {ours}
             UNION ALL SELECT 1 FROM self_label WHERE val = ?2 AND {ours}"
        );
        db.prepare_cached(&sql)?.exists([did, labels::CSAE])
    }

    /// Takes the account `did` down, or puts it back (`applied` false), by
    /// an admin's word, and says so as `src`'s `!takedown` label on it, or
    /// that label's negation, at `cts`: as one step.
    pub fn set_takedown(
        &self,
        src: &str,
        did: &str,
        applied: bool,
        cts: &str,
    ) -> rusqlite::Result<()> {
        let mut db = self.db.lock().unwrap();
        let tx = db.transaction()?;
        match applied {
            true => tx.execute("INSERT OR IGNORE INTO takedown VALUES (?1, ?2)", [did, cts])?,
            false => tx.execute("DELETE FROM takedown WHERE did = ?1", [did])?,
        };
        let label = Label {
            src: src.into(),
            uri: did.into(),
            val: TAKEDOWN.into(),
            neg: !applied,
            cts: cts.into(),
            exp: None,
        };
        give(&tx, &label)?;
        tx.commit()
    }

    /// The CID the index holds `uri`'s record at, if it holds the record.
    pub fn record_cid(&self, uri: &str) -> rusqlite::Result<Option<String>> {
        let table =
            super::record_uri(uri).and_then(|(_, collection, _)| records::table_of(collection));
        let Some(table) = table else {
            return Ok(None);
        };
        let db = self.db.lock().unwrap();
        let sql = format!("SELECT cid FROM {table} WHERE uri = ?1");
        db.query_row(&sql, [uri], |r| r.get(0)).optional()
    }

    /// The newest `each` records of each collection `did` wrote, as the
    /// index keeps them, and how many it holds of each collection it holds
    /// any of.
    pub fn records_of(
        &self,
        did: &str,
        each: usize,
    ) -> rusqlite::Result<(Vec<Sampled>, Vec<Count>)> {
        let db = self.db.lock().unwrap();
        let (mut sampled, mut counts) = (Vec::new(), Vec::new());
        for &(collection, table) in records::COLLECTIONS {
            let count: i64 = db.query_row(
                &format!("SELECT count(*) FROM {table} WHERE did = ?1"),
                [did],
                |r| r.get(0),
            )?;
            if count == 0 {
                continue;
            }
            counts.push((collection, count));
            let sql = format!(
                "SELECT * FROM {table} WHERE did = ?1 ORDER BY indexed_at DESC, uri DESC LIMIT ?2"
            );
            let mut stmt = db.prepare_cached(&sql)?;
            let rows = stmt.query_map(params![did, each as i64], |r| {
                Ok(Sampled {
                    collection,
                    uri: r.get("uri")?,
                    cid: r.get("cid")?,
                    indexed_at: r.get("indexed_at")?,
                    value: records::value(collection, r)?,
                })
            })?;
            sampled.extend(rows.collect::<rusqlite::Result<Vec<_>>>()?);
        }
        Ok((sampled, counts))
    }
}

/// How many records of a collection an account has.
pub type Count = (&'static str, i64);

/// A record of an account's, as [`Index::records_of`] samples them.
#[derive(Debug, Clone, PartialEq)]
pub struct Sampled {
    pub collection: &'static str,
    pub uri: String,
    pub cid: String,
    pub indexed_at: String,
    pub value: Value,
}
