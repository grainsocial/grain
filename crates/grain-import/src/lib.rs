//! `grain-import`: hatk's SQLite database made a new grain-serve index.
//!
//! A one-shot cutover tool, run once against production's `grain.db` as
//! grain moves off hatk, and deleted once that import has run. It is the
//! only code that knows the old database's layout: grain-serve's index and
//! its migrations hold grain's data alone, and this crate converts hatk's
//! into it.
//!
//! The old database is opened read-only and read in one snapshot. The index
//! it is read into must be new or empty, and it is written in one
//! transaction: whole, or not at all.
//!
//! # Records
//!
//! hatk kept a table a collection, named for its NSID, with the envelope
//! (`uri`, `cid`, `did`, `space`, `indexed_at`) and a column a field,
//! named for it in snake case: structured values as their JSON, bytes as
//! hatk wrote them. Each row is made its record again, checked against
//! its lexicon as a record put now is, and written with the `indexed_at`
//! hatk gave it. One that does not fit, or has no CID, is counted and left
//! out, not fatal unless `--strict` says so. One from a permissioned space
//! is left out too: the index holds only what the network serves. The
//! tables hatk derived from a record's arrays (`<nsid>__<field>`) are not
//! read, as each array is in its record's own column too; the self-labels
//! are made again from the record.
//!
//! # What the network cannot rebuild
//!
//! Each of these is copied row for row ([`KEPT`]), its ids kept, so that a
//! label's sequence number and a report's id mean what they meant:
//! `_labels` (an account's labels name it by its bare DID, and stay so),
//! `_reports`, `_mutes`, `_preferences`, `_push_tokens`, `_story_views`,
//! `_space_support`. hatk's `_space_invites`, whom each private gallery
//! was shared with, is not read: grain-serve has no private galleries.
//!
//! hatk gave its labels out as `admin`, from its admin routes, and `self`,
//! from its label rules, which name no labeler: each is grain's, and given
//! out as grain-serve's DID, the `did:web` of `GRAIN_PUBLIC_URL`, or
//! [`LABELER`] where it is unset. A label hatk had from a labeler by its
//! DID keeps it.
//!
//! hatk's `_repos.status` said two things at once, kept apart here. An
//! admin's takedown, `takendown`, which only hatk's admin routes wrote,
//! is a row of `takedown`, at the time of the import as hatk kept none.
//! What a host said, `deactivated` (hatk's word for deactivated, suspended
//! or taken down by the host) or `deleted`, is `repo.host_status`. The
//! rest is backfill's queue: `pending` and `active` stay; `failed` is
//! `failed` where hatk had given up on it, after its default five tries,
//! and `pending`, at its `retry_after`, where it had not; a repo whose
//! status said nothing of backfill is `active` if it was read and
//! `pending` if not. A status hatk never wrote is `pending`, and named in
//! the summary and in `last_error`.
//!
//! Of `_preferences`, the two keys notifications kept are tables of their
//! own: `lastSeenNotifications` is `notification_seen`, its time in UTC
//! as [`grain::keys::iso`] writes it, and `notificationPrefs` is a row of
//! `notification_pref` a kind of notification it set, as hatk read it: a
//! kind is pushed, or shown in the app, unless it says `false`, and from
//! anyone unless it says `from: "follows"`. A kind it kept as anything
//! but an object, or a value that is not JSON, said nothing hatk read, and
//! is not counted. The rest of `_preferences` is `preference`, as it was.
//!
//! Of `_push_tokens`, a device's platform is grain's word for it: hatk's
//! `apns` is `ios` and its `fcm` is `android`; `web`, and any other, stay.
//!
//! `_cursor`'s Jetstream rows (`jetstream:<url>`) are `stream_cursor`'s,
//! so the stream resumes where hatk left it.
//!
//! Of `_oauth_keys`, `pds-client-auth-key` is `oauth_key`'s, the private
//! JWK as hatk kept it: grain's OAuth client goes on signing with the key
//! its JWKS has always named, so each PDS goes on knowing the client.
//!
//! # Web sessions
//!
//! Each of `_oauth_sessions` is a `web_session`, so that the web stays
//! logged in across the move: the session hatk held at each account's
//! PDS, as the confidential client `--public-url` (or `GRAIN_PUBLIC_URL`)
//! names, `<url>/oauth-client-metadata.json`, as hatk's was. hatk bound
//! every one to the DPoP key `appview-oauth-key`, and a session is
//! carried with that key; one bound to another (its `dpop_jkt`), or with
//! no refresh token, is not, and its account logs in again. Its access
//! token is taken as expired where hatk kept no expiry, so it is
//! refreshed before it is used. With no public URL, none is carried.
//! These are counted, not checked: an account that logs in again has
//! lost nothing.
//!
//! hatk sealed its session cookies with AES-256-GCM under a key drawn by
//! HKDF-SHA256 (no salt, info `hatk-session-cookie`) from
//! `appview-oauth-key`, the private JWK as JSON with its members sorted
//! by name. That key's 32 bytes are `carried_cookie_key`'s, all grain-serve
//! keeps of it, for its carryover to open the cookies browsers still hold
//! (`grain_serve::login::carryover`). The JWK itself is not imported.
//!
//! Not imported: hatk's other OAuth keys, its OAuth server's own tables
//! (the apps' logins to hatk, which end with it), its search tables,
//! classifier scores, space sync state, and records of
//! collections the index does not keep. The summary names each such table
//! and its rows.
//!
//! # The check
//!
//! The summary counts each table in hatk and in the index. Where a table
//! of what the network cannot rebuild differs by a row, nothing is written
//! and the import fails.

use anyhow::{Context, bail};
use base64::Engine;
use grain::lexicon::{self, Lexicons};
use grain_serve::index::records::{self, Any};
use grain_serve::index::{migrate, record_uri, schema};
use rusqlite::types::{Value as Sql, ValueRef};
use rusqlite::{Connection, OpenFlags, OptionalExtension, ToSql};
use serde_json::{Map, Value, json};
use std::collections::BTreeSet;
use std::fmt;
use std::path::{Path, PathBuf};

/// The DID grain gives out labels as, where `GRAIN_PUBLIC_URL` names none.
pub const LABELER: &str = "did:web:grain.social";

pub const USAGE: &str = "usage: grain-import <hatk's grain.db> [--into <index>] [--strict]
         [--public-url <url>]
  reads hatk's database into the index at --into, or GRAIN_INDEX, which
  must be new or empty; --strict fails on any record that does not fit;
  the web sessions hatk held carry over for the client at --public-url,
  or GRAIN_PUBLIC_URL";

/// What `grain-import` was asked to do.
#[derive(Debug, Clone, PartialEq)]
pub struct Options {
    /// hatk's database.
    pub from: PathBuf,
    /// The index to make.
    pub into: PathBuf,
    /// Whether a record that does not fit its lexicon fails the import.
    pub strict: bool,
    /// Where the web is served, which names the client hatk's web
    /// sessions were granted to; none carries none.
    pub public_url: Option<String>,
}

/// The options `args` give, the index being
/// `GRAIN_INDEX` (by `var`) unless `--into` names one; or the usage.
pub fn parse_args(
    args: &[String],
    var: impl Fn(&str) -> Option<String>,
) -> Result<Options, String> {
    let mut from = None;
    let mut into = var("GRAIN_INDEX")
        .filter(|v| !v.is_empty())
        .map(PathBuf::from);
    let mut strict = false;
    let mut public_url = var("GRAIN_PUBLIC_URL").filter(|v| !v.is_empty());
    let mut it = args.iter();
    while let Some(arg) = it.next() {
        match arg.as_str() {
            "--into" => into = Some(it.next().ok_or("--into takes a path")?.into()),
            "--strict" => strict = true,
            "--public-url" => {
                public_url = Some(it.next().ok_or("--public-url takes a URL")?.into());
            }
            flag if flag.starts_with("--") => return Err(format!("{flag}: no such flag\n{USAGE}")),
            path if from.is_none() => from = Some(PathBuf::from(path)),
            extra => return Err(format!("{extra}: import reads one database\n{USAGE}")),
        }
    }
    let from = from.ok_or(USAGE)?;
    let into = into.ok_or("import needs --into or GRAIN_INDEX")?;
    Ok(Options {
        from,
        into,
        strict,
        public_url,
    })
}

/// `grain-import`, of its arguments `args`: the summary on stdout,
/// and the exit code, 0 when the index was written.
pub fn main(args: &[String], var: impl Fn(&str) -> Option<String>) -> i32 {
    let opts = match parse_args(args, var) {
        Ok(opts) => opts,
        Err(usage) => {
            eprintln!("{usage}");
            return 2;
        }
    };
    let public_url = opts.public_url.as_deref();
    match import(&opts.from, &opts.into, opts.strict, public_url) {
        Ok(summary) => {
            print!("{summary}");
            i32::from(!summary.written)
        }
        Err(e) => {
            eprintln!("grain-import: {e:#}");
            1
        }
    }
}

/// A table's rows in hatk and in the index.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Tally {
    /// The index's table.
    pub table: &'static str,
    /// What it was read from.
    pub from: String,
    /// Rows read.
    pub source: i64,
    /// Rows the index holds.
    pub imported: i64,
    /// Records refused: no CID, a URI not their author's, or not fitting
    /// their lexicon.
    pub invalid: i64,
    /// Records of a permissioned space.
    pub in_space: i64,
}

impl Tally {
    fn new(table: &'static str, from: &str) -> Tally {
        Tally {
            table,
            from: from.into(),
            ..Tally::default()
        }
    }
}

/// What an import read and wrote.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Summary {
    /// Each collection the index keeps.
    pub records: Vec<Tally>,
    /// Each table of what the network cannot rebuild, and `repo` and
    /// `stream_cursor`: these must hold every row read.
    pub kept: Vec<Tally>,
    /// Each record refused: its URI, and why.
    pub refused: Vec<(String, String)>,
    /// Each row of [`Summary::kept`] the index would not take, and why.
    pub failed: Vec<String>,
    /// `_repos.status` values hatk never wrote, and how many of each.
    pub unrecognized: Vec<(String, i64)>,
    /// hatk's web sessions, and how many carried over.
    pub sessions: Tally,
    /// Why none of them was, if none was.
    pub sessions_left: Option<String>,
    /// Whether the key of hatk's session cookies was carried.
    pub cookie_key: bool,
    /// hatk's tables not imported, and their rows.
    pub left: Vec<(String, i64)>,
    pub strict: bool,
    /// Whether the index was written: every kept table whole, and under
    /// `--strict`, no record refused.
    pub written: bool,
}

impl Summary {
    /// Whether the index may be written: see [`Summary::written`].
    pub fn ok(&self) -> bool {
        let whole = self.kept.iter().all(|t| t.source == t.imported);
        let refused = self.records.iter().any(|t| t.invalid > 0);
        whole && !(self.strict && refused)
    }
}

/// How many refusals the summary shows.
const REFUSALS_SHOWN: usize = 20;

impl fmt::Display for Summary {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let [r, h, i, x, p] = ["records", "in hatk", "imported", "invalid", "in a space"];
        writeln!(f, "{r:<52}{h:>10}{i:>10}{x:>10}{p:>12}")?;
        for t in &self.records {
            let name = format!("  {} ({})", t.table, t.from);
            let (s, i, x, p) = (t.source, t.imported, t.invalid, t.in_space);
            writeln!(f, "{name:<52}{s:>10}{i:>10}{x:>10}{p:>12}")?;
        }
        writeln!(f, "{:<52}{:>10}{:>10}", "kept whole", "in hatk", "imported")?;
        for t in &self.kept {
            let name = format!("  {} ({})", t.table, t.from);
            let check = if t.source == t.imported {
                "ok"
            } else {
                "DIFFERS"
            };
            writeln!(f, "{name:<52}{:>10}{:>10}  {check}", t.source, t.imported)?;
        }
        for why in &self.failed {
            writeln!(f, "not kept: {why}")?;
        }
        let t = &self.sessions;
        let name = format!("  {} ({})", t.table, t.from);
        writeln!(
            f,
            "{:<52}{:>10}{:>10}",
            "web sessions", "in hatk", "carried"
        )?;
        writeln!(f, "{name:<52}{:>10}{:>10}", t.source, t.imported)?;
        if let Some(why) = &self.sessions_left {
            writeln!(f, "  none carried: {why}")?;
        }
        let carried = if self.cookie_key {
            "carried"
        } else {
            "not carried: no appview-oauth-key"
        };
        writeln!(f, "  the session cookies' key: {carried}")?;
        for (status, n) in &self.unrecognized {
            let odd = format!("_repos.status {status:?}, which hatk never wrote: {n}");
            writeln!(f, "{odd}, made pending")?;
        }
        let shown = self.refused.len().min(REFUSALS_SHOWN);
        writeln!(f, "refused: {} records, {shown} shown", self.refused.len())?;
        for (uri, why) in self.refused.iter().take(shown) {
            writeln!(f, "  {uri}: {why}")?;
        }
        writeln!(f, "not imported:")?;
        for (table, n) in &self.left {
            writeln!(f, "  {table:<50}{n:>10}")?;
        }
        match (self.written, self.strict) {
            (true, _) => writeln!(f, "written"),
            (false, true) => writeln!(f, "nothing written: a table differs, or --strict refused"),
            (false, false) => writeln!(f, "nothing written: a table differs"),
        }
    }
}

/// A table of what the network cannot rebuild, and how it is copied.
pub struct Kept {
    /// The index's table.
    pub table: &'static str,
    /// hatk's, which may not be there in an old enough database.
    pub source: &'static str,
    /// What is read, for the summary.
    pub from: &'static str,
    /// The rows hatk has, which the index must hold as many of.
    pub count: &'static str,
    pub select: &'static str,
    /// Of the rows `select` reads, in order.
    pub insert: &'static str,
}

/// hatk's repo statuses, and what each is here ([the module](self)).
const REPO: &str = "SELECT did, handle,
   CASE WHEN status IN ('pending', 'active') THEN status
        WHEN status = 'failed' THEN CASE WHEN retry_count >= 5 THEN 'failed' ELSE 'pending' END
        WHEN status IN ('takendown', 'deactivated', 'deleted')
          THEN CASE WHEN rev IS NULL THEN 'pending' ELSE 'active' END
        ELSE 'pending' END,
   CASE WHEN status IN ('deactivated', 'deleted') THEN status END,
   rev, backfilled_at, retry_count, retry_after,
   CASE WHEN status NOT IN ('pending', 'active', 'failed', 'takendown', 'deactivated', 'deleted')
     THEN 'hatk had it ' || status END
 FROM _repos";

/// The statuses hatk writes to `_repos`.
const STATUSES: &str = "('pending', 'active', 'failed', 'takendown', 'deactivated', 'deleted')";

pub const KEPT: &[Kept] = &[
    Kept {
        table: "repo",
        source: "_repos",
        from: "_repos",
        count: "SELECT count(*) FROM _repos",
        select: REPO,
        insert: "INSERT INTO repo (did, handle, state, host_status, rev, backfilled_at,
                   retry_count, retry_after, last_error) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
    },
    Kept {
        table: "takedown",
        source: "_repos",
        from: "_repos, status takendown",
        count: "SELECT count(*) FROM _repos WHERE status = 'takendown'",
        select: "SELECT did, strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM _repos
                 WHERE status = 'takendown'",
        insert: "INSERT INTO takedown (did, at) VALUES (?1, ?2)",
    },
    Kept {
        table: "stream_cursor",
        source: "_cursor",
        from: "_cursor, jetstream:*",
        count: "SELECT count(*) FROM _cursor WHERE key LIKE 'jetstream:%'",
        // A cursor is a sequence number: one that is not is not copied,
        // and the counts differ.
        select: "SELECT key, CAST(value AS INTEGER) FROM _cursor
                 WHERE key LIKE 'jetstream:%' AND value GLOB '[0-9]*' AND value NOT GLOB '*[^0-9]*'",
        insert: "INSERT INTO stream_cursor (source, seq) VALUES (?1, ?2)",
    },
    Kept {
        table: "label",
        source: "_labels",
        from: "_labels",
        count: "SELECT count(*) FROM _labels",
        select: "SELECT id, src, uri, val, coalesce(neg, 0), cts, exp FROM _labels",
        insert: "INSERT INTO label (id, src, uri, val, neg, cts, exp)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
    },
    Kept {
        table: "report",
        source: "_reports",
        from: "_reports",
        count: "SELECT count(*) FROM _reports",
        select: "SELECT id, subject_uri, subject_did, label, reason, reported_by, status,
                   resolved_by, resolved_at, created_at FROM _reports",
        insert: "INSERT INTO report (id, subject_uri, subject_did, label, reason, reported_by,
                   status, resolved_by, resolved_at, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
    },
    Kept {
        table: "mute",
        source: "_mutes",
        from: "_mutes",
        count: "SELECT count(*) FROM _mutes",
        select: "SELECT did, subject, created_at FROM _mutes",
        insert: "INSERT INTO mute (did, subject, created_at) VALUES (?1, ?2, ?3)",
    },
    Kept {
        table: "preference",
        source: "_preferences",
        from: "_preferences, other keys",
        count: "SELECT count(*) FROM _preferences
                WHERE key NOT IN ('lastSeenNotifications', 'notificationPrefs')",
        select: "SELECT did, key, value, updated_at FROM _preferences
                 WHERE key NOT IN ('lastSeenNotifications', 'notificationPrefs')",
        insert: "INSERT INTO preference (did, key, value, updated_at) VALUES (?1, ?2, ?3, ?4)",
    },
    Kept {
        table: "notification_seen",
        source: "_preferences",
        from: "_preferences, lastSeenNotifications",
        count: "SELECT count(*) FROM _preferences WHERE key = 'lastSeenNotifications'",
        // A time that is not one is null, which the index does not take.
        select: "SELECT did, CASE WHEN json_valid(value)
                   THEN strftime('%Y-%m-%dT%H:%M:%fZ', value ->> '$') END
                 FROM _preferences WHERE key = 'lastSeenNotifications'",
        insert: "INSERT INTO notification_seen (did, seen_at) VALUES (?1, ?2)",
    },
    Kept {
        table: "notification_pref",
        source: "_preferences",
        from: "_preferences, notificationPrefs, a row a kind",
        count: "SELECT count(*) FROM _preferences p, json_each(CASE WHEN json_valid(p.value) THEN p.value ELSE '{}' END) k
                WHERE p.key = 'notificationPrefs' AND k.type = 'object'
                  AND k.key IN ('favorites', 'follows', 'comments', 'mentions')",
        select: "SELECT p.did, k.key, coalesce(json_type(k.value, '$.push') <> 'false', 1),
                   coalesce(json_type(k.value, '$.inApp') <> 'false', 1),
                   coalesce(k.value ->> '$.from' = 'follows', 0)
                 FROM _preferences p, json_each(CASE WHEN json_valid(p.value) THEN p.value ELSE '{}' END) k
                 WHERE p.key = 'notificationPrefs' AND k.type = 'object'
                   AND k.key IN ('favorites', 'follows', 'comments', 'mentions')",
        insert: "INSERT INTO notification_pref (did, kind, push, in_app, from_follows)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
    },
    Kept {
        table: "push_token",
        source: "_push_tokens",
        from: "_push_tokens",
        count: "SELECT count(*) FROM _push_tokens",
        // hatk named a device's platform by the service that delivers to
        // it; grain by the platform, as registerPush does.
        select: "SELECT did, token,
                   CASE platform WHEN 'apns' THEN 'ios' WHEN 'fcm' THEN 'android' ELSE platform END,
                   created_at FROM _push_tokens",
        insert: "INSERT INTO push_token (did, token, platform, created_at) VALUES (?1, ?2, ?3, ?4)",
    },
    Kept {
        table: "story_view",
        source: "_story_views",
        from: "_story_views",
        count: "SELECT count(*) FROM _story_views",
        select: "SELECT did, subject, created_at FROM _story_views",
        insert: "INSERT INTO story_view (did, subject, created_at) VALUES (?1, ?2, ?3)",
    },
    Kept {
        table: "oauth_key",
        source: "_oauth_keys",
        from: "_oauth_keys",
        count: "SELECT count(*) FROM _oauth_keys WHERE kid = 'pds-client-auth-key'",
        select: "SELECT kid, private_key FROM _oauth_keys WHERE kid = 'pds-client-auth-key'",
        insert: "INSERT INTO oauth_key (kid, jwk) VALUES (?1, ?2)",
    },
    Kept {
        table: "space_support",
        source: "_space_support",
        from: "_space_support",
        count: "SELECT count(*) FROM _space_support",
        select: "SELECT pds_endpoint, supported, missing, checked_at FROM _space_support",
        insert: "INSERT INTO space_support (pds_endpoint, supported, missing, checked_at)
                 VALUES (?1, ?2, ?3, ?4)",
    },
];

/// Reads hatk's database at `from` into a new index at `into`, `strict`
/// failing on any record refused; what it read and wrote. An error is one
/// that stopped it: nothing was written.
pub fn import(
    from: &Path,
    into: &Path,
    strict: bool,
    public_url: Option<&str>,
) -> anyhow::Result<Summary> {
    let labeler = match public_url {
        Some(url) => grain_serve::service_did(url)?,
        None => LABELER.to_string(),
    };
    let src = Connection::open_with_flags(from, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .with_context(|| format!("opening {}", from.display()))?;
    // One snapshot, for the counts to be of the rows read.
    src.execute_batch("BEGIN")?;
    let tables = names(&src)?;
    if !tables.contains("_repos") {
        bail!(
            "{} has no _repos: it is not hatk's database",
            from.display()
        );
    }
    let mut dst = empty_index(into)?;
    let tx = dst.transaction()?;
    let mut summary = Summary {
        strict,
        ..Summary::default()
    };
    let lexicons = Lexicons::grain();
    for (nsid, table) in records::COLLECTIONS {
        let tally = copy_records(&src, &tx, &lexicons, nsid, table, &mut summary.refused)?;
        summary.records.push(tally);
    }
    for kept in KEPT {
        let present = tables.contains(kept.source);
        summary
            .kept
            .push(copy_kept(&src, &tx, kept, present, &mut summary.failed)?);
    }
    let server = server_key(&src, &tables)?;
    summary.cookie_key = match &server {
        Some(jwk) => copy_cookie_key(&tx, jwk)?,
        None => false,
    };
    let carried = copy_sessions(&src, &tx, &tables, server.as_deref(), public_url)?;
    (summary.sessions, summary.sessions_left) = carried;
    let mine = "UPDATE label SET src = ?1 WHERE src NOT LIKE 'did:%'";
    tx.execute(mine, [&labeler])?;
    // A report names who made and closed it by DID, as atproto's do: the
    // old server's own reports (its classifiers', as `system:<name>`) and
    // its admin's closings are the server's, the old reporter kept at the
    // head of the reason.
    let ours = "UPDATE report SET reported_by = ?1, reason = reported_by
      || CASE WHEN reason IS NULL THEN '' ELSE ': ' || reason END
      WHERE reported_by NOT LIKE 'did:%'";
    tx.execute(ours, [&labeler])?;
    let closed = "UPDATE report SET resolved_by = ?1 WHERE resolved_by NOT LIKE 'did:%'";
    tx.execute(closed, [&labeler])?;
    let sql = format!(
        "SELECT status, count(*) FROM _repos WHERE status NOT IN {STATUSES} GROUP BY status"
    );
    let mut stmt = src.prepare(&sql)?;
    let odd = stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?;
    summary.unrecognized = odd.collect::<rusqlite::Result<_>>()?;
    let read: BTreeSet<&str> = records::COLLECTIONS
        .iter()
        .map(|(nsid, _)| *nsid)
        .chain(KEPT.iter().map(|k| k.source))
        .chain(summary.sessions_left.is_none().then_some("_oauth_sessions"))
        .collect();
    for table in tables.iter().filter(|t| !read.contains(t.as_str())) {
        // hatk's full-text search, a table and its shadows a collection.
        if !table.starts_with("_fts_") {
            let n = src.query_row(&format!("SELECT count(*) FROM \"{table}\""), [], |r| {
                r.get(0)
            })?;
            summary.left.push((table.clone(), n));
        }
    }
    summary.written = summary.ok();
    if summary.written {
        tx.commit()?;
        dst.execute_batch("PRAGMA journal_mode = WAL")?;
    }
    Ok(summary)
}

/// The tables `db` has, less SQLite's own.
fn names(db: &Connection) -> rusqlite::Result<BTreeSet<String>> {
    let sql = "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'";
    let mut stmt = db.prepare(sql)?;
    let names = stmt.query_map([], |r| r.get(0))?;
    names.collect()
}

/// The tables of `db` that hold rows of their own: not a virtual table,
/// such as full-text search's, nor the ones SQLite keeps it in.
fn own(db: &Connection) -> rusqlite::Result<BTreeSet<String>> {
    let sql = "SELECT name FROM pragma_table_list
               WHERE schema = 'main' AND type = 'table' AND name NOT LIKE 'sqlite_%'";
    let mut stmt = db.prepare(sql)?;
    let names = stmt.query_map([], |r| r.get(0))?;
    names.collect()
}

/// The index at `into`, made, or migrated if it is one already, so long as
/// it holds nothing; set for one large write.
fn empty_index(into: &Path) -> anyhow::Result<Connection> {
    let mut db = Connection::open(into).with_context(|| format!("opening {}", into.display()))?;
    let version: i64 = db.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    if let Some(table) = own(&db)?.first().filter(|_| version == 0) {
        bail!("{} is not an index: it has {table}", into.display());
    }
    migrate(&mut db, schema::MIGRATIONS)?;
    for table in own(&db)? {
        if db
            .prepare(&format!("SELECT 1 FROM \"{table}\""))?
            .exists([])?
        {
            bail!(
                "{} holds {table} already: import only into a new or empty index",
                into.display()
            );
        }
    }
    // A new file, written in one transaction: its journal holds next to
    // nothing, where the WAL would hold the whole index once over.
    db.execute_batch("PRAGMA journal_mode = DELETE; PRAGMA cache_size = -262144;")?;
    Ok(db)
}

/// How hatk kept a field, by its lexicon.
#[derive(Debug, Clone, Copy, PartialEq)]
enum Kind {
    /// A string or an integer, as itself.
    Scalar,
    /// Bytes, or a list of them, as hatk wrote them ([`bytes`]).
    Bytes,
    /// Anything else, as its JSON.
    Json,
}

fn kind(schema: &Value) -> Kind {
    match (schema["type"].as_str(), schema["items"]["type"].as_str()) {
        (Some("bytes"), _) | (Some("array"), Some("bytes")) => Kind::Bytes,
        (Some("string" | "integer"), _) => Kind::Scalar,
        _ => Kind::Json,
    }
}

/// hatk's column for the record field `field`: the field in snake case, as
/// hatk's `toSnakeCase` makes it, `iSO` `i_s_o`. (hatk names one that is an
/// envelope column otherwise, which no collection here has.)
fn column(field: &str) -> String {
    let mut snake = String::new();
    for c in field.chars() {
        if c.is_ascii_uppercase() {
            snake.push('_');
        }
        snake.push(c.to_ascii_lowercase());
    }
    snake
}

/// The value of a field of `kind` hatk kept as `v`, as its record has it.
/// One that is not what its kind says is passed on as it is, for its
/// lexicon to refuse.
fn value(kind: Kind, v: ValueRef) -> Value {
    let text = match v {
        ValueRef::Null => return Value::Null,
        ValueRef::Integer(i) => return i.into(),
        ValueRef::Real(f) => return f.into(),
        ValueRef::Blob(b) => return encoded(b),
        ValueRef::Text(t) => String::from_utf8_lossy(t).into_owned(),
    };
    match kind {
        Kind::Scalar => Value::String(text),
        Kind::Bytes => match listed(&text) {
            Some(b) => encoded(&b),
            None => bytes(json_or_text(text)),
        },
        Kind::Json => json_or_text(text),
    }
}

fn json_or_text(text: String) -> Value {
    serde_json::from_str(&text).unwrap_or(Value::String(text))
}

/// Bytes as a record's JSON has them.
fn encoded(b: &[u8]) -> Value {
    json!({"$bytes": base64::engine::general_purpose::STANDARD_NO_PAD.encode(b)})
}

/// Bytes as a Uint8Array's `String()` writes them, `3,55,54`: how hatk
/// kept a bytes field of a record read from a repo.
fn listed(text: &str) -> Option<Vec<u8>> {
    if text.is_empty() {
        return Some(Vec::new());
    }
    text.split(',').map(|n| n.parse().ok()).collect()
}

/// Bytes in hatk's JSON made a record's: `{"$bytes": …}`, as Jetstream
/// sends them, stays; a Uint8Array's own JSON, `{"0": 3, "1": 55}`, as
/// hatk wrote one read from a repo, is made so; a list, each of its items.
fn bytes(v: Value) -> Value {
    match v {
        Value::Array(items) => Value::Array(items.into_iter().map(bytes).collect()),
        Value::Object(o) => match numbered(&o) {
            Some(b) => encoded(&b),
            None => Value::Object(o),
        },
        other => other,
    }
}

fn numbered(o: &Map<String, Value>) -> Option<Vec<u8>> {
    (0..o.len())
        .map(|i| o.get(&i.to_string())?.as_u64()?.try_into().ok())
        .collect()
}

/// Copies hatk's table of `nsid`, if it has one, into `table`, keeping
/// those of `refused` it refuses.
fn copy_records(
    src: &Connection,
    dst: &Connection,
    lexicons: &Lexicons,
    nsid: &str,
    table: &'static str,
    refused: &mut Vec<(String, String)>,
) -> anyhow::Result<Tally> {
    let mut tally = Tally::new(table, nsid);
    let mut info = src.prepare(&format!("SELECT name FROM pragma_table_info('{nsid}')"))?;
    let have = info.query_map([], |r| r.get(0))?;
    let have = have.collect::<rusqlite::Result<BTreeSet<String>>>()?;
    if have.is_empty() {
        return Ok(tally);
    }
    let doc = lexicons
        .get(nsid)
        .context("a collection the index keeps has a lexicon")?;
    let properties = doc["defs"]["main"]["record"]["properties"].as_object();
    let fields: Vec<(&str, Kind)> = properties
        .into_iter()
        .flatten()
        .map(|(name, schema)| (name.as_str(), kind(schema)))
        .collect();
    let pick = |c: String| {
        if have.contains(&c) {
            format!("\"{c}\"")
        } else {
            "NULL".into()
        }
    };
    let picked: Vec<String> = fields.iter().map(|(f, _)| pick(column(f))).collect();
    let sql = format!(
        "SELECT uri, cid, did, indexed_at, {space}, {picked} FROM \"{nsid}\"",
        space = pick("space".into()),
        picked = picked.join(", "),
    );
    let columns = records::COLUMNS
        .iter()
        .find(|(t, _)| *t == table)
        .map(|(_, c)| *c)
        .context("a table the index keeps has columns")?;
    let insert = format!(
        "INSERT INTO {table} (uri, cid, did, indexed_at, {names}) VALUES (?1, ?2, ?3, ?4, {slots})",
        names = columns.join(", "),
        slots = (5..5 + columns.len())
            .map(|i| format!("?{i}"))
            .collect::<Vec<_>>()
            .join(", "),
    );
    let mut insert = dst.prepare(&insert)?;
    let mut label = dst.prepare("INSERT OR IGNORE INTO self_label VALUES (?1, ?2)")?;
    let mut stmt = src.prepare(&sql)?;
    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        tally.source += 1;
        if row.get_ref(4)? != ValueRef::Null {
            tally.in_space += 1;
            continue;
        }
        let (uri, cid, did, indexed_at): (String, Option<String>, String, String) =
            (row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?);
        let mut record = Map::new();
        record.insert("$type".into(), nsid.into());
        for (i, (field, kind)) in fields.iter().enumerate() {
            let v = value(*kind, row.get_ref(5 + i)?);
            if !v.is_null() {
                record.insert(field.to_string(), v);
            }
        }
        let record = Value::Object(record);
        let (cid, parsed) = match checked(lexicons, nsid, &uri, cid, &did, &record) {
            Ok(checked) => checked,
            Err(why) => {
                tally.invalid += 1;
                refused.push((uri, why));
                continue;
            }
        };
        let mut values: Vec<&dyn ToSql> = vec![&uri, &cid, &did, &indexed_at];
        values.extend(parsed.params());
        insert.execute(&*values)?;
        for val in records::self_labels(&record) {
            label.execute([uri.as_str(), val])?;
        }
        tally.imported += 1;
    }
    Ok(tally)
}

/// The record hatk had at `uri`, of `cid`, by `did`, as its row, if it is
/// one the index takes; or why not.
fn checked(
    lexicons: &Lexicons,
    nsid: &str,
    uri: &str,
    cid: Option<String>,
    did: &str,
    record: &Value,
) -> Result<(String, Any), String> {
    let cid = cid.filter(|c| lexicon::valid_cid(c)).ok_or("no CID")?;
    if record_uri(uri).is_none_or(|(by, of, _)| by != did || of != nsid) {
        return Err(format!("not a URI of {did}'s {nsid}"));
    }
    lexicons
        .validate_indexed(nsid, record)
        .map_err(|e| e.to_string())?;
    let row = Any::parse(nsid, record).and_then(Result::ok);
    Ok((cid, row.ok_or("does not make its row")?))
}

/// Copies `kept`, from hatk's table if it is `present`, keeping in
/// `failed` each row the index would not take.
fn copy_kept(
    src: &Connection,
    dst: &Connection,
    kept: &Kept,
    present: bool,
    failed: &mut Vec<String>,
) -> anyhow::Result<Tally> {
    let mut tally = Tally::new(kept.table, kept.from);
    if present {
        tally.source = src.query_row(kept.count, [], |r| r.get(0))?;
        let mut insert = dst.prepare(kept.insert)?;
        let mut stmt = src.prepare(kept.select)?;
        let n = stmt.column_count();
        let mut rows = stmt.query([])?;
        while let Some(row) = rows.next()? {
            let values = (0..n).map(|i| row.get::<_, Sql>(i));
            let values = values.collect::<rusqlite::Result<Vec<_>>>()?;
            if let Err(e) = insert.execute(rusqlite::params_from_iter(&values)) {
                failed.push(format!("{} {:?}: {e}", kept.table, values[0]));
            }
        }
    }
    let count = format!("SELECT count(*) FROM {}", kept.table);
    tally.imported = dst.query_row(&count, [], |r| r.get(0))?;
    Ok(tally)
}

/// hatk's web sessions, `_oauth_sessions`, carried into `web_session`
/// as [the module](self) says: how many there were and were carried, and
/// why none was, if none was.
fn copy_sessions(
    src: &Connection,
    dst: &Connection,
    tables: &BTreeSet<String>,
    server: Option<&str>,
    public_url: Option<&str>,
) -> anyhow::Result<(Tally, Option<String>)> {
    let mut tally = Tally::new("web_session", "_oauth_sessions");
    if !tables.contains("_oauth_sessions") {
        return Ok((tally, Some("hatk kept no sessions".into())));
    }
    tally.source = src.query_row("SELECT count(*) FROM _oauth_sessions", [], |r| r.get(0))?;
    let Some(url) = public_url.map(|u| u.trim_end_matches('/')) else {
        return Ok((tally, Some("no --public-url or GRAIN_PUBLIC_URL".into())));
    };
    let Some(key) = server.and_then(|jwk| grain_serve::login::from_jwk(jwk).ok()) else {
        let why = format!("no {SERVER_KID} to prove them with");
        return Ok((tally, Some(why)));
    };
    let jkt = thumbprint(&key);
    let dpop = base64::engine::general_purpose::STANDARD.encode(key.to_bytes());
    // Columns a hatk from before them lacks are read as none.
    let has: BTreeSet<String> = {
        let mut stmt = src.prepare("SELECT name FROM pragma_table_info('_oauth_sessions')")?;
        let names = stmt.query_map([], |r| r.get(0))?;
        names.collect::<rusqlite::Result<_>>()?
    };
    let column = |name: &str| match has.contains(name) {
        true => format!("s.{name}"),
        false => "NULL".into(),
    };
    let sql = format!(
        "SELECT s.did, coalesce(r.handle, ''), s.pds_endpoint, s.access_token, s.refresh_token,
           s.dpop_jkt, {}, {}, {}, {}
         FROM _oauth_sessions s LEFT JOIN _repos r ON r.did = s.did",
        column("pds_auth_server"),
        column("pds_token_endpoint"),
        column("token_expires_at"),
        column("requested_scope"),
    );
    let mut stmt = src.prepare(&sql)?;
    let mut rows = stmt.query([])?;
    let mut insert = dst.prepare("INSERT INTO web_session VALUES (?1, ?2, 0, ?3)")?;
    let now = grain::keys::now_micros() as i64;
    while let Some(row) = rows.next()? {
        let (did, handle, pds): (String, String, String) = (row.get(0)?, row.get(1)?, row.get(2)?);
        let (access, refresh, bound): (String, Option<String>, String) =
            (row.get(3)?, row.get(4)?, row.get(5)?);
        let Some(refresh) = refresh.filter(|_| bound == jkt) else {
            continue;
        };
        let issuer: String = row
            .get::<_, Option<String>>(6)?
            .unwrap_or_else(|| pds.clone());
        let token = row.get::<_, Option<String>>(7)?;
        let token_endpoint = token.unwrap_or_else(|| format!("{issuer}/oauth/token"));
        let session = grain::session::Session {
            did: did.clone(),
            handle,
            service: pds,
            access_jwt: access,
            refresh_jwt: refresh,
            oauth: Some(grain::session::OAuth {
                key: dpop.clone(),
                issuer,
                token_endpoint,
                revocation_endpoint: None,
                client_id: Some(format!("{url}{}", grain_serve::login::METADATA)),
                loopback_id: None,
                scope: row.get(9)?,
                expires_at: row.get::<_, Option<i64>>(8)?.unwrap_or(0).max(0) as u64,
            }),
        };
        let json = serde_json::to_string(&session)?;
        insert.execute(rusqlite::params![did, json, now])?;
        tally.imported += 1;
    }
    Ok((tally, None))
}

/// hatk's own key, which every session it held was bound to, and which
/// sealed its session cookies.
const SERVER_KID: &str = "appview-oauth-key";

/// [`SERVER_KID`]'s private JWK, as hatk kept it, if it did.
fn server_key(src: &Connection, tables: &BTreeSet<String>) -> rusqlite::Result<Option<String>> {
    if !tables.contains("_oauth_keys") {
        return Ok(None);
    }
    let sql = "SELECT private_key FROM _oauth_keys WHERE kid = ?1";
    src.query_row(sql, [SERVER_KID], |r| r.get(0)).optional()
}

/// The key hatk's session cookies were sealed under, drawn from `jwk` as
/// [the module](self) says.
pub fn cookie_key(jwk: &str) -> anyhow::Result<[u8; 32]> {
    let jwk: std::collections::BTreeMap<String, Value> = serde_json::from_str(jwk)?;
    let ikm = serde_json::to_vec(&jwk)?;
    let mut key = [0u8; 32];
    hkdf::Hkdf::<sha2::Sha256>::new(None, &ikm)
        .expand(b"hatk-session-cookie", &mut key)
        .expect("32 bytes is a length HKDF gives");
    Ok(key)
}

/// Keeps the key of the cookies hatk sealed under `jwk` as
/// `carried_cookie_key`; whether `jwk` was one to draw it from.
fn copy_cookie_key(dst: &Connection, jwk: &str) -> anyhow::Result<bool> {
    let Ok(key) = cookie_key(jwk) else {
        return Ok(false);
    };
    dst.execute(
        "INSERT INTO carried_cookie_key (key) VALUES (?1)",
        [&key[..]],
    )?;
    Ok(true)
}

/// The JWK thumbprint of `key`'s public half (RFC 7638), as a session's
/// `dpop_jkt` names the key it is bound to.
fn thumbprint(key: &grain::crypto::P256Key) -> String {
    let jwk = key.jwk();
    let canonical = format!(
        r#"{{"crv":"P-256","kty":"EC","x":{},"y":{}}}"#,
        jwk["x"], jwk["y"]
    );
    let digest = <sha2::Sha256 as sha2::Digest>::digest(canonical.as_bytes());
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(digest)
}

#[cfg(test)]
mod tests;
