//! The index: grain's records as the network has them, the accounts it
//! tracks, and what grain itself keeps (takedowns, labels, reports, mutes,
//! preferences and the rest). One SQLite file in WAL mode, written through
//! one connection, so writes take turns. [`schema`] says what is in it.
//!
//! A record is put by its URI and CID, at the revision of the repo it was
//! read from ([`schema`]'s `record_rev`): the same record delivered twice,
//! by `social.grain.sync.refreshRecords` reading it back proved and then
//! by Jetstream, is applied once, and a write or a deletion from an older
//! revision than the index has changes nothing ([`Applied::Stale`]), so a
//! deletion read back stands against an older write the stream brings
//! late. Backfill writes at the revision of the repo it read. A write that
//! names no revision is stamped with now. Each record is checked against
//! its lexicon first ([`grain::lexicon`]), and refused if it does not fit.

pub mod backfill;
pub mod classify;
pub mod graph;
pub mod moderation;
#[cfg(test)]
pub mod plan;
pub mod plans;
pub mod preferences;
pub mod push;
pub mod records;
pub mod schema;
pub mod sessions;
pub mod spaces;
pub mod stories;

use anyhow::{Context, bail};
use atproto::lexicon::LexiconError;
use grain::lexicon::Lexicons;
use records::{Any, Record};
use rusqlite::{Connection, OptionalExtension, ToSql, params};
use serde_json::Value;
use std::collections::HashSet;
use std::path::Path;
use std::sync::Mutex;

pub struct Index {
    db: Mutex<Connection>,
    lexicons: Lexicons,
    /// The accounts in `repo`, kept here too: the stream asks of every
    /// Bluesky post on the network whether its author is one.
    tracked: Mutex<HashSet<String>>,
    /// Where the records live paths newly put are told, for push
    /// ([`Index::arrived`]).
    arrivals: std::sync::OnceLock<tokio::sync::mpsc::Sender<String>>,
    /// Where the same records are told for the classifiers
    /// ([`Index::classify_to`]).
    classifying: std::sync::OnceLock<tokio::sync::mpsc::Sender<String>>,
    /// Its file, unless it is held in memory.
    path: Option<std::path::PathBuf>,
    /// The feeds that keep it current, as `/_status` tells of them.
    pub feeds: crate::status::Feeds,
}

/// What putting a record did.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Applied {
    /// The index had no record at its URI.
    Created,
    /// It had another version of it, which this replaced.
    Updated,
    /// It had this version already, by its CID.
    Unchanged,
    /// It had a version, or the record's deletion, from the same revision
    /// or a later one, which stands.
    Stale,
}

/// Why a record was not put.
#[derive(Debug)]
pub enum PutError {
    /// It is not one the index keeps, or does not fit its lexicon.
    Refused(LexiconError),
    Db(rusqlite::Error),
}

impl std::fmt::Display for PutError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PutError::Refused(why) => write!(f, "refused: {why}"),
            PutError::Db(e) => write!(f, "index: {e}"),
        }
    }
}

impl std::error::Error for PutError {}

impl From<rusqlite::Error> for PutError {
    fn from(e: rusqlite::Error) -> PutError {
        PutError::Db(e)
    }
}

fn refused(path: &str, message: impl Into<String>) -> PutError {
    PutError::Refused(LexiconError {
        path: path.into(),
        message: message.into(),
    })
}

/// A record as the index holds it.
#[derive(Debug, Clone, PartialEq)]
pub struct Row<T> {
    pub uri: String,
    pub cid: String,
    pub did: String,
    pub indexed_at: String,
    pub record: T,
}

/// A label, as `com.atproto.label.defs#label` has one, less its version
/// and signature.
#[derive(Debug, Clone, PartialEq)]
pub struct Label {
    pub src: String,
    /// The subject: a record's AT-URI, or an account's bare DID.
    pub uri: String,
    pub val: String,
    pub neg: bool,
    pub cts: String,
    pub exp: Option<String>,
}

/// The record a result row holds, one that names the columns of `T`'s
/// table, envelope and all.
pub fn row<T: Record>(r: &rusqlite::Row) -> rusqlite::Result<Row<T>> {
    Ok(Row {
        uri: r.get("uri")?,
        cid: r.get("cid")?,
        did: r.get("did")?,
        indexed_at: r.get("indexed_at")?,
        record: T::from_row(r)?,
    })
}

/// What grain keeps for an account, which goes with its records
/// ([`Index::purge`]): its web session, preferences, how and when it
/// reads its notifications, the devices they are pushed to, whom it
/// muted, and the stories it watched.
pub const KEPT_FOR: &[&str] = &[
    "DELETE FROM web_session WHERE did = ?1",
    "DELETE FROM preference WHERE did = ?1",
    "DELETE FROM notification_seen WHERE did = ?1",
    "DELETE FROM notification_pref WHERE did = ?1",
    "DELETE FROM push_token WHERE did = ?1",
    "DELETE FROM mute WHERE did = ?1",
    "DELETE FROM story_view WHERE did = ?1",
];

/// The author, collection and key of a record's AT-URI.
pub fn record_uri(uri: &str) -> Option<(&str, &str, &str)> {
    let mut parts = uri.strip_prefix("at://")?.split('/');
    let (did, collection, rkey) = (parts.next()?, parts.next()?, parts.next()?);
    let valid = atproto::syntax::is_did(did)
        && atproto::syntax::is_nsid(collection)
        && atproto::syntax::is_record_key(rkey);
    (valid && parts.next().is_none()).then_some((did, collection, rkey))
}

/// Brings `db`'s tables to the last of `steps`, running each it has not
/// run, each in a transaction of its own. A database further on than
/// `steps` is from a newer grain, and is refused rather than read.
pub fn migrate(db: &mut Connection, steps: &[&str]) -> anyhow::Result<()> {
    let at: i64 = db.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    let at = at as usize;
    if at > steps.len() {
        bail!(
            "the index is at version {at}, past this grain's {}",
            steps.len()
        );
    }
    for (done, step) in steps.iter().enumerate().skip(at) {
        let tx = db.transaction()?;
        tx.execute_batch(step)
            .with_context(|| format!("migrating the index to version {}", done + 1))?;
        tx.pragma_update(None, "user_version", done as i64 + 1)?;
        tx.commit()?;
    }
    Ok(())
}

/// Whether a write at `rev` is past what the index has for `uri`. One
/// that names no revision always is: it is the stream's, as it happens.
fn newer(tx: &Connection, uri: &str, rev: Option<&str>) -> rusqlite::Result<bool> {
    let Some(rev) = rev else {
        return Ok(true);
    };
    let sql = "SELECT rev FROM record_rev WHERE uri = ?1";
    let held: Option<String> = tx.query_row(sql, [uri], |r| r.get(0)).optional()?;
    Ok(held.is_none_or(|held| held.as_str() < rev))
}

/// Keeps that `uri` was written, or deleted (`gone`), at `rev`, or now if
/// it names none: never back from a later revision than it has.
fn stamp(tx: &Connection, uri: &str, rev: Option<&str>, gone: bool) -> rusqlite::Result<()> {
    let rev = rev.map_or_else(grain::keys::tid, str::to_string);
    tx.execute(
        "INSERT INTO record_rev VALUES (?1, ?2, ?3)
         ON CONFLICT (uri) DO UPDATE SET rev = max(rev, excluded.rev), gone = excluded.gone",
        params![uri, rev, gone],
    )?;
    Ok(())
}

impl Index {
    /// The index at `path`, made or migrated to this version's tables.
    pub fn open(path: &Path) -> anyhow::Result<Index> {
        let db = Connection::open(path).with_context(|| format!("opening {}", path.display()))?;
        let mut index = Index::with(db, schema::MIGRATIONS)?;
        index.path = Some(path.to_path_buf());
        Ok(index)
    }

    /// The version of the tables in the index at `path`, read without
    /// changing it; none where there is no file yet.
    pub fn version_at(path: &Path) -> anyhow::Result<Option<usize>> {
        if !path.exists() {
            return Ok(None);
        }
        let flags = rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY;
        let db = Connection::open_with_flags(path, flags)
            .with_context(|| format!("opening {}", path.display()))?;
        let at: i64 = db.query_row("PRAGMA user_version", [], |r| r.get(0))?;
        Ok(Some(at as usize))
    }

    /// The index's file, unless it is held in memory.
    pub fn path(&self) -> Option<&Path> {
        self.path.as_deref()
    }

    /// That the index answers a read.
    pub fn answers(&self) -> rusqlite::Result<()> {
        let sql = "SELECT EXISTS (SELECT 1 FROM repo -- scans: repo, to its first row alone\n)";
        self.read(|db| db.query_row(sql, [], |r| r.get::<_, bool>(0)).map(drop))
    }

    /// An index held in memory, for tests.
    pub fn memory() -> anyhow::Result<Index> {
        Index::with(Connection::open_in_memory()?, schema::MIGRATIONS)
    }

    fn with(mut db: Connection, steps: &[&str]) -> anyhow::Result<Index> {
        db.busy_timeout(std::time::Duration::from_secs(5))?;
        crate::telemetry::watch(&db);
        db.execute_batch("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;")?;
        migrate(&mut db, steps)?;
        let tracked = {
            let sql = "SELECT did FROM repo -- scans: repo, as the index opens, for whom it tracks";
            let mut stmt = db.prepare(sql)?;
            let dids = stmt.query_map([], |r| r.get(0))?;
            dids.collect::<rusqlite::Result<HashSet<String>>>()?
        };
        Ok(Index {
            db: Mutex::new(db),
            lexicons: Lexicons::grain(),
            tracked: Mutex::new(tracked),
            arrivals: std::sync::OnceLock::new(),
            classifying: std::sync::OnceLock::new(),
            path: None,
            feeds: crate::status::Feeds::default(),
        })
    }

    /// Runs `f` on the index's connection, as no other write runs.
    pub fn read<T>(&self, f: impl FnOnce(&Connection) -> T) -> T {
        f(&self.db.lock().unwrap())
    }

    /// Puts the record at `uri`, of `cid`, as it is now.
    pub fn put(&self, uri: &str, cid: &str, record: &Value) -> Result<Applied, PutError> {
        self.put_at(uri, cid, record, &grain::keys::now_iso())
    }

    /// [`Index::put`], as though it were first indexed at `indexed_at`.
    /// A record already held keeps when it was.
    pub fn put_at(
        &self,
        uri: &str,
        cid: &str,
        record: &Value,
        indexed_at: &str,
    ) -> Result<Applied, PutError> {
        self.write(uri, cid, record, indexed_at, None)
    }

    /// [`Index::put`] of the version the repo had at revision `rev`.
    pub fn put_rev(
        &self,
        uri: &str,
        cid: &str,
        record: &Value,
        rev: &str,
    ) -> Result<Applied, PutError> {
        self.write(uri, cid, record, &grain::keys::now_iso(), Some(rev))
    }

    /// Whether the index would put `record` as one of `collection`: one
    /// it keeps, of that `$type`, that fits its lexicon. For a write to
    /// refuse what the index would before it is made.
    pub fn check(&self, collection: &str, record: &Value) -> Result<(), PutError> {
        self.parsed(collection, record, true).map(drop)
    }

    /// `record`, of `collection`, as a row of its table, and the table:
    /// checked as a write must be if `strict`, or else as one from the
    /// network is taken ([`Lexicons::validate_indexed`]).
    fn parsed(
        &self,
        collection: &str,
        record: &Value,
        strict: bool,
    ) -> Result<(&'static str, Any), PutError> {
        let Some(table) = records::table_of(collection) else {
            return Err(refused("", format!("the index keeps no {collection}")));
        };
        if record["$type"] != collection {
            return Err(refused("$type", format!("must be {collection}")));
        }
        let lexicons = &self.lexicons;
        let checked = match strict {
            true => lexicons.validate_record(collection, record),
            false => lexicons.validate_indexed(collection, record),
        };
        checked.map_err(PutError::Refused)?;
        let row = Any::parse(collection, record).expect("a collection with a table parses");
        let row = row.map_err(|e| refused("", e.to_string()))?;
        Ok((table, row))
    }

    fn write(
        &self,
        uri: &str,
        cid: &str,
        record: &Value,
        indexed_at: &str,
        rev: Option<&str>,
    ) -> Result<Applied, PutError> {
        let (did, collection, _) =
            record_uri(uri).ok_or_else(|| refused("", "not a record URI"))?;
        if !atproto::lexicon::is_cid_string(cid) {
            return Err(refused("", format!("not a CID: {cid}")));
        }
        let (table, row) = self.parsed(collection, record, false)?;
        let mut db = self.db.lock().unwrap();
        let tx = db.transaction()?;
        if !newer(&tx, uri, rev)? {
            return Ok(Applied::Stale);
        }
        stamp(&tx, uri, rev, false)?;
        let held = format!("SELECT cid FROM {table} WHERE uri = ?1");
        let was: Option<String> = tx.query_row(&held, [uri], |r| r.get(0)).optional()?;
        if was.as_deref() == Some(cid) {
            tx.commit()?;
            return Ok(Applied::Unchanged);
        }
        let columns = row.columns();
        let sql = format!(
            "INSERT INTO {table} (uri, cid, did, indexed_at, {names}) VALUES (?1, ?2, ?3, ?4, {slots})
             ON CONFLICT (uri) DO UPDATE SET cid = excluded.cid, {sets}",
            names = columns.join(", "),
            slots = (5..5 + columns.len()).map(|i| format!("?{i}")).collect::<Vec<_>>().join(", "),
            sets = columns.iter().map(|c| format!("{c} = excluded.{c}")).collect::<Vec<_>>().join(", "),
        );
        let mut values: Vec<&dyn ToSql> = vec![&uri, &cid, &did, &indexed_at];
        values.extend(row.params());
        tx.prepare_cached(&sql)?.execute(&*values)?;
        tx.execute("DELETE FROM self_label WHERE uri = ?1", [uri])?;
        for val in records::self_labels(record) {
            tx.execute(
                "INSERT OR IGNORE INTO self_label VALUES (?1, ?2)",
                [uri, val],
            )?;
        }
        tx.commit()?;
        Ok(match was {
            Some(_) => Applied::Updated,
            None => Applied::Created,
        })
    }

    /// Deletes the record at `uri`; whether the index had it.
    pub fn delete(&self, uri: &str) -> rusqlite::Result<bool> {
        self.remove(uri, None)
    }

    /// [`Index::delete`], as of the repo's revision `rev`: not where the
    /// index has the record from that revision or a later one.
    pub fn delete_rev(&self, uri: &str, rev: &str) -> rusqlite::Result<bool> {
        self.remove(uri, Some(rev))
    }

    fn remove(&self, uri: &str, rev: Option<&str>) -> rusqlite::Result<bool> {
        let table = record_uri(uri).and_then(|(_, c, _)| records::table_of(c));
        let Some(table) = table else {
            return Ok(false);
        };
        let mut db = self.db.lock().unwrap();
        let tx = db.transaction()?;
        if !newer(&tx, uri, rev)? {
            return Ok(false);
        }
        stamp(&tx, uri, rev, true)?;
        tx.execute("DELETE FROM self_label WHERE uri = ?1", [uri])?;
        let deleted = tx.execute(&format!("DELETE FROM {table} WHERE uri = ?1"), [uri])?;
        tx.commit()?;
        Ok(deleted > 0)
    }

    /// The record at `uri`, of `T`'s collection.
    pub fn get<T: Record>(&self, uri: &str) -> rusqlite::Result<Option<Row<T>>> {
        let db = self.db.lock().unwrap();
        let sql = format!("SELECT * FROM {} WHERE uri = ?1", T::TABLE);
        db.query_row(&sql, [uri], row).optional()
    }

    /// The self-labels the record at `uri` carries.
    pub fn self_labels(&self, uri: &str) -> rusqlite::Result<Vec<String>> {
        let db = self.db.lock().unwrap();
        let mut stmt = db.prepare("SELECT val FROM self_label WHERE uri = ?1 ORDER BY val")?;
        let vals = stmt.query_map([uri], |r| r.get(0))?;
        vals.collect()
    }

    /// Tracks the account `did`; whether it was not tracked before.
    pub fn track(&self, did: &str) -> rusqlite::Result<bool> {
        let db = self.db.lock().unwrap();
        let added = db.execute("INSERT OR IGNORE INTO repo (did) VALUES (?1)", [did])?;
        self.tracked.lock().unwrap().insert(did.to_string());
        Ok(added > 0)
    }

    /// Stops tracking the account `did`, which deleted what it had here:
    /// its row in `repo` goes, handle and all, until it writes again.
    pub fn untrack(&self, did: &str) -> rusqlite::Result<bool> {
        let db = self.db.lock().unwrap();
        let gone = db.execute("DELETE FROM repo WHERE did = ?1", [did])?;
        self.tracked.lock().unwrap().remove(did);
        Ok(gone > 0)
    }

    /// Whether the account `did` is tracked.
    pub fn tracks(&self, did: &str) -> bool {
        self.tracked.lock().unwrap().contains(did)
    }

    /// Keeps `handle` as the tracked account `did`'s. A handle names one
    /// account, so another that had it has none until it is told its own.
    pub fn set_handle(&self, did: &str, handle: &str) -> rusqlite::Result<()> {
        let mut db = self.db.lock().unwrap();
        let tx = db.transaction()?;
        let sql = "UPDATE repo SET handle = NULL WHERE handle = ?2 AND did <> ?1";
        tx.execute(sql, [did, handle])?;
        tx.execute("UPDATE repo SET handle = ?2 WHERE did = ?1", [did, handle])?;
        tx.commit()
    }

    /// The tracked account `did`'s handle, and how far backfill has it.
    pub fn repo(&self, did: &str) -> rusqlite::Result<Option<(Option<String>, String)>> {
        let db = self.db.lock().unwrap();
        let sql = "SELECT handle, state FROM repo WHERE did = ?1";
        db.query_row(sql, [did], |r| Ok((r.get(0)?, r.get(1)?)))
            .optional()
    }

    /// What `did`'s host last said of it, if not that it is active.
    pub fn host_status(&self, did: &str) -> rusqlite::Result<Option<String>> {
        let db = self.db.lock().unwrap();
        let sql = "SELECT host_status FROM repo WHERE did = ?1";
        let status = db.query_row(sql, [did], |r| r.get(0)).optional()?;
        Ok(status.flatten())
    }

    /// Keeps what `did`'s host says of it, none when it is active. One
    /// that comes back is backfilled again, as it may have changed while
    /// it was gone.
    pub fn set_host_status(&self, did: &str, status: Option<&str>) -> rusqlite::Result<()> {
        let db = self.db.lock().unwrap();
        db.execute(
            "UPDATE repo SET host_status = ?2,
               state = CASE WHEN ?2 IS NULL AND host_status IS NOT NULL THEN 'pending' ELSE state END
             WHERE did = ?1",
            params![did, status],
        )?;
        Ok(())
    }

    /// Deletes every record `did` wrote, and what grain keeps for it
    /// ([`KEPT_FOR`]); how many records. What an admin holds of it stays:
    /// its takedown, the labels given out and the reports made of it, as
    /// do the mutes others made of it, which are theirs.
    pub fn purge(&self, did: &str) -> rusqlite::Result<usize> {
        let mut db = self.db.lock().unwrap();
        let tx = db.transaction()?;
        // URIs from `at://<did>/` up to, not including, `at://<did>0`.
        let (from, to) = (format!("at://{did}/"), format!("at://{did}0"));
        tx.execute(
            "DELETE FROM self_label WHERE uri >= ?1 AND uri < ?2",
            [&from, &to],
        )?;
        tx.execute(
            "DELETE FROM record_rev WHERE uri >= ?1 AND uri < ?2",
            [&from, &to],
        )?;
        let mut purged = 0;
        for (_, table) in records::COLLECTIONS {
            purged += tx.execute(&format!("DELETE FROM {table} WHERE did = ?1"), [did])?;
        }
        for sql in KEPT_FOR {
            tx.execute(sql, [did])?;
        }
        tx.commit()?;
        Ok(purged)
    }

    /// Takes the account `did` down, by an admin's word.
    pub fn take_down(&self, did: &str) -> rusqlite::Result<()> {
        let db = self.db.lock().unwrap();
        let sql = "INSERT OR IGNORE INTO takedown VALUES (?1, ?2)";
        db.execute(sql, [did, &grain::keys::now_iso()])?;
        Ok(())
    }

    /// Lifts an admin's takedown of `did`.
    pub fn reverse_takedown(&self, did: &str) -> rusqlite::Result<()> {
        let db = self.db.lock().unwrap();
        db.execute("DELETE FROM takedown WHERE did = ?1", [did])?;
        Ok(())
    }

    pub fn taken_down(&self, did: &str) -> rusqlite::Result<bool> {
        let db = self.db.lock().unwrap();
        db.prepare("SELECT 1 FROM takedown WHERE did = ?1")?
            .exists([did])
    }

    /// Marks `did`'s notifications seen as of `seen_at`, an RFC 3339
    /// time, kept in UTC to the millisecond as SQLite's `strftime` writes
    /// it, so that it compares as text with the times records are kept
    /// at. A later call replaces it, earlier or not, as Bluesky's
    /// `updateSeen` does. `seen_at` is a datetime as atproto has one, which
    /// holds a year UTC writes in four digits.
    pub fn set_seen(&self, did: &str, seen_at: &str) -> rusqlite::Result<()> {
        let db = self.db.lock().unwrap();
        let sql = "SELECT strftime('%Y-%m-%dT%H:%M:%fZ', ?1)";
        let utc: String = db.query_row(sql, [seen_at], |r| r.get(0))?;
        db.execute(
            "INSERT INTO notification_seen VALUES (?1, ?2)
             ON CONFLICT (did) DO UPDATE SET seen_at = excluded.seen_at",
            [did, &utc],
        )?;
        Ok(())
    }

    /// The last sequence number read from the stream `source`.
    pub fn cursor(&self, source: &str) -> rusqlite::Result<Option<i64>> {
        let db = self.db.lock().unwrap();
        let sql = "SELECT seq FROM stream_cursor WHERE source = ?1";
        db.query_row(sql, [source], |r| r.get(0)).optional()
    }

    pub fn set_cursor(&self, source: &str, seq: i64) -> rusqlite::Result<()> {
        let db = self.db.lock().unwrap();
        let sql = "INSERT OR REPLACE INTO stream_cursor VALUES (?1, ?2)";
        db.execute(sql, params![source, seq])?;
        Ok(())
    }

    /// Drops where the stream `source` was read to, so that it is next
    /// read from its live tip.
    pub fn forget_cursor(&self, source: &str) -> rusqlite::Result<()> {
        let db = self.db.lock().unwrap();
        db.execute("DELETE FROM stream_cursor WHERE source = ?1", [source])?;
        Ok(())
    }

    /// Gives out `label`; its sequence number.
    pub fn label(&self, label: &Label) -> rusqlite::Result<i64> {
        moderation::give(&self.db.lock().unwrap(), label)
    }

    /// The labels given out on `uri`, in the order they were.
    pub fn labels(&self, uri: &str) -> rusqlite::Result<Vec<Label>> {
        let db = self.db.lock().unwrap();
        let sql = "SELECT src, uri, val, neg, cts, exp FROM label WHERE uri = ?1 ORDER BY id";
        let mut stmt = db.prepare(sql)?;
        let labels = stmt.query_map([uri], |r| {
            Ok(Label {
                src: r.get(0)?,
                uri: r.get(1)?,
                val: r.get(2)?,
                neg: r.get(3)?,
                cts: r.get(4)?,
                exp: r.get(5)?,
            })
        })?;
        labels.collect()
    }
}

#[cfg(test)]
mod tests;
