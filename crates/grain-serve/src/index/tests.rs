use super::plan::{scans, sized};
use super::records::*;
use super::*;
use serde_json::json;

const DID: &str = "did:plc:alice";
const CID: &str = "bafyreia4w4bbvc5lqzkvexqlbwbagz5yfjfzzrqhfwqkhkk2xgekh4c6ai";
const EDITED: &str = "bafyreia4w4bbvc5lqzkvexqlbwbagz5yfjfzzrqhfwqkhkk2xgekh4c6aj";
const BLOB: &str = "bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy";
const NOW: &str = "2026-10-31T12:00:00.000Z";

fn uri(collection: &str) -> String {
    format!("at://{DID}/{collection}/3l3qo2vuowo2a")
}

fn blob(mime: &str) -> Value {
    json!({"$type": "blob", "ref": {"$link": BLOB}, "mimeType": mime, "size": 1000})
}

fn gallery(title: &str) -> Value {
    json!({
        "$type": "social.grain.gallery", "title": title, "description": "#fog", "createdAt": NOW,
        "labels": {"$type": "com.atproto.label.defs#selfLabels",
                   "values": [{"val": "nudity"}, {"val": "nudity"}, {"val": "gore"}]},
        "location": {"value": "8a28a98a4c67fff", "name": "Ocean Beach"},
    })
}

/// A record of every collection the index keeps.
fn every_record() -> Vec<(&'static str, Value)> {
    let gallery_uri = uri("social.grain.gallery");
    let photo_uri = uri("social.grain.photo");
    vec![
        ("social.grain.gallery", gallery("Fog")),
        (
            "social.grain.gallery.item",
            json!({"createdAt": NOW, "gallery": gallery_uri, "item": photo_uri, "position": 2}),
        ),
        (
            "social.grain.photo",
            json!({"createdAt": NOW, "photo": blob("image/jpeg"), "alt": "fog", "aspectRatio": {"width": 3, "height": 2}}),
        ),
        (
            "social.grain.photo.exif",
            json!({"createdAt": NOW, "photo": photo_uri, "iSO": 400, "make": "RICOH", "model": "GR III", "fNumber": 2_800_000}),
        ),
        (
            "social.grain.actor.profile",
            json!({"displayName": "Alice", "avatar": blob("image/png")}),
        ),
        (
            "social.grain.graph.follow",
            json!({"createdAt": NOW, "subject": "did:plc:bob"}),
        ),
        (
            "social.grain.graph.block",
            json!({"createdAt": NOW, "subject": "did:plc:carol"}),
        ),
        (
            "social.grain.favorite",
            json!({"createdAt": NOW, "subject": gallery_uri}),
        ),
        (
            "social.grain.comment",
            json!({"createdAt": NOW, "subject": gallery_uri, "text": "lovely", "replyTo": gallery_uri}),
        ),
        (
            "social.grain.story",
            json!({"createdAt": NOW, "media": blob("video/mp4"), "aspectRatio": {"width": 9, "height": 16},
            "labels": {"$type": "com.atproto.label.defs#selfLabels", "values": [{"val": "spam"}]}}),
        ),
        (
            "social.grain.group.item",
            json!({"createdAt": NOW, "gallery": gallery_uri}),
        ),
        (
            "social.grain.group.submission",
            json!({"createdAt": NOW, "gallery": gallery_uri, "group": "did:plc:group"}),
        ),
        (
            "social.grain.group.decline",
            json!({"createdAt": NOW, "gallery": gallery_uri, "submission": uri("social.grain.group.submission")}),
        ),
        (
            "fyi.opensocial.declaration",
            json!({"createdAt": NOW, "meta": "at://did:plc:group/space/fyi.opensocial.about/self"}),
        ),
        (
            "app.bsky.feed.post",
            json!({"createdAt": NOW, "text": "new gallery https://grain.social/profile/alice/gallery/3l3qo2vuowo2a"}),
        ),
        (
            "app.bsky.graph.follow",
            json!({"createdAt": NOW, "subject": "did:plc:bob"}),
        ),
        (
            "com.germnetwork.declaration",
            json!({"version": "1.0.0", "currentKey": {"$bytes": "AQID"},
            "messageMe": {"showButtonTo": "everyone", "messageMeUrl": "https://example.com/m"}}),
        ),
    ]
}

fn typed(collection: &str, mut record: Value) -> Value {
    record["$type"] = collection.into();
    record
}

fn refusal(result: Result<Applied, PutError>) -> LexiconError {
    match result {
        Err(PutError::Refused(why)) => why,
        other => panic!("not refused: {other:?}"),
    }
}

#[test]
fn a_record_put_twice_is_applied_once() {
    let index = Index::memory().unwrap();
    let at = uri("social.grain.gallery");
    let first = index.put_at(&at, CID, &gallery("Fog"), "2026-10-31T12:00:01.000Z");
    assert_eq!(first.unwrap(), Applied::Created);
    // Read back, then delivered by the stream: the same record, by its CID.
    assert_eq!(
        index.put(&at, CID, &gallery("Fog")).unwrap(),
        Applied::Unchanged
    );
    let held = index.get::<Gallery>(&at).unwrap().unwrap();
    assert_eq!(held.indexed_at, "2026-10-31T12:00:01.000Z");
    assert_eq!((held.did.as_str(), held.cid.as_str()), (DID, CID));
    // An edit replaces it, and keeps when it was first indexed.
    assert_eq!(
        index.put(&at, EDITED, &gallery("Fog, edited")).unwrap(),
        Applied::Updated
    );
    let held = index.get::<Gallery>(&at).unwrap().unwrap();
    assert_eq!(
        (held.cid.as_str(), held.record.title.as_str()),
        (EDITED, "Fog, edited")
    );
    assert_eq!(held.indexed_at, "2026-10-31T12:00:01.000Z");
    assert_eq!(held.record.location.unwrap().0["value"], "8a28a98a4c67fff");
    assert_eq!(index.self_labels(&at).unwrap(), ["gore", "nudity"]);
    let count: i64 = index.read(|db| {
        db.query_row(
            "SELECT count(*) FROM gallery -- scans: gallery, a test's own",
            [],
            |r| r.get(0),
        )
        .unwrap()
    });
    assert_eq!(count, 1);
    // The gallery's sort time is the earlier of when it says it was made
    // and when it was indexed.
    let (sort_at, h3): (String, String) = index.read(|db| {
        db.query_row(
            "SELECT sort_at, h3 FROM gallery -- scans: gallery, a test's own",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap()
    });
    assert_eq!((sort_at.as_str(), h3.as_str()), (NOW, "8a28a98a4c67fff"));
    // Its labels taken off, it carries none.
    let mut plain = gallery("Fog");
    plain.as_object_mut().unwrap().remove("labels");
    assert_eq!(index.put(&at, CID, &plain).unwrap(), Applied::Updated);
    assert!(index.self_labels(&at).unwrap().is_empty());
}

#[test]
fn a_gallery_titled_past_its_lexicon_is_indexed_whole_but_not_written() {
    let index = Index::memory().unwrap();
    let at = uri("social.grain.gallery");
    let title = "x".repeat(130);
    let why = match index.check("social.grain.gallery", &gallery(&title)) {
        Err(PutError::Refused(why)) => why,
        other => panic!("not refused: {other:?}"),
    };
    assert_eq!(
        (why.path.as_str(), why.message.as_str()),
        ("record.title", "must not be longer than 100 bytes")
    );
    assert_eq!(
        index.put(&at, CID, &gallery(&title)).unwrap(),
        Applied::Created
    );
    let held = index.get::<Gallery>(&at).unwrap().unwrap();
    assert_eq!(held.record.title, title);
    // Another collection's string past its bound is still refused.
    let profile = json!({"$type": "social.grain.actor.profile", "displayName": "n".repeat(641)});
    let why = refusal(index.put(&uri("social.grain.actor.profile"), CID, &profile));
    assert_eq!(why.message, "must not be longer than 640 bytes");
}

#[test]
fn a_record_deleted_is_gone() {
    let index = Index::memory().unwrap();
    let at = uri("social.grain.gallery");
    index.put(&at, CID, &gallery("Fog")).unwrap();
    assert!(index.delete(&at).unwrap());
    assert_eq!(index.get::<Gallery>(&at).unwrap(), None);
    assert!(index.self_labels(&at).unwrap().is_empty());
    assert!(!index.delete(&at).unwrap());
    assert!(
        !index
            .delete("at://did:plc:alice/app.bsky.feed.like/k")
            .unwrap()
    );
    assert!(!index.delete("not a uri").unwrap());
    // Put again after, it is new.
    assert_eq!(
        index.put(&at, CID, &gallery("Fog")).unwrap(),
        Applied::Created
    );
}

#[test]
fn records_that_do_not_fit_are_refused() {
    let index = Index::memory().unwrap();
    let at = uri("social.grain.gallery");
    let why = refusal(index.put("https://grain.social", CID, &gallery("Fog")));
    assert_eq!(why.message, "not a record URI");
    for bad in [
        "at://did:plc:a/social.grain.gallery",
        "at://did:plc:a/social.grain.gallery/k/x",
        "at://alice.test/social.grain.gallery/k",
    ] {
        assert!(record_uri(bad).is_none(), "{bad}");
    }
    let like = json!({"$type": "app.bsky.feed.like"});
    let why = refusal(index.put("at://did:plc:alice/app.bsky.feed.like/k", CID, &like));
    assert_eq!(why.message, "the index keeps no app.bsky.feed.like");
    assert_eq!(
        refusal(index.put(&at, "not/a/cid", &gallery("Fog"))).message,
        "not a CID: not/a/cid"
    );
    let why = refusal(index.put(&at, CID, &typed("social.grain.photo", gallery("Fog"))));
    assert_eq!(
        (why.path.as_str(), why.message.as_str()),
        ("$type", "must be social.grain.gallery")
    );
    let mut wrong = gallery("Fog");
    wrong["createdAt"] = "yesterday".into();
    let why = refusal(index.put(&at, CID, &wrong));
    assert_eq!(
        (why.path.as_str(), why.message.as_str()),
        ("record.createdAt", "must be a valid datetime")
    );
    // An integer written as a float fits the lexicon, but not the row.
    let item = json!({"$type": "social.grain.gallery.item", "createdAt": NOW, "gallery": at, "item": at, "position": 1.0});
    let why = refusal(index.put(&uri("social.grain.gallery.item"), CID, &item));
    assert!(why.message.contains("invalid type"), "{}", why.message);
    assert_eq!(index.get::<Gallery>(&at).unwrap(), None);
    let refused = PutError::Refused(why).to_string();
    assert!(refused.starts_with("refused: "), "{refused}");
    // A database that fails says so.
    index.read(|db| db.execute_batch("DROP TABLE gallery").unwrap());
    let failed = index.put(&at, CID, &gallery("Fog")).unwrap_err();
    assert!(matches!(failed, PutError::Db(_)));
    assert!(
        failed.to_string().starts_with("index: no such table"),
        "{failed}"
    );
}

#[test]
fn every_collection_has_a_row() {
    let index = Index::memory().unwrap();
    let records = every_record();
    assert_eq!(records.len(), COLLECTIONS.len());
    for (collection, record) in &records {
        let applied = index.put(&uri(collection), CID, &typed(collection, record.clone()));
        assert_eq!(applied.unwrap(), Applied::Created, "{collection}");
    }
    fn held<T: Record>(index: &Index) -> T {
        index.get::<T>(&uri(T::NSID)).unwrap().unwrap().record
    }
    assert_eq!(held::<Gallery>(&index).description.as_deref(), Some("#fog"));
    assert_eq!(held::<GalleryItem>(&index).position, 2);
    assert_eq!(held::<Photo>(&index).aspect_ratio.0["width"], 3);
    let exif = held::<PhotoExif>(&index);
    assert_eq!(
        (exif.iso, exif.make.as_deref(), exif.lens_make),
        (Some(400), Some("RICOH"), None)
    );
    assert_eq!(
        held::<Profile>(&index).display_name.as_deref(),
        Some("Alice")
    );
    assert_eq!(held::<Follow>(&index).subject, "did:plc:bob");
    assert_eq!(held::<Block>(&index).subject, "did:plc:carol");
    assert_eq!(
        held::<Favorite>(&index).subject,
        uri("social.grain.gallery")
    );
    assert_eq!(
        held::<Comment>(&index).reply_to,
        Some(uri("social.grain.gallery"))
    );
    assert_eq!(held::<Story>(&index).media.0["mimeType"], "video/mp4");
    assert_eq!(held::<GroupItem>(&index).submission, None);
    assert_eq!(held::<GroupSubmission>(&index).group_did, "did:plc:group");
    assert_eq!(
        held::<GroupDecline>(&index).gallery,
        uri("social.grain.gallery")
    );
    assert!(held::<GroupDeclaration>(&index).meta.contains("/space/"));
    assert!(
        held::<BskyPost>(&index)
            .text
            .contains("/gallery/3l3qo2vuowo2a")
    );
    assert_eq!(held::<BskyFollow>(&index).subject, "did:plc:bob");
    let germ = held::<GermDeclaration>(&index);
    assert_eq!(germ.message_me.unwrap().0["showButtonTo"], "everyone");
    assert_eq!(
        index.self_labels(&uri("social.grain.story")).unwrap(),
        ["spam"]
    );
    // An account's purge takes every one of them.
    index
        .put(
            &uri("social.grain.gallery").replace(DID, "did:plc:bob"),
            CID,
            &gallery("Bob's"),
        )
        .unwrap();
    assert_eq!(index.purge(DID).unwrap(), COLLECTIONS.len());
    assert!(
        index
            .self_labels(&uri("social.grain.gallery"))
            .unwrap()
            .is_empty()
    );
    let left: i64 = index.read(|db| {
        db.query_row(
            "SELECT count(*) FROM gallery -- scans: gallery, a test's own",
            [],
            |r| r.get(0),
        )
        .unwrap()
    });
    assert_eq!(left, 1);
}

#[test]
fn the_tables_have_the_rows_columns() {
    let index = Index::memory().unwrap();
    for (table, columns) in records::COLUMNS {
        let mut stmt = index.read(|db| {
            let mut stmt = db
                .prepare("SELECT name FROM pragma_table_info(?1)")
                .unwrap();
            let names = stmt.query_map([table], |r| r.get::<_, String>(0)).unwrap();
            names.collect::<rusqlite::Result<Vec<_>>>().unwrap()
        });
        let envelope: Vec<String> = stmt.drain(..4).collect();
        assert_eq!(envelope, ["uri", "cid", "did", "indexed_at"], "{table}");
        assert_eq!(stmt, *columns, "{table}");
    }
    assert_eq!(table_of("social.grain.story"), Some("story"));
    assert_eq!(table_of("social.grain.group"), None);
    // A JSON column that holds what is not JSON fails to read.
    let at = uri("social.grain.gallery");
    index.put(&at, CID, &gallery("Fog")).unwrap();
    index.read(|db| {
        db.execute(
            "UPDATE gallery SET facets = 'nope' -- scans: gallery, a test's own",
            [],
        )
        .unwrap()
    });
    assert!(index.get::<Gallery>(&at).is_err());
}

#[test]
fn accounts() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("index.db");
    let index = Index::open(&path).unwrap();
    assert!(!index.tracks(DID));
    assert!(index.track(DID).unwrap());
    assert!(!index.track(DID).unwrap());
    assert!(index.tracks(DID));
    index.set_handle(DID, "alice.test").unwrap();
    assert_eq!(
        index.repo(DID).unwrap(),
        Some((Some("alice.test".into()), "pending".into()))
    );
    index.read(|db| {
        db.execute(
            "UPDATE repo SET state = 'active' -- scans: repo, a test's own",
            [],
        )
        .unwrap()
    });
    // Its host says it is gone, and then back: it is backfilled again.
    index.set_host_status(DID, Some("deactivated")).unwrap();
    assert_eq!(
        index.host_status(DID).unwrap().as_deref(),
        Some("deactivated")
    );
    assert_eq!(index.repo(DID).unwrap().unwrap().1, "active");
    index.set_host_status(DID, None).unwrap();
    assert_eq!(index.host_status(DID).unwrap(), None);
    assert_eq!(index.repo(DID).unwrap().unwrap().1, "pending");
    assert_eq!(index.host_status("did:plc:nobody").unwrap(), None);
    assert_eq!(index.repo("did:plc:nobody").unwrap(), None);
    // An admin's takedown is kept apart from all of that.
    assert!(!index.taken_down(DID).unwrap());
    index.take_down(DID).unwrap();
    index.take_down(DID).unwrap();
    assert!(index.taken_down(DID).unwrap());
    index.reverse_takedown(DID).unwrap();
    assert!(!index.taken_down(DID).unwrap());
    index.take_down(DID).unwrap();
    // Where the stream was read to.
    let source = "jetstream:wss://jetstream.us-west.bsky.network";
    assert_eq!(index.cursor(source).unwrap(), None);
    index.set_cursor(source, 41).unwrap();
    index.set_cursor(source, 42).unwrap();
    assert_eq!(index.cursor(source).unwrap(), Some(42));
    index.forget_cursor(source).unwrap();
    assert_eq!(index.cursor(source).unwrap(), None);
    index.set_cursor(source, 42).unwrap();
    // An account's label is on its bare DID; a record's on its URI.
    let label = |uri: &str, neg: bool| Label {
        src: "did:plc:grain".into(),
        uri: uri.into(),
        val: "spam".into(),
        neg,
        cts: NOW.into(),
        exp: None,
    };
    let first = index.label(&label(DID, false)).unwrap();
    let second = index.label(&label(DID, true)).unwrap();
    assert_eq!(second, first + 1);
    index
        .label(&label(&uri("social.grain.gallery"), false))
        .unwrap();
    assert_eq!(
        index.labels(DID).unwrap(),
        [label(DID, false), label(DID, true)]
    );
    assert!(index.labels(&format!("at://{DID}")).unwrap().is_empty());
    drop(index);
    // Opened again, it has all it kept, and tracks whom it did.
    let index = Index::open(&path).unwrap();
    assert!(index.tracks(DID));
    assert!(index.taken_down(DID).unwrap());
    assert_eq!(index.cursor(source).unwrap(), Some(42));
}

#[test]
fn migrations() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("index.db");
    drop(Index::open(&path).unwrap());
    let version = |path: &Path| -> i64 {
        Connection::open(path)
            .unwrap()
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .unwrap()
    };
    assert_eq!(version(&path), schema::MIGRATIONS.len() as i64);
    // A step added later runs on an index made before it, once.
    let steps = schema::MIGRATIONS.len();
    let mut later = schema::MIGRATIONS.to_vec();
    later.push(
        "ALTER TABLE gallery ADD COLUMN later TEXT; CREATE INDEX gallery_later ON gallery (later);",
    );
    drop(Index::with(Connection::open(&path).unwrap(), &later).unwrap());
    drop(Index::with(Connection::open(&path).unwrap(), &later).unwrap());
    assert_eq!(version(&path), steps as i64 + 1);
    // An index of a newer grain is not read.
    let newer = Index::open(&path).err().unwrap().to_string();
    let past = format!(
        "the index is at version {}, past this grain's {steps}",
        steps + 1
    );
    assert_eq!(newer, past);
    // A step that fails leaves the index as it was.
    let mut broken = later.clone();
    broken.push("CREATE TABLE gallery (uri TEXT)");
    let failed = Index::with(Connection::open(&path).unwrap(), &broken)
        .err()
        .unwrap();
    let at = format!("migrating the index to version {}", steps + 2);
    assert_eq!(failed.to_string(), at);
    assert_eq!(version(&path), steps as i64 + 1);
    let nowhere = dir.path().join("missing/index.db");
    let failed = Index::open(&nowhere).err().unwrap().to_string();
    assert!(failed.starts_with("opening "), "{failed}");
}

#[test]
fn the_queries_still_to_port_read_by_index() {
    let index = Index::memory().unwrap();
    // The feeds' and the views' own queries are checked where they are
    // written, by `read::tests::the_reads_read_by_index`; these are the
    // ones of what is still to be ported, as they will read.
    let queries = [
        "SELECT f.did FROM follow f WHERE f.subject = ?1 ORDER BY f.did LIMIT 50",
        "SELECT * FROM report r WHERE r.status = ?1 ORDER BY r.created_at DESC LIMIT 50",
        "SELECT * FROM label l WHERE l.src = ?1 AND l.id > ?2 ORDER BY l.id LIMIT 100",
        "DELETE FROM story_view WHERE created_at < ?1",
        // backfill's queue, and the revisions it holds records to
        "SELECT did FROM repo r WHERE r.state = 'pending' AND r.retry_after <= ?1
           AND r.host_status IS NULL ORDER BY r.retry_after LIMIT ?2",
        "SELECT t.uri FROM gallery t LEFT JOIN record_rev r ON r.uri = t.uri
           WHERE t.did = ?1 AND (r.rev IS NULL OR r.rev < ?2)",
        "DELETE FROM record_rev WHERE uri >= ?1 AND uri < ?2 AND gone = 1 AND rev <= ?3",
        "DELETE FROM record_rev WHERE gone = 1 AND rev < ?1",
    ];
    index.read(|db| {
        sized(db);
        for sql in &queries {
            assert_eq!(scans(db, sql), Vec::<String>::new(), "{sql}");
        }
        // As the check would name one that does.
        let unindexed = "SELECT uri FROM gallery g WHERE g.title = ?1";
        assert_eq!(scans(db, unindexed), ["SCAN g"]);
    });
}

/// Revisions a repo was read at: `OLD` before `NEW`, both long before
/// anything the stream applies now, and `LATER` after it.
const OLD: &str = "3l3qo2vuowo2a";
const NEW: &str = "3l3qo2vuowo2b";
const LATER: &str = "jzzzzzzzzzzzz";

#[test]
fn newer_revisions_stand() {
    let index = Index::memory().unwrap();
    let at = uri("social.grain.gallery");
    let put = |cid: &str, title: &str, rev: &str| index.put_rev(&at, cid, &gallery(title), rev);
    let title = || index.get::<Gallery>(&at).unwrap().map(|r| r.record.title);
    // A repo read at NEW, then one read at OLD, as a mirror lagging: the
    // newer stands, and so does what came at its own revision.
    assert_eq!(put(CID, "new", NEW).unwrap(), Applied::Created);
    assert_eq!(put(EDITED, "old", OLD).unwrap(), Applied::Stale);
    assert_eq!(put(CID, "new", NEW).unwrap(), Applied::Stale);
    assert!(!index.delete_rev(&at, OLD).unwrap());
    assert_eq!(title().as_deref(), Some("new"));
    // What the stream applies, as it happens, is past any repo read before.
    assert_eq!(
        index.put(&at, EDITED, &gallery("live")).unwrap(),
        Applied::Updated
    );
    assert_eq!(put(CID, "new", NEW).unwrap(), Applied::Stale);
    assert_eq!(title().as_deref(), Some("live"));
    // Its deletion too: a repo read before it does not bring it back.
    assert!(index.delete(&at).unwrap());
    assert_eq!(put(CID, "new", NEW).unwrap(), Applied::Stale);
    assert_eq!(title(), None);
    // A repo read later does.
    assert_eq!(put(CID, "later", LATER).unwrap(), Applied::Created);
    assert_eq!(title().as_deref(), Some("later"));
    // A read older than the revision it has changes nothing.
    let at_rev = || -> String {
        index.read(|db| {
            db.query_row("SELECT rev FROM record_rev WHERE uri = ?1", [&at], |r| {
                r.get(0)
            })
            .unwrap()
        })
    };
    index.put_rev(&at, CID, &gallery("later"), OLD).unwrap();
    assert_eq!(at_rev(), LATER);
    // A stream write after a revision stamped ahead of the clock keeps it.
    assert_eq!(
        index.put(&at, CID, &gallery("later")).unwrap(),
        Applied::Unchanged
    );
    assert_eq!(at_rev(), LATER);
    assert!(index.delete_rev(&at, "kzzzzzzzzzzzz").is_ok());
    assert_eq!(title(), None);
    // An account purged takes its revisions with it.
    assert_eq!(put(CID, "again", "kzzzzzzzzzzzz").unwrap(), Applied::Stale);
    index.purge(DID).unwrap();
    assert_eq!(put(CID, "again", OLD).unwrap(), Applied::Created);
}

#[test]
fn backfill_queue() {
    let index = Index::memory().unwrap();
    let (a, b) = ("did:plc:a", "did:plc:b");
    index.track(a).unwrap();
    index.track(b).unwrap();
    assert_eq!(index.pending(0, 10).unwrap(), [a, b]);
    assert_eq!(index.pending(0, 1).unwrap(), [a]);
    let queued = index.queued(a).unwrap().unwrap();
    assert_eq!((queued.state.as_str(), queued.retry_count), ("pending", 0));
    assert_eq!(index.queued("did:plc:nobody").unwrap(), None);
    // A failure waits for its time to come round, and one given up on is out.
    index.backfill_failed(a, "went quiet", Some(100)).unwrap();
    assert_eq!(index.pending(99, 10).unwrap(), [b]);
    assert_eq!(index.pending(100, 10).unwrap(), [b, a]);
    let queued = index.queued(a).unwrap().unwrap();
    assert_eq!(
        (
            queued.retry_count,
            queued.retry_after,
            queued.last_error.as_deref()
        ),
        (1, 100, Some("went quiet"))
    );
    index.backfill_failed(a, "not found", None).unwrap();
    assert_eq!(index.queued(a).unwrap().unwrap().state, "failed");
    assert_eq!(index.pending(1000, 10).unwrap(), [b]);
    // Resynced, it is back at the front, tried afresh; so is one not
    // tracked before.
    index.resync(a).unwrap();
    let queued = index.queued(a).unwrap().unwrap();
    assert_eq!((queued.state.as_str(), queued.retry_count), ("pending", 0));
    assert_eq!(queued.last_error, None);
    index.resync("did:plc:c").unwrap();
    assert!(index.tracks("did:plc:c"));
    // Skipped, or gone from its host, it waits for nothing.
    index
        .backfill_skipped(b, "skipped: atproto.brid.gy")
        .unwrap();
    index
        .set_host_status("did:plc:c", Some("deactivated"))
        .unwrap();
    assert_eq!(index.pending(0, 10).unwrap(), [a]);
    let queued = index.queued(b).unwrap().unwrap();
    assert_eq!(queued.state, "skipped");
}

#[test]
fn a_repo_backfilled_replaces_what_it_no_longer_has() {
    let index = Index::memory().unwrap();
    index.track(DID).unwrap();
    let at = |rkey: &str| format!("at://{DID}/social.grain.gallery/{rkey}");
    let (kept, dropped, live, deleted) = (at("3kept"), at("3dropped"), at("3live"), at("3deleted"));
    index.put_rev(&kept, CID, &gallery("kept"), OLD).unwrap();
    index
        .put_rev(&dropped, CID, &gallery("dropped"), OLD)
        .unwrap();
    index.put(&live, CID, &gallery("written since")).unwrap();
    index
        .put_rev(&deleted, CID, &gallery("deleted"), OLD)
        .unwrap();
    index.delete_rev(&deleted, NEW).unwrap();
    // Another account's, which the repo says nothing of.
    let theirs = "at://did:plc:bob/social.grain.gallery/3theirs";
    index.put_rev(theirs, CID, &gallery("theirs"), OLD).unwrap();
    // Read at NEW, the repo has only `kept`: `dropped` went since OLD,
    // and `live`, written after NEW, stands.
    let present = HashSet::from([kept.clone()]);
    assert_eq!(index.backfilled(DID, NEW, &present).unwrap(), 1);
    assert!(index.get::<Gallery>(&kept).unwrap().is_some());
    assert!(index.get::<Gallery>(&dropped).unwrap().is_none());
    assert!(index.get::<Gallery>(&live).unwrap().is_some());
    assert!(index.get::<Gallery>(theirs).unwrap().is_some());
    let revs: i64 = index.read(|db| {
        db.query_row(
            "SELECT count(*) FROM record_rev WHERE gone = 1 -- scans: record_rev, a test's own",
            [],
            |r| r.get(0),
        )
        .unwrap()
    });
    assert_eq!(revs, 0, "the deletion NEW covers is forgotten");
    let queued = index.queued(DID).unwrap().unwrap();
    assert_eq!(
        (queued.state.as_str(), queued.rev.as_deref()),
        ("active", Some(NEW))
    );
    // Read again at OLD, from a mirror behind: the revision does not go back.
    index.backfilled(DID, OLD, &present).unwrap();
    assert_eq!(
        index.queued(DID).unwrap().unwrap().rev.as_deref(),
        Some(NEW)
    );
    // Deletions older than any repo read now are forgotten.
    index.delete(&live).unwrap();
    assert_eq!(index.forget_deletions(OLD).unwrap(), 0);
    assert_eq!(index.forget_deletions(LATER).unwrap(), 1);
}

#[test]
fn a_purge_takes_what_grain_keeps_for_the_account_and_leaves_what_admins_hold() {
    let index = Index::memory().unwrap();
    let other = "did:plc:bob";
    index.track(DID).unwrap();
    index
        .put(&uri("social.grain.gallery"), CID, &gallery("Fog"))
        .unwrap();
    let mine = [
        "INSERT INTO web_session VALUES (?1, '{}', 0, 0)",
        "INSERT INTO preference VALUES (?1, 'theme', '\"dark\"', '')",
        "INSERT INTO notification_seen VALUES (?1, '')",
        "INSERT INTO notification_pref VALUES (?1, 'follows', 1, 1, 0)",
        "INSERT INTO push_token VALUES (?1, 'token', 'ios', '')",
        "INSERT INTO mute VALUES (?1, 'did:plc:carol', '')",
        "INSERT INTO story_view VALUES (?1, 'at://did:plc:carol/social.grain.story/s', '')",
        "INSERT INTO takedown VALUES (?1, '')",
        "INSERT INTO report (subject_uri, subject_did, label, reported_by, created_at)
           VALUES (?1, ?1, 'spam', 'did:plc:carol', '')",
        "INSERT INTO label (src, uri, val, cts) VALUES ('did:web:grain.social', ?1, 'spam', '')",
    ];
    index.read(|db| {
        for sql in mine {
            db.execute(sql, [DID]).unwrap();
            db.execute(sql, [other]).unwrap();
        }
        // Another's mute of the account is theirs.
        db.execute("INSERT INTO mute VALUES (?1, ?2, '')", [other, DID])
            .unwrap();
    });
    assert_eq!(index.purge(DID).unwrap(), 1);
    let count = |table: &str, did: &str| -> i64 {
        let column = match table {
            "report" => "subject_did",
            "label" => "uri",
            _ => "did",
        };
        let sql = format!("SELECT count(*) FROM {table} WHERE {column} = ?1");
        index.read(|db| db.query_row(&sql, [did], |r| r.get(0)).unwrap())
    };
    for table in [
        "web_session",
        "preference",
        "notification_seen",
        "notification_pref",
        "push_token",
        "mute",
        "story_view",
    ] {
        assert_eq!(count(table, DID), 0, "{table}");
        assert!(count(table, other) >= 1, "{table} of another");
    }
    for table in ["takedown", "report", "label"] {
        assert_eq!(count(table, DID), 1, "{table} stays");
    }
    let muted: i64 = index.read(|db| {
        db.query_row("SELECT count(*) FROM mute WHERE subject = ?1", [DID], |r| {
            r.get(0)
        })
        .unwrap()
    });
    assert_eq!(muted, 1);
    // Tracked still, as its host may say more of it, until it is untracked.
    assert!(index.tracks(DID));
    assert!(index.untrack(DID).unwrap());
    assert!(!index.tracks(DID) && index.repo(DID).unwrap().is_none());
    assert!(!index.untrack(DID).unwrap());
}
