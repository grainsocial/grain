import {
  isMention,
  isTag,
  type Main as Facet,
} from "$lexicon/types/app/bsky/richtext/facet.ts";
import { DatabaseSync } from "node:sqlite";
import type { BffConfig, Database, FacetIndexTable } from "../types.d.ts";

export function timedQuery<T = unknown>(
  db: Database,
  sql: string,
  params: (string | number)[] = [],
  label?: string,
): T {
  const debugMode = Deno.env.get("DEBUG") === "true";
  const start = typeof performance !== "undefined"
    ? performance.now()
    : Date.now();
  // Use .all for array results, .get for single row
  let result: unknown;
  if (label === "getRecords") {
    result = db.prepare(sql).all(...params);
  } else {
    result = db.prepare(sql).get(...params);
  }
  const end = typeof performance !== "undefined"
    ? performance.now()
    : Date.now();
  const elapsed = end - start;
  if (debugMode) {
    if (label) {
      console.log(`[timedQuery] ${label} took ${elapsed.toFixed(2)}ms`);
    } else {
      console.log(`[timedQuery] Query took ${elapsed.toFixed(2)}ms`);
    }
  }
  return result as T;
}

export function indexFacets(uri: string, facets: Facet[]): FacetIndexTable[] {
  return facets.flatMap((facet) => facet.features)
    .flatMap((feature) => {
      if (isMention(feature)) {
        return {
          uri,
          type: "mention",
          value: feature.did,
        };
      } else if (isTag(feature)) {
        return {
          uri,
          type: "tag",
          value: feature.tag.toLowerCase(),
        };
      }
      return null;
    })
    .filter((entry): entry is FacetIndexTable => entry !== null);
}

export function createDb(cfg: BffConfig) {
  const db = new DatabaseSync(cfg.databaseUrl);

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS "actor" (
      "did" TEXT PRIMARY KEY NOT NULL,
      "handle" TEXT,
      "indexedAt" TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS actor_handle_idx ON actor(handle);

    CREATE TABLE IF NOT EXISTS "record" (
      "uri" TEXT PRIMARY KEY NOT NULL,
      "cid" TEXT NOT NULL,
      "did" TEXT NOT NULL,
      "collection" TEXT NOT NULL,
      "json" TEXT NOT NULL,
      "indexedAt" TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_record_did ON record(did);
    CREATE INDEX IF NOT EXISTS idx_record_collection ON record(collection);
    CREATE INDEX IF NOT EXISTS idx_record_did_collection ON record(did, collection);

    CREATE TABLE IF NOT EXISTS record_kv (
      uri TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (uri, key)
    );

    CREATE INDEX IF NOT EXISTS idx_record_kv_uri ON record_kv(uri);
    CREATE INDEX IF NOT EXISTS idx_record_kv_key_value ON record_kv(key, value);

    CREATE TABLE IF NOT EXISTS "rate_limit" (
      "key" TEXT NOT NULL,
      "namespace" TEXT NOT NULL,
      "points" INTEGER NOT NULL,
      "resetAt" TEXT NOT NULL,
      PRIMARY KEY ("key", "namespace")
    );

    CREATE TABLE IF NOT EXISTS labels (
      src TEXT NOT NULL,
      uri TEXT NOT NULL,
      cid TEXT,
      val TEXT NOT NULL,
      neg BOOLEAN DEFAULT FALSE,
      cts DATETIME NOT NULL,
      exp DATETIME,
      PRIMARY KEY (src, uri, cid, val)
    );

    CREATE TABLE IF NOT EXISTS "facet_index" (
      "uri" TEXT NOT NULL,         -- References record.uri
      "type" TEXT NOT NULL,        -- e.g. 'mention', 'tag'
      "value" TEXT NOT NULL,       -- e.g. did for mention, tag string for hashtag
      PRIMARY KEY ("uri", "type", "value"),
      FOREIGN KEY ("uri") REFERENCES record("uri") ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS facet_index_type_value ON facet_index (type, value);
  `);

  // @TODO: Move this to the actor create table statement once there's a built
  // in solution for full sync (don't want to break existing tables)
  const exists = db.prepare(`
    SELECT 1 FROM pragma_table_info('actor') WHERE name = 'lastSeenNotifs'
  `).get();

  if (!exists) {
    db.prepare(`ALTER TABLE actor ADD COLUMN lastSeenNotifs TEXT`).run();
  }

  return db;
}
