//! How SQLite plans a query on an index the size of prod's: what the
//! plan checks of the feeds and the reads hold queries to.

use rusqlite::Connection;
use std::collections::{HashMap, HashSet};

/// Each table said to hold a million rows, and each index's first column
/// to pick out a hundred, so SQLite plans as it would on prod's.
pub fn sized(db: &Connection) {
    super::plans::sized(db, |_| super::plans::MANY).unwrap();
}

/// The tables `sql`'s plan reads whole, rather than by an index: what no
/// query of a table that grows with the network may do. A full-text
/// search reads its table through the match, which is its index.
pub fn scans(db: &Connection, sql: &str) -> Vec<String> {
    let words: Vec<&str> = sql
        .split(|c: char| c.is_whitespace() || "(),".contains(c))
        .filter(|w| !w.is_empty())
        .collect();
    let mut aliases = HashMap::new();
    for (i, w) in words.iter().enumerate() {
        if (w.eq_ignore_ascii_case("FROM") || w.eq_ignore_ascii_case("JOIN")) && i + 2 < words.len()
        {
            aliases.insert(words[i + 2], words[i + 1]);
            aliases.insert(words[i + 1], words[i + 1]);
        }
    }
    let tables: HashSet<String> = {
        let mut stmt = db
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
            .unwrap();
        stmt.query_map([], |r| r.get(0))
            .unwrap()
            .map(Result::unwrap)
            .collect()
    };
    let mut stmt = db.prepare(&format!("EXPLAIN QUERY PLAN {sql}")).unwrap();
    // Unbound, as its parameters do not change its plan.
    let mut rows = stmt.raw_query();
    let mut details: Vec<String> = Vec::new();
    while let Some(row) = rows.next().unwrap() {
        details.push(row.get(3).unwrap());
    }
    details
        .into_iter()
        .filter(|d| {
            let Some(rest) = d.strip_prefix("SCAN ") else {
                return false;
            };
            let name = rest.split_whitespace().next().unwrap_or_default();
            let table = aliases.get(name).copied().unwrap_or(name);
            // A virtual table read through a constraint, as full-text
            // search reads one by MATCH, is read by its index.
            let constrained = rest.contains(" VIRTUAL TABLE INDEX ") && !rest.ends_with(':');
            tables.contains(table) && !rest.contains(" USING ") && !constrained
        })
        .collect()
}
