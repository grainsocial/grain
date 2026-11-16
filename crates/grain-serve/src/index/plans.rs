//! Whether the index's queries hold up at the size of the network, not
//! only of a test's: each scan of a table that grows with what people do
//! is found as the tests run, and said, so a query that reads all of
//! `photo` or `favorite` for each row fails the test check before it
//! reaches prod.
//!
//! With [`ENV`] naming a directory, the connection each [`Index`] opens
//! hands each statement it runs, once, to a planner: a database of the
//! index's tables, empty, that says the sizes of prod's (`sqlite_stat1`),
//! so SQLite plans as it would there rather than for the empty tables of a
//! test, where a scan costs nothing. Its `EXPLAIN QUERY PLAN` naming a
//! `SCAN` of one of [`GROWING`], or a sort of the rows a range of one
//! gives ([`sorts`]), is written to that directory, a line of JSON for
//! each statement, and `harness/plans.mjs` fails on any.
//!
//! A scan meant to be is said so in the SQL, beside it, with why:
//! `-- scans: photo, as only the operator asks, once a day`; a sort meant
//! to be, `-- sorts: photo, …`.
//!
//! [`Index`]: super::Index

use rusqlite::Connection;
use serde_json::json;
use std::collections::{HashMap, HashSet};
use std::io::Write;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

/// The directory the scans found are written to; none checks nothing.
pub const ENV: &str = "GRAIN_PLANS";

/// The tables that grow with what people do, as many rows as prod might
/// hold: a scan of one is a scan of the network. The rest (the stream's
/// cursors, takedowns, the server's own keys) are said to be small, as a
/// scan of them is.
pub const GROWING: [&str; 35] = [
    "gallery",
    "gallery_item",
    "photo",
    "photo_exif",
    "profile",
    "follow",
    "block",
    "favorite",
    "comment",
    "story",
    "story_view",
    "mention",
    "group_item",
    "group_submission",
    "group_decline",
    "group_declaration",
    "bsky_post",
    "bsky_follow",
    "germ_declaration",
    "self_label",
    "repo",
    "label",
    "report",
    "mute",
    "preference",
    "push_token",
    "push_record",
    "record_rev",
    "search_doc",
    "profile_search",
    "gallery_search",
    "notification_seen",
    "notification_pref",
    "web_session",
    "classification",
];

/// The rows a growing table is said to hold, and a small one.
pub const MANY: u64 = 1_000_000;
const FEW: u64 = 1_000;

/// The words after which no alias follows a table's name.
const KEYWORDS: [&str; 24] = [
    "ON",
    "WHERE",
    "JOIN",
    "LEFT",
    "CROSS",
    "INNER",
    "OUTER",
    "NATURAL",
    "GROUP",
    "ORDER",
    "LIMIT",
    "USING",
    "UNION",
    "EXCEPT",
    "INTERSECT",
    "SELECT",
    "WITH",
    "HAVING",
    "WINDOW",
    "VALUES",
    "SET",
    "RETURNING",
    "INDEXED",
    "NOT",
];

static PLANNER: OnceLock<Option<Planner>> = OnceLock::new();

/// Whether the statements run are planned: when [`ENV`] asks.
pub fn planning() -> bool {
    let planner =
        PLANNER.get_or_init(|| std::env::var_os(ENV).and_then(|d| Planner::new(d.into()).ok()));
    planner.is_some()
}

/// Plans `sql`, a statement run, if they are planned ([`planning`]).
pub fn check(sql: &str) {
    if let Some(Some(planner)) = PLANNER.get() {
        planner.check(sql);
    }
}

/// A step of a plan: its own id, the one it is under, and what it says.
struct Step {
    id: i64,
    parent: i64,
    detail: String,
}

/// The index's tables, at prod's size, and where what it finds goes.
pub struct Planner {
    db: Mutex<Connection>,
    /// The index's tables, by name.
    tables: HashSet<String>,
    dir: PathBuf,
    /// The statements planned already, as written.
    seen: Mutex<HashSet<String>>,
    written: Mutex<()>,
}

impl Planner {
    /// One planning into `dir`.
    pub fn new(dir: PathBuf) -> anyhow::Result<Planner> {
        let mut db = Connection::open_in_memory()?;
        super::migrate(&mut db, super::schema::MIGRATIONS)?;
        let tables = names(&db)?;
        sized(
            &db,
            |table| {
                if GROWING.contains(&table) { MANY } else { FEW }
            },
        )?;
        Ok(Planner {
            db: Mutex::new(db),
            tables,
            dir,
            seen: Mutex::default(),
            written: Mutex::default(),
        })
    }

    /// Plans `sql`, the first time it is run, and writes each growing
    /// table it scans, or sorts a range of, that it does not say it does.
    pub fn check(&self, sql: &str) {
        // Its first word past the comments before it.
        let code = sql
            .lines()
            .map(str::trim)
            .find(|l| !l.is_empty() && !l.starts_with("--"));
        let first = code
            .and_then(|l| l.split_whitespace().next())
            .unwrap_or_default();
        let read = ["SELECT", "WITH", "INSERT", "UPDATE", "DELETE", "REPLACE"];
        if !read.iter().any(|r| first.eq_ignore_ascii_case(r)) {
            return;
        }
        if !self.seen.lock().unwrap().insert(sql.to_string()) {
            return;
        }
        let steps = self.plan(sql);
        let plan: Vec<String> = steps.iter().map(|s| s.detail.clone()).collect();
        let scanned = scans(sql, &plan);
        let sorted = sorts(sql, &steps, &self.tables);
        if scanned.is_empty() && sorted.is_empty() {
            return;
        }
        let line = json!({ "scans": scanned, "sorts": sorted, "plan": plan, "sql": sql });
        // One line at a time, as the tests of a binary run side by side.
        let _written = self.written.lock().unwrap();
        let _ = std::fs::create_dir_all(&self.dir);
        let file = self.dir.join(format!("{}.jsonl", std::process::id()));
        let file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(file);
        if let Ok(mut file) = file {
            let _ = file.write_all(format!("{line}\n").as_bytes());
        }
    }

    /// What `EXPLAIN QUERY PLAN` says of `sql`, a step a line: none for
    /// one it cannot plan, as one of tables this index does not keep.
    fn plan(&self, sql: &str) -> Vec<Step> {
        let db = self.db.lock().unwrap();
        let explained = db.prepare(&format!("EXPLAIN QUERY PLAN {sql}"));
        let Ok(mut stmt) = explained else {
            return Vec::new();
        };
        // Unbound, as its parameters do not change its plan.
        let mut rows = stmt.raw_query();
        let mut steps = Vec::new();
        while let Ok(Some(row)) = rows.next() {
            steps.extend(step(row).ok());
        }
        steps
    }
}

/// The names of the tables in `db`.
fn names(db: &Connection) -> rusqlite::Result<HashSet<String>> {
    let mut stmt = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'")?;
    let names = stmt.query_map([], |row| row.get(0))?;
    names.collect()
}

fn step(row: &rusqlite::Row) -> rusqlite::Result<Step> {
    let (id, parent, detail) = (row.get(0)?, row.get(1)?, row.get(3)?);
    Ok(Step { id, parent, detail })
}

/// `db`'s tables said to be as large as `rows` says each is, and each
/// index's first column to pick out a hundred, each column after it
/// fewer, so SQLite plans as it would on prod's.
pub fn sized(db: &Connection, rows: impl Fn(&str) -> u64) -> rusqlite::Result<()> {
    db.execute_batch("ANALYZE; DELETE FROM sqlite_stat1;")?;
    let listed = |sql: &str, arg: &str| -> rusqlite::Result<Vec<(String, bool)>> {
        let mut stmt = db.prepare(sql)?;
        let rows = stmt.query_map([arg], |r| Ok((r.get(0)?, r.get(1)?)))?;
        rows.collect()
    };
    let tables = listed(
        "SELECT name, 0 FROM sqlite_master WHERE type = 'table' AND name NOT LIKE ?1",
        "sqlite_%",
    )?;
    for (table, _) in tables {
        let n = rows(&table);
        let sql = "INSERT INTO sqlite_stat1 VALUES (?1, NULL, ?2)";
        db.execute(sql, [&table, &n.to_string()])?;
        for (index, unique) in listed("SELECT name, \"unique\" FROM pragma_index_list(?1)", &table)?
        {
            let sql = "SELECT count(*) FROM pragma_index_info(?1)";
            let columns: u32 = db.query_row(sql, [&index], |r| r.get(0))?;
            let sql = "INSERT INTO sqlite_stat1 VALUES (?1, ?2, ?3)";
            db.execute(sql, [&table, &index, &stat(n, unique, columns)])?;
        }
    }
    db.execute_batch("ANALYZE sqlite_schema;")
}

/// An index's `sqlite_stat1` line: its table's rows, then how many each
/// prefix of its `columns` picks out, the whole of a `unique` one one.
fn stat(rows: u64, unique: bool, columns: u32) -> String {
    let mut stat = rows.to_string();
    for i in 0..columns {
        let picked = if unique && i + 1 == columns {
            1
        } else {
            (100 / 10u64.pow(i)).max(2)
        };
        stat += &format!(" {picked}");
    }
    stat
}

/// The growing tables `plan` scans that `sql` does not say it does
/// ([`said`]), each once. A step names a table by its alias, which is
/// read from `sql`; one alias of several tables is any of them.
pub fn scans(sql: &str, plan: &[String]) -> Vec<String> {
    let scanned = plan
        .iter()
        .filter_map(|step| step.strip_prefix("SCAN "))
        .filter(|rest| !matched(rest));
    growing(sql, "scans", scanned)
}

/// Whether the `SCAN` step `rest` reads a virtual table through a
/// constraint, as a full-text search reads its table through the match,
/// which is its index: the rows it gives are those the search finds.
fn matched(rest: &str) -> bool {
    rest.contains(" VIRTUAL TABLE INDEX ") && !rest.ends_with(':')
}

/// The growing tables `steps` sort many rows of, as a temporary B-tree
/// for `ORDER BY`, `GROUP BY` or `DISTINCT` does, that `sql` does not say
/// it sorts (`-- sorts:`), of `tables`, the index's. A sort's rows are
/// those of the loop beside it, and of the queries that loop runs in turn
/// (not a subquery's, which gives each row a value). A search of an index
/// by equality gives few; a scan gives many, as does a range that leads
/// the search, `(created_at>?)`, and any search run for each row of a scan
/// before it in its loop: an account's photos, for every account. A
/// full-text match gives what it finds ([`matched`]), whose ranking is the
/// search's own.
fn sorts(sql: &str, steps: &[Step], tables: &HashSet<String>) -> Vec<String> {
    let aliases = aliases(sql);
    let table = |step: &str| {
        let name = step.split_whitespace().next().unwrap_or_default();
        let named = aliases.get(name).map(Vec::as_slice).unwrap_or_default();
        tables.contains(name) || named.iter().any(|t| tables.contains(t))
    };
    // Not a sort of ties alone (`LAST TERM OF ORDER BY`), as rows come
    // in an index's order, which a limit stops.
    let whole =
        |s: &&Step| s.detail.starts_with("USE TEMP B-TREE FOR ") && !s.detail.contains(" OF ");
    let sorting = steps.iter().filter(whole);
    let mut many = Vec::new();
    for sort in sorting {
        let mut under = vec![sort.parent];
        while let Some(parent) = under.pop() {
            let mut scanned = false;
            for s in steps
                .iter()
                .filter(|s| s.parent == parent && s.id != sort.id)
            {
                if !s.detail.contains("SUBQUERY") || s.detail.contains("MOST SUBQUERY") {
                    under.push(s.id);
                }
                let step = s.detail.strip_prefix("SCAN ");
                if let Some(step) = step.filter(|step| !matched(step)) {
                    scanned |= table(step);
                    many.push(step);
                }
                let search = s.detail.strip_prefix("SEARCH ");
                many.extend(search.filter(|step| scanned || ranged(step)));
            }
        }
    }
    growing(sql, "sorts", many.into_iter())
}

/// Whether the search `step` is of a range from its first column on, as
/// `t USING INDEX x (created_at>?)`, not `(did=? AND created_at>?)`.
fn ranged(step: &str) -> bool {
    let terms = step.split_once(" (").map(|(_, t)| t.replace("<expr>", ""));
    let first = terms.as_deref().and_then(|t| t.split(" AND ").next());
    first.is_some_and(|t| t.contains(['<', '>']))
}

/// The growing tables of `named`, plan steps' words past `SCAN` or
/// `SEARCH` naming each by its alias, which is read from `sql`, each once
/// and not those `sql` says it does as `-- <what>:`. One alias of several
/// tables is any of them.
fn growing<'a>(sql: &str, what: &str, named: impl Iterator<Item = &'a str>) -> Vec<String> {
    let aliases = aliases(sql);
    let said = said(sql, what);
    let mut found = Vec::new();
    for rest in named {
        let name = rest.split_whitespace().next().unwrap_or_default();
        let own = [name.to_string()];
        let tables = aliases.get(name).map_or(&own[..], Vec::as_slice);
        for table in tables {
            if GROWING.contains(&table.as_str()) && !said.contains(table) && !found.contains(table)
            {
                found.push(table.clone());
            }
        }
    }
    found
}

/// The tables `sql` says it scans, or sorts, as `what` is: each a
/// comment's line names, as `-- scans: photo, favorite, for the operator
/// alone`, up to the words that say why.
fn said(sql: &str, what: &str) -> HashSet<String> {
    let mark = format!("-- {what}:");
    let lines = sql.split(&mark).skip(1);
    let first = |l: &str| l.lines().next().unwrap_or_default().to_string();
    let named = lines.map(first).flat_map(|l| {
        let parts: Vec<String> = l.split(',').map(|p| p.trim().to_string()).collect();
        parts
            .into_iter()
            .take_while(|p| !p.is_empty() && !p.contains(' '))
    });
    named.collect()
}

/// The tables each alias in `sql` names, as `FROM photo p` and `JOIN
/// favorite f`, and `FROM a x, b y`; a table-valued function's none.
fn aliases(sql: &str) -> HashMap<String, Vec<String>> {
    let mut tokens = Vec::new();
    let mut word = String::new();
    for c in sql.chars() {
        if c.is_ascii_alphanumeric() || c == '_' {
            word.push(c);
            continue;
        }
        if !word.is_empty() {
            tokens.push(std::mem::take(&mut word));
        }
        if matches!(c, ',' | '(' | ')') {
            tokens.push(c.to_string());
        }
    }
    tokens.extend((!word.is_empty()).then_some(word));
    let keyword = |t: &str| {
        matches!(t, "," | "(" | ")") || KEYWORDS.iter().any(|k| t.eq_ignore_ascii_case(k))
    };
    let mut aliases: HashMap<String, Vec<String>> = HashMap::new();
    let mut i = 0;
    while i < tokens.len() {
        let from = ["FROM", "JOIN"]
            .iter()
            .any(|k| tokens[i].eq_ignore_ascii_case(k));
        i += 1;
        let mut listed = from;
        while listed && i < tokens.len() && !keyword(&tokens[i]) {
            let table = tokens[i].clone();
            i += 1;
            if tokens.get(i).is_some_and(|t| t == "(") {
                break;
            }
            if tokens.get(i).is_some_and(|t| t.eq_ignore_ascii_case("AS")) {
                i += 1;
            }
            let alias = tokens.get(i).filter(|t| !keyword(t)).cloned();
            let alias = alias.inspect(|_| i += 1).unwrap_or_else(|| table.clone());
            aliases.entry(alias).or_default().push(table);
            listed = tokens.get(i).is_some_and(|t| t == ",");
            i += usize::from(listed);
        }
    }
    aliases
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_scan_of_a_growing_table_is_written() {
        let dir = tempfile::tempdir().unwrap();
        let planner = Planner::new(dir.path().join("plans")).unwrap();
        // Each statement is planned once, however many times it runs.
        let scanning = "SELECT uri FROM photo p WHERE p.alt LIKE '%x%'";
        planner.check(scanning);
        planner.check(scanning);
        // By an index, said to scan, small, not a query, not of this index.
        planner.check("SELECT uri FROM photo WHERE did = ?1");
        // One with parameters is planned as well, unbound.
        let bound = "SELECT uri FROM comment c WHERE c.text > ?1";
        planner.check(bound);
        planner.check("SELECT uri FROM photo -- scans: photo, as the test says\n WHERE alt > ''");
        planner.check("SELECT did FROM takedown WHERE did > ''");
        planner.check("PRAGMA user_version");
        // One opening with a comment is planned as well.
        let commented = "-- What it is for.\nSELECT did FROM favorite WHERE uri LIKE ?1";
        planner.check(commented);
        planner.check("SELECT * FROM nothing_here");
        // A full-text search reads its table by its match.
        planner.check("SELECT rowid FROM gallery_search WHERE gallery_search MATCH ?1");
        let written: Vec<serde_json::Value> = std::fs::read_dir(dir.path().join("plans"))
            .unwrap()
            .flat_map(|f| {
                std::fs::read_to_string(f.unwrap().path())
                    .unwrap()
                    .lines()
                    .map(String::from)
                    .collect::<Vec<_>>()
            })
            .map(|l| serde_json::from_str(&l).unwrap())
            .collect();
        let said: Vec<_> = written
            .iter()
            .map(|w| (w["sql"].clone(), w["scans"].clone()))
            .collect();
        assert_eq!(
            said,
            [
                (json!(scanning), json!(["photo"])),
                (json!(bound), json!(["comment"])),
                (json!(commented), json!(["favorite"]))
            ]
        );
    }

    #[test]
    fn every_growing_table_is_one_of_the_index() {
        let dir = tempfile::tempdir().unwrap();
        let planner = Planner::new(dir.path().to_path_buf()).unwrap();
        for table in GROWING {
            assert!(planner.tables.contains(table), "{table}");
        }
    }

    #[test]
    fn steps_name_tables_by_their_aliases() {
        let sql =
            "SELECT 1 FROM photo p, json_each(p.exif) j JOIN favorite AS f ON f.subject = p.uri
            CROSS JOIN stream_cursor p LEFT JOIN story WHERE x IN (SELECT 1 FROM comment)";
        let steps = |s: &[&str]| s.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        assert_eq!(
            scans(
                sql,
                &steps(&[
                    "SCAN p",
                    "SCAN f",
                    "SCAN j VIRTUAL TABLE INDEX 1:",
                    "SCAN story",
                    "SCAN comment",
                    "SEARCH photo USING INDEX x (y=?)"
                ])
            ),
            ["photo", "favorite", "story", "comment"]
        );
        assert!(scans(sql, &steps(&["SCAN CONSTANT ROW", "SCAN j"])).is_empty());
        let marked = format!("-- scans: photo, favorite, as a test says\n{sql} -- scans: story");
        assert_eq!(
            scans(
                &marked,
                &steps(&["SCAN p", "SCAN f", "SCAN story", "SCAN comment"])
            ),
            ["comment"]
        );
        assert_eq!(stat(MANY, true, 2), "1000000 100 1");
    }

    #[test]
    fn a_sort_of_a_range_of_a_growing_table_is_found() {
        let steps = |s: &[(i64, i64, &str)]| {
            let step = |&(id, parent, detail): &(i64, i64, &str)| Step {
                id,
                parent,
                detail: detail.to_string(),
            };
            s.iter().map(step).collect::<Vec<_>>()
        };
        let tables: HashSet<String> = [
            "photo",
            "comment",
            "story",
            "favorite",
            "stream_cursor",
            "repo",
        ]
        .map(String::from)
        .into();
        let sql = "SELECT 1 FROM photo f JOIN comment c JOIN story s JOIN favorite p
            JOIN stream_cursor r JOIN repo o, json_each(o.value) j";
        let sorted = steps(&[
            (2, 0, "SEARCH f USING INDEX photo_created (<expr>>?)"),
            (
                3,
                0,
                "SEARCH c USING INDEX comment_subject (subject=? AND created_at<?)",
            ),
            (4, 0, "CORRELATED SCALAR SUBQUERY 1"),
            (5, 4, "SEARCH s USING INDEX story_did (did>?)"),
            (6, 0, "COMPOUND QUERY"),
            (7, 6, "LEFT-MOST SUBQUERY"),
            (8, 7, "SCAN j VIRTUAL TABLE INDEX 3:"),
            (9, 7, "SEARCH c USING INDEX comment_subject (subject=?)"),
            (10, 6, "UNION ALL"),
            (11, 10, "SCAN o"),
            (
                12,
                10,
                "SEARCH p USING INDEX favorite_did (did=? AND created_at<?)",
            ),
            (13, 0, "SEARCH r USING INDEX x (did>?)"),
            (14, 0, "USE TEMP B-TREE FOR LAST TERM OF ORDER BY"),
            (15, 0, "USE TEMP B-TREE FOR ORDER BY"),
        ]);
        // A leading range of photo, and a favorite searched for each
        // scanned repo; not a range after an equality, a search after a
        // table-valued function, a subquery's own, or a small table's.
        assert_eq!(sorts(sql, &sorted, &tables), ["photo", "repo", "favorite"]);
        let said = format!("{sql} -- sorts: photo, repo, favorite, as a test says");
        assert!(sorts(&said, &sorted, &tables).is_empty());
        // Ranges with no sort, and an expression searched by equality.
        assert!(sorts(sql, &sorted[..13], &tables).is_empty());
        let equal = steps(&[
            (2, 0, "SEARCH f USING INDEX photo_subject (<expr>=?)"),
            (3, 0, "SCAN photo"),
            (4, 0, "USE TEMP B-TREE FOR GROUP BY"),
        ]);
        assert_eq!(sorts(sql, &equal, &tables), ["photo"]);
        // A full-text match, ranked: the search's own rows.
        let matched = steps(&[
            (2, 0, "SCAN f VIRTUAL TABLE INDEX 0:M3"),
            (3, 0, "SEARCH c USING INTEGER PRIMARY KEY (rowid=?)"),
            (4, 0, "USE TEMP B-TREE FOR ORDER BY"),
        ]);
        assert!(sorts(sql, &matched, &tables).is_empty());
        assert!(!ranged("p USING INTEGER PRIMARY KEY"));
        assert_eq!(stat(FEW, false, 3), "1000 100 10 2");
    }
}
