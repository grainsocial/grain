//! The index's tables, made by [`MIGRATIONS`] in order.
//!
//! # Records
//!
//! One table a collection, named for it ([`super::records::COLLECTIONS`]),
//! rebuildable from the network by backfill. Each row is its record's
//! envelope, then the record's fields as columns ([`super::records`]):
//!
//! - `uri` (key), `cid`, `did`, the record's author;
//! - `indexed_at`, when the index first held the record: kept as the
//!   record changes, since feeds order by it. A gallery's `sort_at` is the earlier of it
//!   and `created_at`, so a clock set ahead cannot pin one to the top;
//! - the fields, under their names in snake case.
//!
//! `self_label` holds the self-labels a gallery or story carries in
//! `labels`, a row each, for feeds to leave out the ones that hide.
//!
//! # Accounts
//!
//! `repo` is every account the index tracks, written by backfill and the
//! stream: its handle, how far backfill has it (`state`: `pending`,
//! `active`, `failed`, `skipped` where its host is one backfill leaves
//! alone), and `host_status`, null while its host says it is active, and
//! otherwise what the host said: `deactivated`, `suspended`, `takendown`,
//! `deleted`. Backfill keeps its queue there too: `rev`, the revision it
//! last read the repo at, `retry_count` and `retry_after` (seconds since
//! the epoch) for one that failed, and `last_error`, why. `stream_cursor`
//! is where each stream was read to, by source (`jetstream:<url>`).
//!
//! # Search
//!
//! `profile_search` and `gallery_search` are SQLite FTS5 tables of the
//! words a profile or gallery is found by: its author's handle, a
//! profile's name and description, a gallery's title, description and
//! place, Porter-stemmed and without diacritics, so that a word is found
//! by its other forms and by its letters unaccented. Triggers on `profile`, `gallery` and `repo` keep them as
//! those tables are; `search_doc` gives each record the rowid it has in
//! them, since a record's own rowid may change on a `VACUUM`. They are
//! made from the records, so rebuilding these rebuilds them.
//!
//! # Mentions
//!
//! `mention` is each account a comment or a gallery mentions, a row each:
//! a facet feature of `app.bsky.richtext.facet#mention`, by its `did`.
//! Triggers on `comment` and `gallery` keep it, and it is made from the
//! records, so notifications find a mention by its account's DID rather
//! than by reading every record's facets.
//!
//! `record_rev` is the revision each record was last written or deleted
//! at (`gone`), for backfill to leave alone what is newer than the repo it
//! read: a write the stream applied after the repo was exported, or a
//! deletion. A write that names no revision is stamped with the time it
//! was applied, as a TID. A deletion's row is dropped once a repo read
//! at or past it no longer needs it.
//!
//! # What the network cannot rebuild
//!
//! These hold what was decided or said here, and nothing refills them:
//!
//! - `takedown`: accounts an admin took down, apart from `repo` so that
//!   rebuilding the records never reinstates one;
//! - `label`: the labels grain gives out, as `com.atproto.label.defs#label`
//!   has them; one on an account names it by its bare DID, not
//!   `at://<did>`, as Bluesky's do;
//! - `report`, what someone reported: its subject (an account's bare DID
//!   or a record's AT-URI) and that subject's account (`subject_did`), the
//!   label it asks for, the `reason_type` it was made with
//!   (`com.atproto.moderation.defs#reasonType`, none for one made before
//!   grain took them by it) and its `reason`, who made it, and whether it is
//!   `open`, `resolved` or `dismissed`, by whom and when;
//! - `mute`, `preference`, `push_token`, `story_view`, `space_support`;
//! - `notification_seen`, when each account last saw its notifications
//!   (`updateSeen`'s `seenAt`, in UTC as [`grain::keys::iso`] writes it),
//!   and `notification_pref`, how each kind of notification reaches it
//!   (`favorites`, `follows`, `comments`, `mentions`): pushed or not,
//!   shown in the app or not, and from anyone or only from accounts it
//!   follows. A kind with no row reaches it every way, from anyone.
//!
//! - `oauth_key`, the keys grain-serve's OAuth client holds, by key ID, as
//!   private JWKs: `pds-client-auth-key` signs what proves the client to
//!   each PDS, which binds every session to it, so a new one signs every
//!   web login out; `web-cookie` signs the web's cookies, and a new one
//!   signs every browser out;
//! - `carried_cookie_key`, the key the cookies a browser held before
//!   grain-serve were sealed under, read by [`crate::login::carryover`]
//!   until it is removed;
//! - `web_session`, the OAuth session of each account logged in to the
//!   web ([`grain::session::Session`], as JSON), with `since`, when its
//!   login was kept with none before it, in microseconds since the epoch:
//!   a cookie signed before then names no one.
//!
//! `classification` is neither: the classifiers' last scores of each
//! subject ([`crate::index::classify`]), which scoring again would make,
//! at the cost of asking Clef again.
//!
//! A migration may drop and remake a record table, which backfill refills;
//! these it only alters in place.
//!
//! # Push
//!
//! `push_record` is each record whose notifications were pushed, and when,
//! so that one the stream delivers again, or deletes and makes again, is
//! not pushed twice ([`crate::push::send`]). A row is kept for a day,
//! past which a record is too old to push anyway.
//!
//! # Indexes
//!
//! Each serves a query grain runs: the feeds (recent, following, actor,
//! camera, hashtag, location, group, groups, for you), the views that
//! hydrate them, and the moderation filters every feed applies
//! ([`shown`], [`HIDDEN_LABELS`]).

/// Each step of the schema, run once, in order, by `PRAGMA user_version`.
/// A step is only ever appended: one that has run is never changed.
pub const MIGRATIONS: &[&str] = &[V1, V2, V3, V4, V5, V6, V7, V8, V9, V10, V11, V12];

const V1: &str = "
CREATE TABLE gallery (
  uri TEXT PRIMARY KEY, cid TEXT NOT NULL, did TEXT NOT NULL, indexed_at TEXT NOT NULL,
  title TEXT NOT NULL, description TEXT, facets TEXT, labels TEXT, location TEXT,
  address TEXT, updated_at TEXT, created_at TEXT NOT NULL,
  sort_at TEXT GENERATED ALWAYS AS (min(created_at, indexed_at)) VIRTUAL,
  h3 TEXT GENERATED ALWAYS AS (json_extract(location, '$.value')) VIRTUAL);
CREATE INDEX gallery_sort ON gallery (sort_at);
CREATE INDEX gallery_did ON gallery (did, created_at);
CREATE INDEX gallery_did_sort ON gallery (did, sort_at);
CREATE INDEX gallery_h3 ON gallery (h3, sort_at);

CREATE TABLE gallery_item (
  uri TEXT PRIMARY KEY, cid TEXT NOT NULL, did TEXT NOT NULL, indexed_at TEXT NOT NULL,
  gallery TEXT NOT NULL, item TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL);
CREATE INDEX gallery_item_gallery ON gallery_item (gallery, position);
CREATE INDEX gallery_item_item ON gallery_item (item);
CREATE INDEX gallery_item_did ON gallery_item (did);

CREATE TABLE photo (
  uri TEXT PRIMARY KEY, cid TEXT NOT NULL, did TEXT NOT NULL, indexed_at TEXT NOT NULL,
  photo TEXT NOT NULL, alt TEXT, aspect_ratio TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX photo_did ON photo (did, created_at);

CREATE TABLE photo_exif (
  uri TEXT PRIMARY KEY, cid TEXT NOT NULL, did TEXT NOT NULL, indexed_at TEXT NOT NULL,
  photo TEXT NOT NULL, created_at TEXT NOT NULL, date_time_original TEXT,
  exposure_time INTEGER, f_number INTEGER, flash TEXT, focal_length_in35mm_format INTEGER,
  iso INTEGER, lens_make TEXT, lens_model TEXT, make TEXT, model TEXT);
CREATE INDEX photo_exif_photo ON photo_exif (photo);
CREATE INDEX photo_exif_camera ON photo_exif (make, model);
CREATE INDEX photo_exif_did ON photo_exif (did);

CREATE TABLE profile (
  uri TEXT PRIMARY KEY, cid TEXT NOT NULL, did TEXT NOT NULL, indexed_at TEXT NOT NULL,
  display_name TEXT, description TEXT, avatar TEXT, created_at TEXT);
CREATE INDEX profile_did ON profile (did);

CREATE TABLE follow (
  uri TEXT PRIMARY KEY, cid TEXT NOT NULL, did TEXT NOT NULL, indexed_at TEXT NOT NULL,
  subject TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX follow_did ON follow (did, subject);
CREATE INDEX follow_subject ON follow (subject, did);

CREATE TABLE block (
  uri TEXT PRIMARY KEY, cid TEXT NOT NULL, did TEXT NOT NULL, indexed_at TEXT NOT NULL,
  subject TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX block_did ON block (did, subject);
CREATE INDEX block_subject ON block (subject, did);

CREATE TABLE favorite (
  uri TEXT PRIMARY KEY, cid TEXT NOT NULL, did TEXT NOT NULL, indexed_at TEXT NOT NULL,
  subject TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX favorite_subject ON favorite (subject, did);
CREATE INDEX favorite_did ON favorite (did, created_at);
CREATE INDEX favorite_did_subject ON favorite (did, subject);

CREATE TABLE comment (
  uri TEXT PRIMARY KEY, cid TEXT NOT NULL, did TEXT NOT NULL, indexed_at TEXT NOT NULL,
  text TEXT NOT NULL, facets TEXT, subject TEXT NOT NULL, focus TEXT, reply_to TEXT,
  created_at TEXT NOT NULL);
CREATE INDEX comment_subject ON comment (subject, created_at);
CREATE INDEX comment_reply_to ON comment (reply_to);
CREATE INDEX comment_did ON comment (did, created_at);

CREATE TABLE story (
  uri TEXT PRIMARY KEY, cid TEXT NOT NULL, did TEXT NOT NULL, indexed_at TEXT NOT NULL,
  media TEXT NOT NULL, aspect_ratio TEXT NOT NULL, location TEXT, address TEXT,
  labels TEXT, created_at TEXT NOT NULL);
CREATE INDEX story_did ON story (did, created_at);
CREATE INDEX story_created ON story (created_at);

CREATE TABLE group_item (
  uri TEXT PRIMARY KEY, cid TEXT NOT NULL, did TEXT NOT NULL, indexed_at TEXT NOT NULL,
  gallery TEXT NOT NULL, submission TEXT, created_at TEXT NOT NULL);
CREATE INDEX group_item_did ON group_item (did, created_at);
CREATE INDEX group_item_gallery ON group_item (gallery, did);
CREATE INDEX group_item_created ON group_item (created_at);

CREATE TABLE group_submission (
  uri TEXT PRIMARY KEY, cid TEXT NOT NULL, did TEXT NOT NULL, indexed_at TEXT NOT NULL,
  group_did TEXT NOT NULL, gallery TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX group_submission_group ON group_submission (group_did, created_at);
CREATE INDEX group_submission_did ON group_submission (did, gallery);

CREATE TABLE group_decline (
  uri TEXT PRIMARY KEY, cid TEXT NOT NULL, did TEXT NOT NULL, indexed_at TEXT NOT NULL,
  submission TEXT NOT NULL, gallery TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX group_decline_did ON group_decline (did, submission);
CREATE INDEX group_decline_gallery ON group_decline (gallery, did);

CREATE TABLE group_declaration (
  uri TEXT PRIMARY KEY, cid TEXT NOT NULL, did TEXT NOT NULL, indexed_at TEXT NOT NULL,
  meta TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX group_declaration_did ON group_declaration (did);

CREATE TABLE bsky_post (
  uri TEXT PRIMARY KEY, cid TEXT NOT NULL, did TEXT NOT NULL, indexed_at TEXT NOT NULL,
  text TEXT NOT NULL, embed TEXT, created_at TEXT NOT NULL);
CREATE INDEX bsky_post_did ON bsky_post (did, created_at);

CREATE TABLE bsky_follow (
  uri TEXT PRIMARY KEY, cid TEXT NOT NULL, did TEXT NOT NULL, indexed_at TEXT NOT NULL,
  subject TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX bsky_follow_did ON bsky_follow (did, subject);
CREATE INDEX bsky_follow_subject ON bsky_follow (subject);

CREATE TABLE germ_declaration (
  uri TEXT PRIMARY KEY, cid TEXT NOT NULL, did TEXT NOT NULL, indexed_at TEXT NOT NULL,
  version TEXT NOT NULL, current_key TEXT NOT NULL, message_me TEXT, key_package TEXT,
  continuity_proofs TEXT);
CREATE INDEX germ_declaration_did ON germ_declaration (did);

CREATE TABLE self_label (
  uri TEXT NOT NULL, val TEXT NOT NULL, PRIMARY KEY (uri, val)) WITHOUT ROWID;

CREATE TABLE repo (
  did TEXT PRIMARY KEY, handle TEXT, state TEXT NOT NULL DEFAULT 'pending',
  host_status TEXT, rev TEXT, backfilled_at TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0, retry_after INTEGER NOT NULL DEFAULT 0);
CREATE INDEX repo_handle ON repo (handle);
CREATE INDEX repo_state ON repo (state);

CREATE TABLE stream_cursor (source TEXT PRIMARY KEY, seq INTEGER NOT NULL);

CREATE TABLE takedown (did TEXT PRIMARY KEY, at TEXT NOT NULL);

CREATE TABLE label (
  id INTEGER PRIMARY KEY AUTOINCREMENT, src TEXT NOT NULL, uri TEXT NOT NULL,
  val TEXT NOT NULL, neg INTEGER NOT NULL DEFAULT 0, cts TEXT NOT NULL, exp TEXT);
CREATE INDEX label_uri ON label (uri, val, cts);
CREATE INDEX label_src ON label (src, id);

CREATE TABLE report (
  id INTEGER PRIMARY KEY AUTOINCREMENT, subject_uri TEXT NOT NULL,
  subject_did TEXT NOT NULL, label TEXT NOT NULL, reason TEXT,
  reported_by TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', resolved_by TEXT,
  resolved_at TEXT, created_at TEXT NOT NULL);
CREATE INDEX report_status ON report (status, created_at);
CREATE INDEX report_subject ON report (subject_uri);

CREATE TABLE mute (
  did TEXT NOT NULL, subject TEXT NOT NULL, created_at TEXT NOT NULL,
  PRIMARY KEY (did, subject)) WITHOUT ROWID;
CREATE INDEX mute_subject ON mute (subject);

CREATE TABLE preference (
  did TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY (did, key)) WITHOUT ROWID;

CREATE TABLE push_token (
  did TEXT NOT NULL, token TEXT NOT NULL, platform TEXT NOT NULL,
  created_at TEXT NOT NULL, PRIMARY KEY (did, token)) WITHOUT ROWID;
CREATE INDEX push_token_token ON push_token (token);

CREATE TABLE story_view (
  did TEXT NOT NULL, subject TEXT NOT NULL, created_at TEXT NOT NULL,
  PRIMARY KEY (did, subject)) WITHOUT ROWID;
CREATE INDEX story_view_created ON story_view (created_at);

CREATE TABLE space_invite (
  space TEXT NOT NULL, member_did TEXT NOT NULL, author_did TEXT NOT NULL,
  created_at TEXT NOT NULL, PRIMARY KEY (space, member_did)) WITHOUT ROWID;
CREATE INDEX space_invite_member ON space_invite (member_did, created_at);

CREATE TABLE space_support (
  pds_endpoint TEXT PRIMARY KEY, supported INTEGER NOT NULL, missing TEXT NOT NULL,
  checked_at TEXT NOT NULL);
";

const V2: &str = "
ALTER TABLE repo ADD COLUMN last_error TEXT;
CREATE INDEX repo_queue ON repo (state, retry_after);
CREATE TABLE record_rev (
  uri TEXT PRIMARY KEY, rev TEXT NOT NULL, gone INTEGER NOT NULL DEFAULT 0) WITHOUT ROWID;
CREATE INDEX record_rev_gone ON record_rev (rev) WHERE gone = 1;
";

/// For the lists of accounts and favorites, paged by when each was made.
const V3: &str = "
CREATE INDEX follow_subject_created ON follow (subject, created_at);
CREATE INDEX follow_did_created ON follow (did, created_at);
CREATE INDEX favorite_subject_created ON favorite (subject, created_at);
";

/// Full-text search of profiles and galleries, kept by triggers, and
/// filled from what the index holds.
const V4: &str = "
CREATE TABLE search_doc (id INTEGER PRIMARY KEY, uri TEXT NOT NULL UNIQUE);
CREATE VIRTUAL TABLE profile_search USING fts5(
  handle, display_name, description, tokenize = 'porter unicode61 remove_diacritics 2');
CREATE VIRTUAL TABLE gallery_search USING fts5(
  handle, title, description, place, tokenize = 'porter unicode61 remove_diacritics 2');

CREATE TRIGGER profile_search_insert AFTER INSERT ON profile BEGIN
  INSERT OR IGNORE INTO search_doc (uri) VALUES (NEW.uri);
  INSERT INTO profile_search (rowid, handle, display_name, description)
    SELECT d.id, (SELECT handle FROM repo WHERE did = NEW.did), NEW.display_name, NEW.description
    FROM search_doc d WHERE d.uri = NEW.uri;
END;
CREATE TRIGGER profile_search_update AFTER UPDATE ON profile BEGIN
  DELETE FROM profile_search WHERE rowid = (SELECT id FROM search_doc WHERE uri = OLD.uri);
  INSERT INTO profile_search (rowid, handle, display_name, description)
    SELECT d.id, (SELECT handle FROM repo WHERE did = NEW.did), NEW.display_name, NEW.description
    FROM search_doc d WHERE d.uri = NEW.uri;
END;
CREATE TRIGGER profile_search_delete AFTER DELETE ON profile BEGIN
  DELETE FROM profile_search WHERE rowid = (SELECT id FROM search_doc WHERE uri = OLD.uri);
  DELETE FROM search_doc WHERE uri = OLD.uri;
END;

CREATE TRIGGER gallery_search_insert AFTER INSERT ON gallery BEGIN
  INSERT OR IGNORE INTO search_doc (uri) VALUES (NEW.uri);
  INSERT INTO gallery_search (rowid, handle, title, description, place)
    SELECT d.id, (SELECT handle FROM repo WHERE did = NEW.did), NEW.title, NEW.description,
      concat_ws(' ', json_extract(NEW.location, '$.name'), json_extract(NEW.address, '$.locality'),
        json_extract(NEW.address, '$.region'), json_extract(NEW.address, '$.country'))
    FROM search_doc d WHERE d.uri = NEW.uri;
END;
CREATE TRIGGER gallery_search_update AFTER UPDATE ON gallery BEGIN
  DELETE FROM gallery_search WHERE rowid = (SELECT id FROM search_doc WHERE uri = OLD.uri);
  INSERT INTO gallery_search (rowid, handle, title, description, place)
    SELECT d.id, (SELECT handle FROM repo WHERE did = NEW.did), NEW.title, NEW.description,
      concat_ws(' ', json_extract(NEW.location, '$.name'), json_extract(NEW.address, '$.locality'),
        json_extract(NEW.address, '$.region'), json_extract(NEW.address, '$.country'))
    FROM search_doc d WHERE d.uri = NEW.uri;
END;
CREATE TRIGGER gallery_search_delete AFTER DELETE ON gallery BEGIN
  DELETE FROM gallery_search WHERE rowid = (SELECT id FROM search_doc WHERE uri = OLD.uri);
  DELETE FROM search_doc WHERE uri = OLD.uri;
END;

CREATE TRIGGER repo_search_insert AFTER INSERT ON repo BEGIN
  UPDATE profile_search SET handle = NEW.handle WHERE rowid IN
    (SELECT d.id FROM profile p JOIN search_doc d ON d.uri = p.uri WHERE p.did = NEW.did);
  UPDATE gallery_search SET handle = NEW.handle WHERE rowid IN
    (SELECT d.id FROM gallery g JOIN search_doc d ON d.uri = g.uri WHERE g.did = NEW.did);
END;
CREATE TRIGGER repo_search_handle AFTER UPDATE OF handle ON repo BEGIN
  UPDATE profile_search SET handle = NEW.handle WHERE rowid IN
    (SELECT d.id FROM profile p JOIN search_doc d ON d.uri = p.uri WHERE p.did = NEW.did);
  UPDATE gallery_search SET handle = NEW.handle WHERE rowid IN
    (SELECT d.id FROM gallery g JOIN search_doc d ON d.uri = g.uri WHERE g.did = NEW.did);
END;

INSERT INTO search_doc (uri)
  -- scans: profile, as this version fills it once from what the index holds
  SELECT uri FROM profile;
INSERT INTO search_doc (uri)
  -- scans: gallery, as this version fills it once from what the index holds
  SELECT uri FROM gallery;
INSERT INTO profile_search (rowid, handle, display_name, description)
  -- scans: profile, as this version fills it once from what the index holds
  SELECT d.id, r.handle, p.display_name, p.description
  FROM profile p JOIN search_doc d ON d.uri = p.uri LEFT JOIN repo r ON r.did = p.did;
INSERT INTO gallery_search (rowid, handle, title, description, place)
  -- scans: gallery, as this version fills it once from what the index holds
  SELECT d.id, r.handle, g.title, g.description,
    concat_ws(' ', json_extract(g.location, '$.name'), json_extract(g.address, '$.locality'),
      json_extract(g.address, '$.region'), json_extract(g.address, '$.country'))
  FROM gallery g JOIN search_doc d ON d.uri = g.uri LEFT JOIN repo r ON r.did = g.did;
";

/// Notifications' own state: when each account last saw its
/// notifications, and how each kind reaches it.
const V5: &str = "
CREATE TABLE notification_seen (did TEXT PRIMARY KEY, seen_at TEXT NOT NULL) WITHOUT ROWID;
CREATE TABLE notification_pref (
  did TEXT NOT NULL, kind TEXT NOT NULL, push INTEGER NOT NULL, in_app INTEGER NOT NULL,
  from_follows INTEGER NOT NULL, PRIMARY KEY (did, kind)) WITHOUT ROWID;
";

/// The accounts comments and galleries mention, kept by triggers, and
/// filled from what the index holds.
const V6: &str = "
CREATE TABLE mention (did TEXT NOT NULL, uri TEXT NOT NULL, PRIMARY KEY (did, uri)) WITHOUT ROWID;
CREATE INDEX mention_uri ON mention (uri);

CREATE TRIGGER comment_mention_insert AFTER INSERT ON comment BEGIN
  INSERT OR IGNORE INTO mention (did, uri)
    SELECT json_extract(NEW.facets, t.path || '.did'), NEW.uri
    FROM json_tree(CASE WHEN json_valid(NEW.facets) THEN NEW.facets END) t
    WHERE t.key = '$type' AND t.atom = 'app.bsky.richtext.facet#mention'
      AND json_type(NEW.facets, t.path || '.did') = 'text';
END;
CREATE TRIGGER comment_mention_update AFTER UPDATE ON comment BEGIN
  DELETE FROM mention WHERE uri = OLD.uri;
  INSERT OR IGNORE INTO mention (did, uri)
    SELECT json_extract(NEW.facets, t.path || '.did'), NEW.uri
    FROM json_tree(CASE WHEN json_valid(NEW.facets) THEN NEW.facets END) t
    WHERE t.key = '$type' AND t.atom = 'app.bsky.richtext.facet#mention'
      AND json_type(NEW.facets, t.path || '.did') = 'text';
END;
CREATE TRIGGER comment_mention_delete AFTER DELETE ON comment BEGIN
  DELETE FROM mention WHERE uri = OLD.uri;
END;

CREATE TRIGGER gallery_mention_insert AFTER INSERT ON gallery BEGIN
  INSERT OR IGNORE INTO mention (did, uri)
    SELECT json_extract(NEW.facets, t.path || '.did'), NEW.uri
    FROM json_tree(CASE WHEN json_valid(NEW.facets) THEN NEW.facets END) t
    WHERE t.key = '$type' AND t.atom = 'app.bsky.richtext.facet#mention'
      AND json_type(NEW.facets, t.path || '.did') = 'text';
END;
CREATE TRIGGER gallery_mention_update AFTER UPDATE ON gallery BEGIN
  DELETE FROM mention WHERE uri = OLD.uri;
  INSERT OR IGNORE INTO mention (did, uri)
    SELECT json_extract(NEW.facets, t.path || '.did'), NEW.uri
    FROM json_tree(CASE WHEN json_valid(NEW.facets) THEN NEW.facets END) t
    WHERE t.key = '$type' AND t.atom = 'app.bsky.richtext.facet#mention'
      AND json_type(NEW.facets, t.path || '.did') = 'text';
END;
CREATE TRIGGER gallery_mention_delete AFTER DELETE ON gallery BEGIN
  DELETE FROM mention WHERE uri = OLD.uri;
END;

INSERT OR IGNORE INTO mention (did, uri)
  -- scans: comment, as this version fills it once from what the index holds
  SELECT json_extract(c.facets, t.path || '.did'), c.uri
  FROM comment c, json_tree(CASE WHEN json_valid(c.facets) THEN c.facets END) t
  WHERE t.key = '$type' AND t.atom = 'app.bsky.richtext.facet#mention'
    AND json_type(c.facets, t.path || '.did') = 'text';
INSERT OR IGNORE INTO mention (did, uri)
  -- scans: gallery, as this version fills it once from what the index holds
  SELECT json_extract(g.facets, t.path || '.did'), g.uri
  FROM gallery g, json_tree(CASE WHEN json_valid(g.facets) THEN g.facets END) t
  WHERE t.key = '$type' AND t.atom = 'app.bsky.richtext.facet#mention'
    AND json_type(g.facets, t.path || '.did') = 'text';
";

/// The web's logins: the OAuth client's keys and the sessions it holds.
const V7: &str = "
CREATE TABLE oauth_key (kid TEXT PRIMARY KEY, jwk TEXT NOT NULL) WITHOUT ROWID;
CREATE TABLE web_session (
  did TEXT PRIMARY KEY, session TEXT NOT NULL, since INTEGER NOT NULL,
  updated_at INTEGER NOT NULL) WITHOUT ROWID;
";

/// The label values that leave what carries them out of feeds: the
/// imperative ones, and those whose default is to hide.
pub const HIDDEN_LABELS: [&str; 9] = [
    "!hide",
    "!takedown",
    "csae",
    "spam",
    "copyright",
    "gore",
    "nsfl",
    "dmca-violation",
    "doxxing",
];

/// SQL that holds where the account `did` (a column or parameter) is
/// shown: no admin took it down, and its host does not say it is gone.
pub fn shown(did: &str) -> String {
    format!(
        "NOT EXISTS (SELECT 1 FROM takedown WHERE did = {did})
         AND NOT EXISTS (SELECT 1 FROM repo WHERE did = {did} AND host_status IS NOT NULL)"
    )
}

/// SQL that holds where the subject `uri` carries no label of
/// [`HIDDEN_LABELS`] that stands: one whose latest word is not a negation.
pub fn unhidden(uri: &str) -> String {
    let vals = HIDDEN_LABELS.map(|v| format!("'{v}'")).join(",");
    format!(
        "NOT EXISTS (SELECT 1 FROM label l WHERE l.uri = {uri} AND l.val IN ({vals})
           AND l.neg = 0 AND NOT EXISTS (SELECT 1 FROM label n WHERE n.uri = l.uri
             AND n.val = l.val AND n.neg = 1 AND n.cts > l.cts))"
    )
}

/// The key that opens the session cookies browsers held before grain-serve
/// set its own, for as long as [`crate::login::carryover`] carries them:
/// one row, if any, of 32 bytes.
const V8: &str = "
CREATE TABLE carried_cookie_key (key BLOB NOT NULL CHECK (length(key) = 32));
";

/// The records that have been pushed, so that none is pushed twice.
const V9: &str = "
CREATE TABLE push_record (uri TEXT PRIMARY KEY, at TEXT NOT NULL) WITHOUT ROWID;
CREATE INDEX push_record_at ON push_record (at);
";

/// What the classifiers scored ([`crate::index::classify`]).
const V10: &str = "
CREATE TABLE classification (
  subject TEXT NOT NULL,
  classifier TEXT NOT NULL,
  subject_did TEXT NOT NULL,
  signals TEXT NOT NULL,
  state TEXT,
  top_signal TEXT,
  top_score REAL NOT NULL DEFAULT 0,
  fingerprint TEXT NOT NULL,
  model TEXT,
  scanned_at TEXT NOT NULL,
  PRIMARY KEY (subject, classifier)
) WITHOUT ROWID;
CREATE INDEX classification_did ON classification (subject_did);
";

/// Reports by the reason atproto names them with, and found by the account
/// they are about.
const V11: &str = "
ALTER TABLE report ADD COLUMN reason_type TEXT;
CREATE INDEX report_subject_did ON report (subject_did, id);
";

/// No private galleries, so no record of whom one was shared with.
const V12: &str = "
DROP TABLE space_invite;
";
