//! The `grain-import` binary: it reads hatk's database into the index
//! `GRAIN_INDEX` names, and says how it is used when it is not.

use std::process::Command;

#[test]
fn imports_hatks_database_into_its_index() {
    let dir = tempfile::tempdir().unwrap();
    let old = dir.path().join("grain.db");
    let db = rusqlite::Connection::open(&old).unwrap();
    db.execute_batch(
        "CREATE TABLE _repos (did TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'pending',
           handle TEXT, backfilled_at TEXT, rev TEXT, retry_count INTEGER NOT NULL DEFAULT 0,
           retry_after INTEGER NOT NULL DEFAULT 0);
         INSERT INTO _repos (did, status) VALUES ('did:plc:alice', 'takendown');",
    )
    .unwrap();
    drop(db);
    let index = dir.path().join("index.db");
    let out = Command::new(env!("CARGO_BIN_EXE_grain-import"))
        .arg(&old)
        .env("GRAIN_INDEX", &index)
        .output()
        .unwrap();
    let said = String::from_utf8_lossy(&out.stdout);
    assert!(out.status.success(), "{said}");
    assert!(
        said.contains("takedown (_repos, status takendown)"),
        "{said}"
    );
    assert!(said.ends_with("written\n"), "{said}");
    let held = rusqlite::Connection::open(&index).unwrap();
    let did: String = held
        .query_row("SELECT did FROM takedown", [], |r| r.get(0))
        .unwrap();
    assert_eq!(did, "did:plc:alice");

    let usage = Command::new(env!("CARGO_BIN_EXE_grain-import"))
        .output()
        .unwrap();
    assert_eq!(usage.status.code(), Some(2));
    assert!(String::from_utf8_lossy(&usage.stderr).starts_with("usage: grain-import"));
}
