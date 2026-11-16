use super::*;
use grain_serve::index::Index;
use grain_serve::index::records::{Gallery, GermDeclaration, Photo, PhotoExif};
use std::collections::HashMap;

const CID: &str = "bafyreia4w4bbvc5lqzkvexqlbwbagz5yfjfzzrqhfwqkhkk2xgekh4c6ai";
const BLOB: &str = "bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy";
const JETSTREAM: &str = "jetstream:wss://jetstream.us-west.bsky.network";

/// hatk's tables, as its `initDatabase` and grain's setup scripts make
/// them, and as its schema generator makes a collection's: the envelope,
/// then a column a field, in the lexicon's order. `social.grain.graph.block`
/// is from a hatk from before `space`; `social.grain.group.decline` is
/// from one from before the collection, so it has no table.
const HATK: &str = r#"
CREATE TABLE "social.grain.gallery" (uri TEXT PRIMARY KEY, cid TEXT, did TEXT NOT NULL,
  space TEXT, indexed_at TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT,
  "facets" TEXT, "labels" TEXT, "location" TEXT, "address" TEXT, "updated_at" TEXT,
  "created_at" TEXT NOT NULL);
CREATE TABLE "social.grain.gallery__labels_self_labels" (parent_uri TEXT NOT NULL,
  parent_did TEXT NOT NULL, "val" TEXT);
CREATE TABLE "social.grain.gallery.item" (uri TEXT PRIMARY KEY, cid TEXT, did TEXT NOT NULL,
  space TEXT, indexed_at TEXT NOT NULL, "created_at" TEXT NOT NULL, "gallery" TEXT NOT NULL,
  "item" TEXT NOT NULL, "position" INTEGER);
CREATE TABLE "social.grain.photo" (uri TEXT PRIMARY KEY, cid TEXT, did TEXT NOT NULL,
  space TEXT, indexed_at TEXT NOT NULL, "photo" TEXT NOT NULL, "alt" TEXT,
  "aspect_ratio" TEXT, "created_at" TEXT);
CREATE TABLE "social.grain.photo.exif" (uri TEXT PRIMARY KEY, cid TEXT, did TEXT NOT NULL,
  space TEXT, indexed_at TEXT NOT NULL, "photo" TEXT NOT NULL, "created_at" TEXT NOT NULL,
  "date_time_original" TEXT, "exposure_time" INTEGER, "f_number" INTEGER, "flash" TEXT,
  "focal_length_in35mm_format" INTEGER, "i_s_o" INTEGER, "lens_make" TEXT,
  "lens_model" TEXT, "make" TEXT, "model" TEXT);
CREATE TABLE "social.grain.actor.profile" (uri TEXT PRIMARY KEY, cid TEXT, did TEXT NOT NULL,
  space TEXT, indexed_at TEXT NOT NULL, "display_name" TEXT, "description" TEXT,
  "avatar" TEXT, "created_at" TEXT);
CREATE TABLE "social.grain.graph.follow" (uri TEXT PRIMARY KEY, cid TEXT, did TEXT NOT NULL,
  space TEXT, indexed_at TEXT NOT NULL, "subject" TEXT NOT NULL, "created_at" TEXT NOT NULL);
CREATE TABLE "social.grain.graph.block" (uri TEXT PRIMARY KEY, cid TEXT, did TEXT NOT NULL,
  indexed_at TEXT NOT NULL, "subject" TEXT NOT NULL, "created_at" TEXT NOT NULL);
CREATE TABLE "social.grain.favorite" (uri TEXT PRIMARY KEY, cid TEXT, did TEXT NOT NULL,
  space TEXT, indexed_at TEXT NOT NULL, "created_at" TEXT NOT NULL, "subject" TEXT NOT NULL);
CREATE TABLE "social.grain.comment" (uri TEXT PRIMARY KEY, cid TEXT, did TEXT NOT NULL,
  space TEXT, indexed_at TEXT NOT NULL, "text" TEXT NOT NULL, "facets" TEXT,
  "subject" TEXT NOT NULL, "focus" TEXT, "reply_to" TEXT, "created_at" TEXT NOT NULL);
CREATE TABLE "social.grain.story" (uri TEXT PRIMARY KEY, cid TEXT, did TEXT NOT NULL,
  space TEXT, indexed_at TEXT NOT NULL, "media" TEXT NOT NULL, "aspect_ratio" TEXT NOT NULL,
  "location" TEXT, "address" TEXT, "labels" TEXT, "created_at" TEXT NOT NULL);
CREATE TABLE "social.grain.group.item" (uri TEXT PRIMARY KEY, cid TEXT, did TEXT NOT NULL,
  space TEXT, indexed_at TEXT NOT NULL, "gallery" TEXT NOT NULL, "submission" TEXT,
  "created_at" TEXT NOT NULL);
CREATE TABLE "social.grain.group.submission" (uri TEXT PRIMARY KEY, cid TEXT,
  did TEXT NOT NULL, space TEXT, indexed_at TEXT NOT NULL, "group" TEXT NOT NULL,
  "gallery" TEXT NOT NULL, "created_at" TEXT NOT NULL);
CREATE TABLE "fyi.opensocial.declaration" (uri TEXT PRIMARY KEY, cid TEXT, did TEXT NOT NULL,
  space TEXT, indexed_at TEXT NOT NULL, "meta" TEXT NOT NULL, "created_at" TEXT NOT NULL);
CREATE TABLE "app.bsky.feed.post" (uri TEXT PRIMARY KEY, cid TEXT, did TEXT NOT NULL,
  space TEXT, indexed_at TEXT NOT NULL, "tags" TEXT, "text" TEXT NOT NULL, "embed" TEXT,
  "langs" TEXT, "reply" TEXT, "facets" TEXT, "labels" TEXT, "created_at" TEXT NOT NULL);
CREATE TABLE "app.bsky.feed.post__entities" (parent_uri TEXT NOT NULL,
  parent_did TEXT NOT NULL, "type" TEXT NOT NULL, "index" TEXT NOT NULL, "value" TEXT NOT NULL);
CREATE TABLE "app.bsky.graph.follow" (uri TEXT PRIMARY KEY, cid TEXT, did TEXT NOT NULL,
  space TEXT, indexed_at TEXT NOT NULL, "subject" TEXT NOT NULL, "created_at" TEXT NOT NULL);
CREATE TABLE "com.germnetwork.declaration" (uri TEXT PRIMARY KEY, cid TEXT, did TEXT NOT NULL,
  space TEXT, indexed_at TEXT NOT NULL, "version" TEXT NOT NULL, "current_key" BLOB NOT NULL,
  "message_me" TEXT, "key_package" BLOB, "continuity_proofs" TEXT);
CREATE TABLE "app.bsky.actor.profile" (uri TEXT PRIMARY KEY, cid TEXT, did TEXT NOT NULL,
  space TEXT, indexed_at TEXT NOT NULL, "display_name" TEXT, "description" TEXT,
  "avatar" TEXT, "banner" TEXT, "created_at" TEXT);
CREATE TABLE _fts_social_grain_gallery (uri TEXT, title TEXT);

CREATE TABLE _repos (did TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'pending', handle TEXT,
  backfilled_at TEXT, rev TEXT, retry_count INTEGER NOT NULL DEFAULT 0,
  retry_after INTEGER NOT NULL DEFAULT 0);
CREATE TABLE _cursor (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE _labels (id INTEGER PRIMARY KEY AUTOINCREMENT, src TEXT NOT NULL,
  uri TEXT NOT NULL, val TEXT NOT NULL, neg INTEGER DEFAULT 0, cts TEXT NOT NULL, exp TEXT);
CREATE TABLE _preferences (did TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (did, key));
CREATE TABLE _reports (id INTEGER PRIMARY KEY AUTOINCREMENT, subject_uri TEXT NOT NULL,
  subject_did TEXT NOT NULL, label TEXT NOT NULL, reason TEXT, reported_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', resolved_by TEXT, resolved_at TEXT,
  created_at TEXT NOT NULL);
CREATE TABLE _push_tokens (did TEXT NOT NULL, token TEXT NOT NULL, platform TEXT NOT NULL,
  created_at TEXT NOT NULL, PRIMARY KEY (did, token));
CREATE TABLE _oauth_keys (kid TEXT PRIMARY KEY, private_key TEXT NOT NULL,
  public_key TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE _oauth_sessions (did TEXT PRIMARY KEY, pds_endpoint TEXT NOT NULL,
  pds_auth_server TEXT, pds_token_endpoint TEXT, access_token TEXT NOT NULL,
  refresh_token TEXT, dpop_jkt TEXT NOT NULL, token_expires_at INTEGER, requested_scope TEXT,
  granted_scope TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE _mutes (did TEXT NOT NULL, subject TEXT NOT NULL, created_at TEXT NOT NULL,
  PRIMARY KEY (did, subject));
CREATE TABLE _space_support (pds_endpoint TEXT PRIMARY KEY, supported INTEGER NOT NULL,
  missing TEXT NOT NULL, checked_at TEXT NOT NULL);
CREATE TABLE _story_views (did TEXT NOT NULL, subject TEXT NOT NULL, created_at TEXT NOT NULL,
  PRIMARY KEY (did, subject));
"#;

/// What the network cannot rebuild, several rows a table, and its edges.
const KEPT_ROWS: &str = r#"
INSERT INTO _repos VALUES
  ('did:plc:alice', 'active', 'alice.test', '2025-01-01T00:00:00.000Z', '3l1', 0, 0),
  ('did:plc:bob', 'takendown', 'bob.test', '2025-01-01T00:00:00.000Z', '3l2', 0, 0),
  ('did:plc:carol', 'deactivated', 'carol.test', '2025-01-01T00:00:00.000Z', '3l3', 0, 0),
  ('did:plc:dave', 'deleted', 'dave.test', NULL, NULL, 0, 0),
  ('did:plc:erin', 'pending', NULL, NULL, NULL, 0, 0),
  ('did:plc:frank', 'failed', 'frank.test', NULL, NULL, 2, 1730000000),
  ('did:plc:gina', 'failed', 'gina.test', NULL, NULL, 999, 0),
  ('did:plc:hank', 'takendown', NULL, NULL, NULL, 0, 0),
  ('did:plc:ivan', 'weird', 'ivan.test', NULL, '3l9', 0, 0);
INSERT INTO _cursor VALUES
  ('jetstream:wss://jetstream.us-west.bsky.network', '1730000000000000'),
  ('relay:wss://bsky.network', '42');
INSERT INTO _labels VALUES
  (3, 'did:web:grain.social', 'at://did:plc:alice/social.grain.gallery/3l3qo2vuowo2a', 'nudity', 0, '2025-01-02T00:00:00.000Z', NULL),
  (5, 'admin', 'did:plc:bob', 'spam', 0, '2025-01-03T00:00:00.000Z', NULL),
  (6, 'admin', 'did:plc:bob', 'spam', 1, '2025-01-04T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  (9, 'self', 'at://did:plc:carol/social.grain.photo/3l3qo2vuowo2a', 'spam', NULL, '2025-01-05T00:00:00.000Z', NULL);
INSERT INTO _reports VALUES
  (1, 'at://did:plc:bob/social.grain.gallery/3l3qo2vuowo2a', 'did:plc:bob', 'spam', 'ads', 'did:plc:alice', 'open', NULL, NULL, '2025-01-06T00:00:00.000Z'),
  (4, 'did:plc:carol', 'did:plc:carol', 'rude', NULL, 'did:plc:alice', 'resolved', 'did:plc:admin', '2025-01-08T00:00:00.000Z', '2025-01-07T00:00:00.000Z'),
  (7, 'at://did:plc:bob/social.grain.photo/3l3qo2vuowo2a', 'did:plc:bob', 'nudity', 'nsfw: nudity 0.91', 'system:nsfw', 'dismissed', 'admin', '2025-01-09T00:00:00.000Z', '2025-01-08T00:00:00.000Z');
INSERT INTO _push_tokens VALUES
  ('did:plc:alice', 'apns-token', 'apns', '2025-01-01T00:00:00.000Z'),
  ('did:plc:alice', 'fcm-token', 'fcm', '2025-01-02T00:00:00.000Z'),
  ('did:plc:bob', '{"endpoint":"https://push.example/1"}', 'web', '2025-01-03T00:00:00.000Z'),
  ('did:plc:carol', 'later-token', 'later', '2025-01-04T00:00:00.000Z');
INSERT INTO _preferences VALUES
  ('did:plc:alice', 'lastSeenNotifications', '"2025-01-01T00:00:00.000Z"', '2025-01-01T00:00:00.000Z'),
  ('did:plc:alice', 'contentLabels', '{"nudity":"warn"}', '2025-01-02 00:00:00'),
  ('did:plc:alice', 'notificationPrefs', '{"favorites":{"push":true,"inApp":false,"from":"all"},"follows":{"push":false,"inApp":true,"from":"follows"},"comments":{"push":true,"inApp":true,"from":"all"}}', '2025-01-03T00:00:00.000Z'),
  ('did:plc:carol', 'lastSeenNotifications', '"2025-01-04T05:30:00+05:30"', '2025-01-04T00:00:00.000Z'),
  ('did:plc:carol', 'notificationPrefs', '{"mentions":{"inApp":false},"favorites":"off","later":{"push":false}}', '2025-01-05T00:00:00.000Z'),
  ('did:plc:dave', 'notificationPrefs', 'not json', '2025-01-06T00:00:00.000Z');
INSERT INTO _mutes VALUES
  ('did:plc:alice', 'did:plc:bob', '2025-01-01T00:00:00.000Z'),
  ('did:plc:carol', 'did:plc:bob', '2025-01-02T00:00:00.000Z');
INSERT INTO _story_views VALUES
  ('did:plc:alice', 'at://did:plc:bob/social.grain.story/3l3qo2vuowo2a', '2025-01-01T00:00:00.000Z'),
  ('did:plc:carol', 'at://did:plc:bob/social.grain.story/3l3qo2vuowo2a', '2025-01-02T00:00:00.000Z');
INSERT INTO _space_support VALUES
  ('https://pds.example', 1, '[]', '2025-01-01T00:00:00.000Z'),
  ('https://old.example', 0, '["com.atproto.space.createSpace"]', '2025-01-02T00:00:00.000Z');
INSERT INTO _oauth_keys VALUES ('appview-oauth-key', '$HATK_KEY', 'public', '2025-01-01 00:00:00'),
  ('pds-client-auth-key', '{"key_ops":["sign"],"ext":true,"kty":"EC","x":"6wVOcgpdJpSGVwhFhUNcCtEGehv3oVbm3Vfspb8z_7w","y":"ezlUp0nPpJHIlRVbUBOb0KitkEVV7uLvtdfWFUmHgzw","crv":"P-256","d":"7YBtWZgfb9lUSihC1h2-HySNJopUjlS4GBsoVC-rZd4"}', 'public', '2025-01-01 00:00:00');
INSERT INTO _oauth_sessions (did, pds_endpoint, pds_auth_server, pds_token_endpoint,
  access_token, refresh_token, dpop_jkt, token_expires_at, requested_scope) VALUES
  ('did:plc:alice', 'https://pds.example', 'https://auth.example',
   'https://auth.example/oauth/token', 'a', 'r', '$JKT', 1800000000, 'atproto'),
  ('did:plc:erin', 'https://pds.example', NULL, NULL, 'a', 'r', '$JKT', NULL, NULL),
  ('did:plc:carol', 'https://pds.example', NULL, NULL, 'a', NULL, '$JKT', NULL, NULL),
  ('did:plc:dave', 'https://pds.example', NULL, NULL, 'a', 'r', 'another key', NULL, NULL);
INSERT INTO _fts_social_grain_gallery VALUES ('at://did:plc:alice/social.grain.gallery/3l3qo2vuowo2a', 'Fog');
"#;

/// A record of each collection, as hatk kept it, and some it should not
/// have: in a space, with no CID, under another's URI, not fitting.
fn record_rows() -> String {
    let rows = r#"
INSERT INTO "social.grain.gallery" VALUES
  ('at://did:plc:alice/social.grain.gallery/3l3qo2vuowo2a', '$CID', 'did:plc:alice', NULL,
   '2025-01-02T03:04:05.678Z', 'Fog', '#fog',
   '[{"index":{"byteStart":0,"byteEnd":4},"features":[{"$type":"app.bsky.richtext.facet#tag","tag":"fog"}]}]',
   '{"$type":"com.atproto.label.defs#selfLabels","values":[{"val":"nudity"},{"val":"gore"}]}',
   '{"value":"8a28a98a4c67fff","name":"Ocean Beach"}', NULL, NULL, '2025-01-01T00:00:00.000Z'),
  ('at://did:plc:alice/social.grain.gallery/3l3qo2vuowo2b', '$CID', 'did:plc:alice',
   'ats://did:plc:alice/social.grain.space/one', '2025-01-02T03:04:05.678Z', 'Shared', NULL,
   NULL, NULL, NULL, NULL, NULL, '2025-01-01T00:00:00.000Z'),
  ('at://did:plc:alice/social.grain.gallery/3l3qo2vuowo2c', NULL, 'did:plc:alice', NULL,
   '2025-01-02T03:04:05.678Z', 'No CID', NULL, NULL, NULL, NULL, NULL, NULL, '2025-01-01T00:00:00.000Z'),
  ('at://did:plc:bob/social.grain.gallery/3l3qo2vuowo2d', '$CID', 'did:plc:alice', NULL,
   '2025-01-02T03:04:05.678Z', 'Not mine', NULL, NULL, NULL, NULL, NULL, NULL, '2025-01-01T00:00:00.000Z');
INSERT INTO "social.grain.gallery__labels_self_labels" VALUES
  ('at://did:plc:alice/social.grain.gallery/3l3qo2vuowo2a', 'did:plc:alice', 'nudity');
INSERT INTO "social.grain.gallery.item" VALUES
  ('at://did:plc:alice/social.grain.gallery.item/3l3qo2vuowo2a', '$CID', 'did:plc:alice', NULL,
   '2025-01-03T00:00:00.000Z', '2025-01-01T00:00:00.000Z',
   'at://did:plc:alice/social.grain.gallery/3l3qo2vuowo2a',
   'at://did:plc:alice/social.grain.photo/3l3qo2vuowo2a', 2),
  ('at://did:plc:alice/social.grain.gallery.item/3l3qo2vuowo2b', '$CID', 'did:plc:alice', NULL,
   '2025-01-03T00:00:00.000Z', '2025-01-01T00:00:00.000Z',
   'at://did:plc:alice/social.grain.gallery/3l3qo2vuowo2a',
   'at://did:plc:alice/social.grain.photo/3l3qo2vuowo2b', NULL);
INSERT INTO "social.grain.photo" VALUES
  ('at://did:plc:alice/social.grain.photo/3l3qo2vuowo2a', '$CID', 'did:plc:alice', NULL,
   '2025-01-04T00:00:00.000Z',
   '{"ref":{"$link":"$BLOB"},"size":9727,"$type":"blob","mimeType":"image/jpeg"}', 'Fog',
   '{"width":4,"height":3}', '2025-01-01T00:00:00.000Z'),
  ('at://did:plc:alice/social.grain.photo/3l3qo2vuowo2b', '$CID', 'did:plc:alice', NULL,
   '2025-01-04T00:00:00.000Z',
   '{"ref":{"$link":"$BLOB"},"size":9727,"$type":"blob","mimeType":"image/jpeg"}', NULL,
   NULL, '2025-01-01T00:00:00.000Z'),
  ('at://did:plc:alice/social.grain.photo/3l3qo2vuowo2c', '$CID', 'did:plc:alice', NULL,
   '2025-01-04T00:00:00.000Z', 'not json', NULL, '{"width":4,"height":3}',
   '2025-01-01T00:00:00.000Z');
INSERT INTO "social.grain.photo.exif" VALUES
  ('at://did:plc:alice/social.grain.photo.exif/3l3qo2vuowo2a', '$CID', 'did:plc:alice', NULL,
   '2025-01-05T00:00:00.000Z', 'at://did:plc:alice/social.grain.photo/3l3qo2vuowo2a',
   '2025-01-01T00:00:00.000Z', NULL, NULL, 2800000, NULL, 50000000, 400, NULL,
   'GR lens', 'RICOH', 'GR III'),
  ('at://did:plc:alice/social.grain.photo.exif/3l3qo2vuowo2b', '$CID', 'did:plc:alice', NULL,
   '2025-01-05T00:00:00.000Z', 'at://did:plc:alice/social.grain.photo/3l3qo2vuowo2b',
   '2025-01-01T00:00:00.000Z', NULL, 0.5, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO "social.grain.actor.profile" VALUES
  ('at://did:plc:alice/social.grain.actor.profile/self', '$CID', 'did:plc:alice', NULL,
   '2025-01-06T00:00:00.000Z', 'Alice', 'Fog, mostly',
   '{"ref":{"$link":"$BLOB"},"size":100,"$type":"blob","mimeType":"image/png"}', NULL);
INSERT INTO "social.grain.graph.follow" VALUES
  ('at://did:plc:alice/social.grain.graph.follow/3l3qo2vuowo2a', '$CID', 'did:plc:alice', NULL,
   '2025-01-07T00:00:00.000Z', 'did:plc:bob', '2025-01-01T00:00:00.000Z');
INSERT INTO "social.grain.graph.block" VALUES
  ('at://did:plc:alice/social.grain.graph.block/3l3qo2vuowo2a', '$CID', 'did:plc:alice',
   '2025-01-08T00:00:00.000Z', 'did:plc:carol', '2025-01-01T00:00:00.000Z');
INSERT INTO "social.grain.favorite" VALUES
  ('at://did:plc:bob/social.grain.favorite/3l3qo2vuowo2a', '$CID', 'did:plc:bob', NULL,
   '2025-01-09T00:00:00.000Z', '2025-01-01T00:00:00.000Z',
   'at://did:plc:alice/social.grain.gallery/3l3qo2vuowo2a');
INSERT INTO "social.grain.comment" VALUES
  ('at://did:plc:bob/social.grain.comment/3l3qo2vuowo2a', '$CID', 'did:plc:bob', NULL,
   '2025-01-10T00:00:00.000Z', 'lovely @alice.test',
   '[{"index":{"byteStart":7,"byteEnd":18},"features":[{"$type":"app.bsky.richtext.facet#mention","did":"did:plc:alice"}]}]',
   'at://did:plc:alice/social.grain.gallery/3l3qo2vuowo2a', NULL, NULL,
   '2025-01-01T00:00:00.000Z');
INSERT INTO "social.grain.story" VALUES
  ('at://did:plc:bob/social.grain.story/3l3qo2vuowo2a', '$CID', 'did:plc:bob', NULL,
   '2025-01-11T00:00:00.000Z',
   '{"ref":{"$link":"$BLOB"},"size":27615,"$type":"blob","mimeType":"image/jpeg"}',
   '{"width":9,"height":16}', NULL, NULL,
   '{"$type":"com.atproto.label.defs#selfLabels","values":[{"val":"spam"}]}',
   '2025-01-01T00:00:00.000Z');
INSERT INTO "social.grain.group.item" VALUES
  ('at://did:plc:group/social.grain.group.item/3l3qo2vuowo2a', '$CID', 'did:plc:group', NULL,
   '2025-01-12T00:00:00.000Z', 'at://did:plc:alice/social.grain.gallery/3l3qo2vuowo2a',
   'at://did:plc:alice/social.grain.group.submission/3l3qo2vuowo2a', '2025-01-01T00:00:00.000Z');
INSERT INTO "social.grain.group.submission" VALUES
  ('at://did:plc:alice/social.grain.group.submission/3l3qo2vuowo2a', '$CID', 'did:plc:alice',
   NULL, '2025-01-13T00:00:00.000Z', 'did:plc:group',
   'at://did:plc:alice/social.grain.gallery/3l3qo2vuowo2a', '2025-01-01T00:00:00.000Z');
INSERT INTO "fyi.opensocial.declaration" VALUES
  ('at://did:plc:group/fyi.opensocial.declaration/self', '$CID', 'did:plc:group', NULL,
   '2025-01-14T00:00:00.000Z', 'at://did:plc:group/space/fyi.opensocial.about/self',
   '2025-01-01T00:00:00.000Z');
INSERT INTO "app.bsky.feed.post" VALUES
  ('at://did:plc:alice/app.bsky.feed.post/3l3qo2vuowo2a', '$CID', 'did:plc:alice', NULL,
   '2025-01-15T00:00:00.000Z', NULL, 'new gallery',
   '{"$type":"app.bsky.embed.external","external":{"uri":"https://grain.social/","title":"Fog","description":""}}',
   '["en"]', NULL, NULL, NULL, '2025-01-01T00:00:00.000Z');
INSERT INTO "app.bsky.graph.follow" VALUES
  ('at://did:plc:alice/app.bsky.graph.follow/3l3qo2vuowo2a', '$CID', 'did:plc:alice', NULL,
   '2025-01-16T00:00:00.000Z', 'did:plc:bob', '2025-01-01T00:00:00.000Z');
INSERT INTO "com.germnetwork.declaration" VALUES
  ('at://did:plc:alice/com.germnetwork.declaration/self', '$CID', 'did:plc:alice', NULL,
   '2025-01-17T00:00:00.000Z', '1.1.0', x'010203',
   '{"messageMeUrl":"https://landing.ger.mx/newUser","showButtonTo":"usersIFollow"}', NULL,
   '[{"0":1,"1":2}]'),
  ('at://did:plc:bob/com.germnetwork.declaration/self', '$CID', 'did:plc:bob', NULL,
   '2025-01-17T00:00:00.000Z', '1.1.0', '3,55,54', NULL, '', '[{"$bytes":"AQID"}]'),
  ('at://did:plc:carol/com.germnetwork.declaration/self', '$CID', 'did:plc:carol', NULL,
   '2025-01-17T00:00:00.000Z', '1.1.0', '{"$bytes":"AQID"}', NULL, NULL, NULL),
  ('at://did:plc:dave/com.germnetwork.declaration/self', '$CID', 'did:plc:dave', NULL,
   '2025-01-17T00:00:00.000Z', '1.1.0', 'nope', NULL, NULL, NULL);
INSERT INTO "app.bsky.actor.profile" VALUES
  ('at://did:plc:alice/app.bsky.actor.profile/self', '$CID', 'did:plc:alice', NULL,
   '2025-01-18T00:00:00.000Z', 'Alice', NULL, NULL, NULL, NULL);
"#;
    rows.replace("$CID", CID).replace("$BLOB", BLOB)
}

/// hatk's database, of `sql` past its tables, in `dir`.
fn hatk(dir: &Path, sql: &str) -> PathBuf {
    let path = dir.join("grain.db");
    let db = Connection::open(&path).unwrap();
    db.execute_batch(HATK).unwrap();
    db.execute_batch(sql).unwrap();
    path
}

/// A client key as WebCrypto exports one, with the members
/// it adds.
const CLIENT_KEY: &str = r#"{"key_ops":["sign"],"ext":true,"kty":"EC","x":"6wVOcgpdJpSGVwhFhUNcCtEGehv3oVbm3Vfspb8z_7w","y":"ezlUp0nPpJHIlRVbUBOb0KitkEVV7uLvtdfWFUmHgzw","crv":"P-256","d":"7YBtWZgfb9lUSihC1h2-HySNJopUjlS4GBsoVC-rZd4"}"#;

/// The whole of hatk's fixture database in `dir`.
fn full(dir: &Path) -> PathBuf {
    hatk(dir, &format!("{}{}", kept_rows(), record_rows()))
}

/// [`KEPT_ROWS`], with hatk's key in it, and what its sessions are bound to.
fn kept_rows() -> String {
    let key = grain_serve::login::from_jwk(CLIENT_KEY).unwrap();
    KEPT_ROWS
        .replace("$HATK_KEY", CLIENT_KEY)
        .replace("$JKT", &thumbprint(&key))
}

const URL: Option<&str> = Some("https://grain.social");

/// Each row `sql` reads, its values joined by `|`.
fn dump(db: &Connection, sql: &str) -> Vec<String> {
    let mut stmt = db.prepare(sql).unwrap();
    let n = stmt.column_count();
    let rows = stmt.query_map([], |r| {
        let cells = (0..n).map(|i| {
            Ok(match r.get::<_, Sql>(i)? {
                Sql::Null => "null".to_string(),
                Sql::Integer(i) => i.to_string(),
                Sql::Real(f) => f.to_string(),
                Sql::Text(t) => t,
                Sql::Blob(b) => format!("{b:?}"),
            })
        });
        Ok(cells.collect::<rusqlite::Result<Vec<_>>>()?.join("|"))
    });
    rows.unwrap().collect::<rusqlite::Result<_>>().unwrap()
}

fn kept<'a>(summary: &'a Summary, table: &str) -> &'a Tally {
    summary.kept.iter().find(|t| t.table == table).unwrap()
}

#[test]
fn every_row_of_what_the_network_cannot_rebuild_is_imported() {
    let dir = tempfile::tempdir().unwrap();
    let old = full(dir.path());
    let into = dir.path().join("index.db");
    let summary = import(&old, &into, false, URL).unwrap();
    assert!(summary.written, "{summary}");
    let db = Connection::open(&into).unwrap();
    let rows = |sql| dump(&db, sql);

    // Each table, row for row: what each hatk row is here, in full.
    assert_eq!(
        rows(
            "SELECT did, handle, state, host_status, rev, backfilled_at, retry_count,
                retry_after, last_error FROM repo ORDER BY did"
        ),
        [
            "did:plc:alice|alice.test|active|null|3l1|2025-01-01T00:00:00.000Z|0|0|null",
            // An admin's takedown leaves the repo as backfill had it.
            "did:plc:bob|bob.test|active|null|3l2|2025-01-01T00:00:00.000Z|0|0|null",
            // What a host said is what the host said, apart from takedowns.
            "did:plc:carol|carol.test|active|deactivated|3l3|2025-01-01T00:00:00.000Z|0|0|null",
            "did:plc:dave|dave.test|pending|deleted|null|null|0|0|null",
            "did:plc:erin|null|pending|null|null|null|0|0|null",
            // A failure hatk would try again is tried again, when it said.
            "did:plc:frank|frank.test|pending|null|null|null|2|1730000000|null",
            "did:plc:gina|gina.test|failed|null|null|null|999|0|null",
            "did:plc:hank|null|pending|null|null|null|0|0|null",
            "did:plc:ivan|ivan.test|pending|null|3l9|null|0|0|hatk had it weird",
        ]
    );
    let takedowns = rows("SELECT did, at FROM takedown ORDER BY did");
    assert_eq!(takedowns.len(), 2, "{takedowns:?}");
    for (row, did) in takedowns.iter().zip(["did:plc:bob", "did:plc:hank"]) {
        let (by, at) = row.split_once('|').unwrap();
        assert_eq!(by, did);
        assert!(lexicon::valid_datetime(at), "{at}");
    }
    assert_eq!(
        rows("SELECT source, seq, typeof(seq) FROM stream_cursor"),
        [format!("{JETSTREAM}|1730000000000000|integer")]
    );
    assert_eq!(
        rows("SELECT id, src, uri, val, neg, cts, exp FROM label ORDER BY id"),
        [
            "3|did:web:grain.social|at://did:plc:alice/social.grain.gallery/3l3qo2vuowo2a|nudity|0|2025-01-02T00:00:00.000Z|null",
            // An account's, on its bare DID, given and then negated.
            // hatk's own, from its admin routes and its rules, grain's.
            "5|did:web:grain.social|did:plc:bob|spam|0|2025-01-03T00:00:00.000Z|null",
            "6|did:web:grain.social|did:plc:bob|spam|1|2025-01-04T00:00:00.000Z|2026-01-01T00:00:00.000Z",
            "9|did:web:grain.social|at://did:plc:carol/social.grain.photo/3l3qo2vuowo2a|spam|0|2025-01-05T00:00:00.000Z|null",
        ]
    );
    assert_eq!(
        rows("SELECT * FROM report ORDER BY id"),
        [
            "1|at://did:plc:bob/social.grain.gallery/3l3qo2vuowo2a|did:plc:bob|spam|ads|did:plc:alice|open|null|null|2025-01-06T00:00:00.000Z|null",
            "4|did:plc:carol|did:plc:carol|rude|null|did:plc:alice|resolved|did:plc:admin|2025-01-08T00:00:00.000Z|2025-01-07T00:00:00.000Z|null",
            // The old server's own, and its admin's closing, are the server's.
            "7|at://did:plc:bob/social.grain.photo/3l3qo2vuowo2a|did:plc:bob|nudity|system:nsfw: nsfw: nudity 0.91|did:web:grain.social|dismissed|did:web:grain.social|2025-01-09T00:00:00.000Z|2025-01-08T00:00:00.000Z|null",
        ]
    );
    assert_eq!(
        rows("SELECT did, token, platform, created_at FROM push_token ORDER BY created_at"),
        [
            "did:plc:alice|apns-token|ios|2025-01-01T00:00:00.000Z",
            "did:plc:alice|fcm-token|android|2025-01-02T00:00:00.000Z",
            r#"did:plc:bob|{"endpoint":"https://push.example/1"}|web|2025-01-03T00:00:00.000Z"#,
            "did:plc:carol|later-token|later|2025-01-04T00:00:00.000Z",
        ]
    );
    assert_eq!(
        rows("SELECT did, key, value, updated_at FROM preference ORDER BY key"),
        [r#"did:plc:alice|contentLabels|{"nudity":"warn"}|2025-01-02 00:00:00"#]
    );
    // Notifications' preferences, tables of their own: a seen time in
    // UTC, and a row a kind, as hatk read each.
    assert_eq!(
        rows("SELECT did, seen_at FROM notification_seen ORDER BY did"),
        [
            "did:plc:alice|2025-01-01T00:00:00.000Z",
            "did:plc:carol|2025-01-04T00:00:00.000Z",
        ]
    );
    assert_eq!(
        rows(
            "SELECT did, kind, push, in_app, from_follows FROM notification_pref ORDER BY did, kind"
        ),
        [
            "did:plc:alice|comments|1|1|0",
            "did:plc:alice|favorites|1|0|0",
            "did:plc:alice|follows|0|1|1",
            // Left out, a kind is on.
            "did:plc:carol|mentions|1|0|0",
        ]
    );
    assert_eq!(
        rows("SELECT did, subject, created_at FROM mute ORDER BY did"),
        [
            "did:plc:alice|did:plc:bob|2025-01-01T00:00:00.000Z",
            "did:plc:carol|did:plc:bob|2025-01-02T00:00:00.000Z",
        ]
    );
    assert_eq!(
        rows("SELECT did, subject, created_at FROM story_view ORDER BY did"),
        [
            "did:plc:alice|at://did:plc:bob/social.grain.story/3l3qo2vuowo2a|2025-01-01T00:00:00.000Z",
            "did:plc:carol|at://did:plc:bob/social.grain.story/3l3qo2vuowo2a|2025-01-02T00:00:00.000Z",
        ]
    );
    assert_eq!(
        rows(
            "SELECT pds_endpoint, supported, missing, checked_at FROM space_support ORDER BY checked_at"
        ),
        [
            "https://pds.example|1|[]|2025-01-01T00:00:00.000Z",
            r#"https://old.example|0|["com.atproto.space.createSpace"]|2025-01-02T00:00:00.000Z"#,
        ]
    );

    // And as the summary counts them, each whole.
    let counts: Vec<_> = summary
        .kept
        .iter()
        .map(|t| (t.table, t.source, t.imported))
        .collect();
    assert_eq!(
        counts,
        [
            ("repo", 9, 9),
            ("takedown", 2, 2),
            ("stream_cursor", 1, 1),
            ("label", 4, 4),
            ("report", 3, 3),
            ("mute", 2, 2),
            ("preference", 1, 1),
            ("notification_seen", 2, 2),
            ("notification_pref", 4, 4),
            ("push_token", 4, 4),
            ("story_view", 2, 2),
            ("oauth_key", 1, 1),
            ("space_support", 2, 2),
        ]
    );
    assert!(summary.failed.is_empty(), "{:?}", summary.failed);
    // The client's key, and none of the others.
    assert_eq!(
        rows("SELECT kid, jwk FROM oauth_key"),
        [format!("pds-client-auth-key|{CLIENT_KEY}")]
    );

    // The key hatk's cookies were sealed under, drawn as hatk draws it:
    // the bytes grain-serve's carryover tests open hatk's own cookies with.
    let key = "a0fb2a23a97fa7176425a2702c7ca2a8591deb89b7246a792454bc61e52a6903";
    assert_eq!(
        rows("SELECT hex(key) FROM carried_cookie_key"),
        [key.to_uppercase()]
    );
    assert!(summary.cookie_key);
    assert!(cookie_key("{").is_err());

    // The web sessions bound to hatk's key, with a refresh token to go on.
    let carried = &summary.sessions;
    assert_eq!((carried.source, carried.imported), (4, 2));
    assert_eq!(summary.sessions_left, None);
    assert_eq!(
        rows("SELECT did, since FROM web_session ORDER BY did"),
        ["did:plc:alice|0", "did:plc:erin|0"]
    );
    assert_eq!(summary.unrecognized, [("weird".to_string(), 1)]);

    // As the index reads them.
    drop(db);
    let index = Index::open(&into).unwrap();
    // The web's client signs with it, as it was exported.
    let web =
        grain_serve::login::Web::new("https://grain.social", &index, "https://pds.test").unwrap();
    let jwks = web.client.jwks();
    let key = &jwks["keys"][0];
    assert_eq!(
        (&key["kid"], &key["x"]),
        (
            &json!("pds-client-auth-key"),
            &json!("6wVOcgpdJpSGVwhFhUNcCtEGehv3oVbm3Vfspb8z_7w")
        )
    );
    assert_eq!(index.cursor(JETSTREAM).unwrap(), Some(1730000000000000));
    assert!(index.taken_down("did:plc:bob").unwrap());
    assert!(!index.taken_down("did:plc:carol").unwrap());
    let host = |did| index.host_status(did).unwrap();
    assert_eq!(host("did:plc:carol").as_deref(), Some("deactivated"));
    assert_eq!(host("did:plc:bob"), None);
    assert!(index.tracks("did:plc:erin"));
    let negated: Vec<bool> = index
        .labels("did:plc:bob")
        .unwrap()
        .iter()
        .map(|l| l.neg)
        .collect();
    assert_eq!(negated, [false, true]);
    // What a PDS was found to serve is what grain-serve asks before it
    // asks the PDS again.
    let (found, _) = index.space_support("https://pds.example").unwrap().unwrap();
    assert!(found.supported && found.missing.is_empty());
    let (found, _) = index.space_support("https://old.example").unwrap().unwrap();
    assert_eq!(
        (found.supported, found.missing),
        (false, vec!["com.atproto.space.createSpace".to_string()])
    );
    let label = index.label(&grain_serve::index::Label {
        src: "did:web:grain.social".into(),
        uri: "did:plc:erin".into(),
        val: "spam".into(),
        neg: false,
        cts: "2025-02-01T00:00:00.000Z".into(),
        exp: None,
    });
    assert_eq!(label.unwrap(), 10, "labels go on numbering past hatk's");

    // A session as hatk held it, for grain's client, bound to hatk's key.
    let alice = index.web_session("did:plc:alice").unwrap().unwrap().session;
    let key = grain_serve::login::from_jwk(CLIENT_KEY).unwrap();
    let o = alice.oauth.clone().unwrap();
    assert_eq!(o.key().unwrap().to_bytes(), key.to_bytes());
    assert_eq!(
        (
            alice.handle.as_str(),
            alice.service.as_str(),
            alice.access_jwt.as_str(),
            alice.refresh_jwt.as_str()
        ),
        ("alice.test", "https://pds.example", "a", "r")
    );
    assert_eq!(o.issuer, "https://auth.example");
    assert_eq!(o.token_endpoint, "https://auth.example/oauth/token");
    assert_eq!(
        o.client_id.as_deref(),
        Some("https://grain.social/oauth-client-metadata.json")
    );
    assert_eq!(
        (o.scope.as_deref(), o.expires_at),
        (Some("atproto"), 1800000000)
    );
    // One that kept less is asked of its PDS, and refreshed before use.
    let erin = index.web_session("did:plc:erin").unwrap().unwrap().session;
    let o = erin.oauth.clone().unwrap();
    assert_eq!(
        (erin.handle.as_str(), o.issuer.as_str()),
        ("", "https://pds.example")
    );
    assert_eq!(o.token_endpoint, "https://pds.example/oauth/token");
    assert_eq!((o.scope, o.expires_at), (None, 0));
    assert!(erin.expiring());
    let said = summary.to_string();
    assert!(said.contains("web_session (_oauth_sessions)"), "{said}");
}

#[test]
fn web_sessions_carry_only_with_what_names_and_proves_them() {
    let dir = tempfile::tempdir().unwrap();
    let carried = |old: &Path, url: Option<&str>| {
        let into = old.with_extension("index");
        let summary = import(old, &into, false, url).unwrap();
        assert!(summary.written, "{summary}");
        (
            summary.sessions.source,
            summary.sessions.imported,
            summary.sessions_left.clone(),
            summary,
        )
    };
    // With no public URL, none: they are left, and the summary says why.
    let (source, imported, why, summary) = carried(&full(dir.path()), None);
    assert_eq!((source, imported), (4, 0));
    assert_eq!(why.as_deref(), Some("no --public-url or GRAIN_PUBLIC_URL"));
    assert!(summary.left.contains(&("_oauth_sessions".to_string(), 4)));
    assert!(
        summary
            .to_string()
            .contains("none carried: no --public-url")
    );

    // With no key of hatk's to prove them with, none.
    let dir = tempfile::tempdir().unwrap();
    let keyless = "DELETE FROM _oauth_keys WHERE kid = 'appview-oauth-key';";
    let old = hatk(dir.path(), &format!("{}{keyless}", kept_rows()));
    let (_, imported, why, summary) = carried(&old, URL);
    assert_eq!(
        (imported, why.as_deref()),
        (0, Some("no appview-oauth-key to prove them with"))
    );
    assert!(!summary.cookie_key);
    assert!(summary.to_string().contains("cookies' key: not carried"));
    // A key that is no JWK: no cookie key either.
    let dir = tempfile::tempdir().unwrap();
    let broken = "UPDATE _oauth_keys SET private_key = '{' WHERE kid = 'appview-oauth-key';";
    let old = hatk(dir.path(), &format!("{}{broken}", kept_rows()));
    assert!(!carried(&old, URL).3.cookie_key);

    // A hatk from before it kept sessions, or their endpoints and expiry.
    let dir = tempfile::tempdir().unwrap();
    let old = hatk(
        dir.path(),
        "DROP TABLE _oauth_sessions; DROP TABLE _oauth_keys;",
    );
    let (source, _, why, _) = carried(&old, URL);
    assert_eq!((source, why.as_deref()), (0, Some("hatk kept no sessions")));
    let dir = tempfile::tempdir().unwrap();
    let key = grain_serve::login::from_jwk(CLIENT_KEY).unwrap();
    let old = hatk(
        dir.path(),
        &format!(
            "DROP TABLE _oauth_sessions;
             CREATE TABLE _oauth_sessions (did TEXT PRIMARY KEY, pds_endpoint TEXT NOT NULL,
               access_token TEXT NOT NULL, refresh_token TEXT, dpop_jkt TEXT NOT NULL);
             INSERT INTO _oauth_keys VALUES ('appview-oauth-key', '{}', '', '');
             INSERT INTO _oauth_sessions VALUES ('did:plc:a', 'https://pds.example', 'a', 'r', '{}');",
            CLIENT_KEY,
            thumbprint(&key)
        ),
    );
    let into = old.with_extension("index");
    assert_eq!(carried(&old, URL).1, 1);
    let index = Index::open(&into).unwrap();
    let a = index
        .web_session("did:plc:a")
        .unwrap()
        .unwrap()
        .session
        .oauth
        .unwrap();
    assert_eq!(
        (a.issuer.as_str(), a.expires_at),
        ("https://pds.example", 0)
    );
}

#[test]
fn every_record_is_imported_as_it_was_indexed() {
    let dir = tempfile::tempdir().unwrap();
    let old = full(dir.path());
    let into = dir.path().join("index.db");
    let summary = import(&old, &into, false, URL).unwrap();
    assert!(summary.written, "{summary}");
    let tallies: HashMap<_, _> = summary
        .records
        .iter()
        .map(|t| (t.table, (t.source, t.imported, t.invalid, t.in_space)))
        .collect();
    let expected = [
        ("gallery", (4, 1, 2, 1)),
        ("gallery_item", (2, 2, 0, 0)),
        ("photo", (3, 1, 2, 0)),
        ("photo_exif", (2, 1, 1, 0)),
        ("profile", (1, 1, 0, 0)),
        ("follow", (1, 1, 0, 0)),
        ("block", (1, 1, 0, 0)),
        ("favorite", (1, 1, 0, 0)),
        ("comment", (1, 1, 0, 0)),
        ("story", (1, 1, 0, 0)),
        ("group_item", (1, 1, 0, 0)),
        ("group_submission", (1, 1, 0, 0)),
        ("group_decline", (0, 0, 0, 0)),
        ("group_declaration", (1, 1, 0, 0)),
        ("bsky_post", (1, 1, 0, 0)),
        ("bsky_follow", (1, 1, 0, 0)),
        ("germ_declaration", (4, 3, 1, 0)),
    ];
    assert_eq!(tallies, HashMap::from(expected));
    let mut refused: Vec<_> = summary.refused.iter().map(|(u, _)| u.as_str()).collect();
    refused.sort();
    assert_eq!(
        refused,
        [
            "at://did:plc:alice/social.grain.gallery/3l3qo2vuowo2c",
            "at://did:plc:alice/social.grain.photo.exif/3l3qo2vuowo2b",
            "at://did:plc:alice/social.grain.photo/3l3qo2vuowo2b",
            "at://did:plc:alice/social.grain.photo/3l3qo2vuowo2c",
            "at://did:plc:bob/social.grain.gallery/3l3qo2vuowo2d",
            "at://did:plc:dave/com.germnetwork.declaration/self",
        ]
    );
    let why = |uri: &str| {
        let found = summary.refused.iter().find(|(u, _)| u == uri);
        found.unwrap().1.clone()
    };
    assert_eq!(
        why("at://did:plc:alice/social.grain.gallery/3l3qo2vuowo2c"),
        "no CID"
    );
    assert!(why("at://did:plc:bob/social.grain.gallery/3l3qo2vuowo2d").contains("not a URI"));
    assert!(why("at://did:plc:alice/social.grain.photo/3l3qo2vuowo2b").contains("aspectRatio"));

    let index = Index::open(&into).unwrap();
    let gallery = index
        .get::<Gallery>("at://did:plc:alice/social.grain.gallery/3l3qo2vuowo2a")
        .unwrap()
        .unwrap();
    assert_eq!(gallery.indexed_at, "2025-01-02T03:04:05.678Z");
    assert_eq!(gallery.cid, CID);
    assert_eq!(gallery.record.title, "Fog");
    let location = gallery.record.location.unwrap().0;
    assert_eq!(location["name"], "Ocean Beach");
    let facets = gallery.record.facets.unwrap().0;
    assert_eq!(facets[0]["features"][0]["tag"], "fog");
    let uri = "at://did:plc:alice/social.grain.gallery/3l3qo2vuowo2a";
    assert_eq!(index.self_labels(uri).unwrap(), ["gore", "nudity"]);
    let story = "at://did:plc:bob/social.grain.story/3l3qo2vuowo2a";
    assert_eq!(index.self_labels(story).unwrap(), ["spam"]);
    let generated = index.read(|db| {
        dump(
            db,
            "SELECT h3, sort_at FROM gallery -- scans: gallery, a test's own",
        )
    });
    assert_eq!(generated, ["8a28a98a4c67fff|2025-01-01T00:00:00.000Z"]);

    let photo = index
        .get::<Photo>("at://did:plc:alice/social.grain.photo/3l3qo2vuowo2a")
        .unwrap()
        .unwrap();
    assert_eq!(photo.indexed_at, "2025-01-04T00:00:00.000Z");
    assert_eq!(photo.record.photo.0["ref"]["$link"], BLOB);
    assert_eq!(photo.record.photo.0["size"], 9727);
    assert_eq!(
        photo.record.aspect_ratio.0,
        json!({"width": 4, "height": 3})
    );
    let exif = index
        .get::<PhotoExif>("at://did:plc:alice/social.grain.photo.exif/3l3qo2vuowo2a")
        .unwrap()
        .unwrap();
    let exif = exif.record;
    assert_eq!((exif.iso, exif.f_number), (Some(400), Some(2_800_000)));
    assert_eq!(exif.make.as_deref(), Some("RICOH"));
    let item = index.read(|db| {
        dump(
            db,
            "SELECT position FROM gallery_item ORDER BY uri -- scans: gallery_item, a test's own",
        )
    });
    assert_eq!(item, ["2", "0"]);
    let group = index.read(|db| {
        dump(
            db,
            "SELECT group_did FROM group_submission -- scans: group_submission, a test's own",
        )
    });
    assert_eq!(group, ["did:plc:group"]);
    let embed = index.read(|db| {
        dump(
            db,
            "SELECT json_extract(embed, '$.external.title') FROM bsky_post -- scans: bsky_post, a test's own",
        )
    });
    assert_eq!(embed, ["Fog"]);

    // Bytes, as hatk wrote them each way, as a record has them.
    let germ = |did: &str| {
        let uri = format!("at://{did}/com.germnetwork.declaration/self");
        index.get::<GermDeclaration>(&uri).unwrap().unwrap().record
    };
    let alice = germ("did:plc:alice");
    assert_eq!(alice.current_key.0, json!({"$bytes": "AQID"}));
    assert_eq!(
        alice.continuity_proofs.unwrap().0,
        json!([{"$bytes": "AQI"}])
    );
    assert_eq!(alice.message_me.unwrap().0["showButtonTo"], "usersIFollow");
    let bob = germ("did:plc:bob");
    assert_eq!(bob.current_key.0, json!({"$bytes": "Azc2"}));
    assert_eq!(bob.key_package.unwrap().0, json!({"$bytes": ""}));
    assert_eq!(
        bob.continuity_proofs.unwrap().0,
        json!([{"$bytes": "AQID"}])
    );
    assert_eq!(
        germ("did:plc:carol").current_key.0,
        json!({"$bytes": "AQID"})
    );

    // What is not imported, named with its rows.
    let left: HashMap<_, _> = summary.left.iter().cloned().collect();
    let expected = [
        ("app.bsky.actor.profile", 1),
        ("app.bsky.feed.post__entities", 0),
        ("social.grain.gallery__labels_self_labels", 1),
    ];
    assert_eq!(
        left,
        HashMap::from(expected.map(|(t, n)| (t.to_string(), n)))
    );
    let said = summary.to_string();
    assert!(said.contains("  gallery (social.grain.gallery)"), "{said}");
    assert!(said.contains("refused: 6 records, 6 shown"), "{said}");
    assert!(said.contains("hatk never wrote: 1, made pending"), "{said}");
    assert!(said.ends_with("written\n"), "{said}");
}

#[test]
fn strict_refuses_an_import_with_a_record_refused() {
    let dir = tempfile::tempdir().unwrap();
    let old = full(dir.path());
    let into = dir.path().join("index.db");
    let summary = import(&old, &into, true, URL).unwrap();
    assert!(!summary.written);
    let said = summary.to_string();
    assert!(said.ends_with("nothing written: a table differs, or --strict refused\n"));
    let held = |sql| {
        Connection::open(&into)
            .unwrap()
            .query_row(sql, [], |r| r.get::<_, i64>(0))
    };
    assert_eq!(
        held("SELECT count(*) FROM gallery -- scans: gallery, a test's own").unwrap(),
        0
    );
    assert_eq!(held("SELECT count(*) FROM label").unwrap(), 0);
    // What is left is empty, and taken again.
    assert!(import(&old, &into, false, URL).unwrap().written);
    assert_eq!(held("SELECT count(*) FROM label").unwrap(), 4);
}

#[test]
fn a_row_the_index_does_not_take_fails_the_import() {
    let dir = tempfile::tempdir().unwrap();
    // hatk let a preference's time be null; the index does not.
    let null = "INSERT INTO _preferences VALUES ('did:plc:erin', 'k', '1', NULL);";
    let old = hatk(dir.path(), &format!("{}{null}", kept_rows()));
    let into = dir.path().join("index.db");
    let summary = import(&old, &into, false, URL).unwrap();
    assert!(!summary.written);
    let preference = kept(&summary, "preference");
    assert_eq!((preference.source, preference.imported), (2, 1));
    assert_eq!(summary.failed.len(), 1, "{:?}", summary.failed);
    assert!(summary.failed[0].starts_with("preference Text(\"did:plc:erin\")"));
    let said = summary.to_string();
    assert!(said.contains("DIFFERS"), "{said}");
    assert!(said.contains("not kept: preference"), "{said}");
    assert!(
        said.ends_with("nothing written: a table differs\n"),
        "{said}"
    );
    let labels =
        Connection::open(&into)
            .unwrap()
            .query_row("SELECT count(*) FROM label", [], |r| r.get::<_, i64>(0));
    assert_eq!(labels.unwrap(), 0, "nothing was written");
    let args = [
        old.display().to_string(),
        "--into".into(),
        into.display().to_string(),
    ];
    assert_eq!(main(&args, |_| None), 1);
}

#[test]
fn a_seen_time_that_is_no_time_fails_the_import() {
    let dir = tempfile::tempdir().unwrap();
    let odd = "INSERT INTO _preferences VALUES
      ('did:plc:erin', 'lastSeenNotifications', '\"yesterday\"', '2025-01-01T00:00:00.000Z');";
    let old = hatk(dir.path(), &format!("{}{odd}", kept_rows()));
    let summary = import(&old, &dir.path().join("index.db"), false, URL).unwrap();
    assert!(!summary.written);
    let seen = kept(&summary, "notification_seen");
    assert_eq!((seen.source, seen.imported), (3, 2));
    assert!(
        summary.failed[0].starts_with("notification_seen Text(\"did:plc:erin\")"),
        "{:?}",
        summary.failed
    );
}

#[test]
fn hatk_with_its_repos_alone_imports() {
    let dir = tempfile::tempdir().unwrap();
    let old = dir.path().join("grain.db");
    let db = Connection::open(&old).unwrap();
    db.execute_batch(
        "CREATE TABLE _repos (did TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'pending',
           handle TEXT, backfilled_at TEXT, rev TEXT, retry_count INTEGER NOT NULL DEFAULT 0,
           retry_after INTEGER NOT NULL DEFAULT 0);
         INSERT INTO _repos (did, status) VALUES ('did:plc:alice', 'active');",
    )
    .unwrap();
    let into = dir.path().join("index.db");
    let summary = import(&old, &into, true, URL).unwrap();
    assert!(summary.written, "{summary}");
    assert!(summary.records.iter().all(|t| t.source == 0));
    assert_eq!(kept(&summary, "repo").imported, 1);
    assert_eq!(kept(&summary, "label").source, 0);
    assert!(summary.left.is_empty());
}

#[test]
fn it_imports_only_into_an_empty_index() {
    let dir = tempfile::tempdir().unwrap();
    let old = full(dir.path());
    let into = dir.path().join("index.db");
    assert!(import(&old, &into, false, URL).unwrap().written);
    let again = import(&old, &into, false, URL).unwrap_err().to_string();
    assert!(again.contains("holds"), "{again}");
    assert!(
        again.contains("import only into a new or empty index"),
        "{again}"
    );
    // Not into hatk's own, which is left as it was.
    let itself = import(&old, &old, false, URL).unwrap_err().to_string();
    assert!(
        itself.contains("is not an index: it has _cursor"),
        "{itself}"
    );
    let tables = names(&Connection::open(&old).unwrap()).unwrap();
    assert!(!tables.contains("gallery"));
    let nowhere = dir.path().join("no/such/dir/index.db");
    let why = format!("{:#}", import(&old, &nowhere, false, URL).unwrap_err());
    assert!(why.starts_with("opening "), "{why}");
}

#[test]
fn it_reads_only_hatks_database() {
    let dir = tempfile::tempdir().unwrap();
    let into = dir.path().join("index.db");
    let missing = dir.path().join("missing.db");
    let why = format!("{:#}", import(&missing, &into, false, URL).unwrap_err());
    assert!(why.starts_with("opening "), "{why}");
    let other = dir.path().join("other.db");
    Connection::open(&other)
        .unwrap()
        .execute_batch("CREATE TABLE t (x)")
        .unwrap();
    let why = import(&other, &into, false, URL).unwrap_err().to_string();
    assert!(
        why.ends_with("has no _repos: it is not hatk's database"),
        "{why}"
    );
}

#[test]
fn hatks_own_labels_are_given_out_as_the_servers_did() {
    let srcs = |public_url: Option<&str>| {
        let dir = tempfile::tempdir().unwrap();
        let (old, into) = (full(dir.path()), dir.path().join("index.db"));
        import(&old, &into, false, public_url).unwrap();
        let index = Connection::open(&into).unwrap();
        let mut stmt = index
            .prepare("SELECT src FROM label GROUP BY src ORDER BY min(id)")
            .unwrap();
        let srcs = stmt.query_map([], |r| r.get::<_, String>(0)).unwrap();
        srcs.collect::<rusqlite::Result<Vec<_>>>().unwrap()
    };
    assert_eq!(
        srcs(Some("http://127.0.0.1:2600")),
        ["did:web:grain.social", "did:web:127.0.0.1%3A2600"],
        "a labeler's own DID is kept"
    );
    assert_eq!(srcs(None), [LABELER]);
    let dir = tempfile::tempdir().unwrap();
    let old = full(dir.path());
    let why = import(&old, &dir.path().join("i.db"), false, Some("grain.social"));
    assert!(why.unwrap_err().to_string().starts_with("grain.social"));
}

#[test]
fn arguments_name_the_database_and_the_index() {
    let args = |a: &[&str]| a.iter().map(|s| s.to_string()).collect::<Vec<_>>();
    let none = |_: &str| None;
    let index = |name: &str| (name == "GRAIN_INDEX").then(|| "/data/index.db".to_string());
    let parsed = parse_args(&args(&["/old/grain.db"]), index).unwrap();
    let want = Options {
        from: "/old/grain.db".into(),
        into: "/data/index.db".into(),
        strict: false,
        public_url: None,
    };
    assert_eq!(parsed, want);
    let parsed = parse_args(
        &args(&["--strict", "/old/grain.db", "--into", "/i.db"]),
        index,
    );
    let want = Options {
        into: "/i.db".into(),
        strict: true,
        ..want
    };
    assert_eq!(parsed.unwrap(), want);
    let named = parse_args(
        &args(&["/old/grain.db", "--public-url", "https://g.test"]),
        index,
    );
    assert_eq!(named.unwrap().public_url.as_deref(), Some("https://g.test"));
    let public = |name: &str| match name {
        "GRAIN_PUBLIC_URL" => Some("https://grain.social".to_string()),
        _ => index(name),
    };
    let from_var = parse_args(&args(&["/old/grain.db"]), public).unwrap();
    assert_eq!(from_var.public_url.as_deref(), Some("https://grain.social"));
    let wrong = |a: &[&str]| parse_args(&args(a), none).unwrap_err();
    assert_eq!(
        wrong(&["/old/grain.db", "--into", "/i.db", "--public-url"]),
        "--public-url takes a URL"
    );
    assert_eq!(wrong(&[]), USAGE);
    assert_eq!(
        wrong(&["/old/grain.db"]),
        "import needs --into or GRAIN_INDEX"
    );
    assert_eq!(wrong(&["/old/grain.db", "--into"]), "--into takes a path");
    assert!(wrong(&["--force"]).starts_with("--force: no such flag\n"));
    assert!(wrong(&["/a.db", "/b.db"]).starts_with("/b.db: import reads one database\n"));
    let empty = |_: &str| Some(String::new());
    let unset = parse_args(&args(&["/old/grain.db"]), empty).unwrap_err();
    assert_eq!(unset, "import needs --into or GRAIN_INDEX");
}

#[test]
fn main_says_how_it_went_by_its_exit_code() {
    let dir = tempfile::tempdir().unwrap();
    let old = full(dir.path());
    let into = dir.path().join("index.db");
    let into_var = into.display().to_string();
    let var = |name: &str| (name == "GRAIN_INDEX").then(|| into_var.clone());
    let args = [old.display().to_string()];
    assert_eq!(main(&args, var), 0);
    assert_eq!(
        main(&args, var),
        1,
        "an index that is not empty is an error"
    );
    assert_eq!(main(&[], var), 2, "no database is the usage");
}

#[test]
fn hatks_column_is_its_field_in_snake_case() {
    assert_eq!(column("createdAt"), "created_at");
    assert_eq!(column("iSO"), "i_s_o");
    assert_eq!(
        column("focalLengthIn35mmFormat"),
        "focal_length_in35mm_format"
    );
    assert_eq!(column("group"), "group");
}

#[test]
fn a_gallery_titled_past_its_lexicon_is_imported_whole() {
    let dir = tempfile::tempdir().unwrap();
    let title = "Long ".repeat(26);
    let rows = format!(
        r#"INSERT INTO "social.grain.gallery" VALUES
  ('at://did:plc:alice/social.grain.gallery/3l3qo2vuowo2a', '{CID}', 'did:plc:alice', NULL,
   '2025-01-02T03:04:05.678Z', '{title}', NULL, NULL, NULL, NULL, NULL, NULL,
   '2025-01-01T00:00:00.000Z'),
  ('at://did:plc:alice/social.grain.gallery/3l3qo2vuowo2b', '{CID}', 'did:plc:alice', NULL,
   '2025-01-02T03:04:05.678Z', '{title}', NULL, NULL, NULL, NULL, NULL, NULL, 'yesterday');"#
    );
    let old = hatk(dir.path(), &format!("{}{rows}", kept_rows()));
    let into = dir.path().join("index.db");
    let summary = import(&old, &into, false, URL).unwrap();
    assert!(summary.written, "{summary}");
    let refused: Vec<_> = summary.refused.iter().map(|(u, _)| u.as_str()).collect();
    assert_eq!(
        refused,
        ["at://did:plc:alice/social.grain.gallery/3l3qo2vuowo2b"]
    );
    assert!(
        summary.refused[0].1.contains("createdAt"),
        "{:?}",
        summary.refused
    );
    let index = Index::open(&into).unwrap();
    let gallery = index
        .get::<Gallery>("at://did:plc:alice/social.grain.gallery/3l3qo2vuowo2a")
        .unwrap()
        .unwrap();
    assert_eq!(gallery.record.title, title);
}
