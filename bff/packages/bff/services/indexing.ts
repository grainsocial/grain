import type { Label } from "$lexicon/types/com/atproto/label/defs.ts";
import type {
  ActorTable,
  BffConfig,
  Database,
  LabelTable,
  QueryOptions,
  RecordTable,
} from "../types.d.ts";
import { hydrateBlobRefs } from "../utils.ts";
import { indexFacets, timedQuery } from "../utils/database.ts";
import { CursorManager } from "./query/CursorManager.ts";
import { JoinBuilder } from "./query/JoinBuilder.ts";
import { OrderBuilder } from "./query/OrderBuilder.ts";
import { QueryBuilder } from "./query/QueryBuilder.ts";

export class IndexService {
  constructor(
    private db: Database,
    private cfg: BffConfig,
  ) {}

  private get collectionKeyMap() {
    return this.cfg?.collectionKeyMap || {};
  }

  private get tableColumns() {
    return ["did", "uri", "indexedAt", "cid"];
  }

  getRecords<T extends Record<string, unknown>>(
    collection: string,
    options?: QueryOptions,
  ) {
    const collectionKeyMap = this.collectionKeyMap;
    const indexedKeys = collectionKeyMap[collection] || [];
    const tableColumns = this.tableColumns;
    const params: (string | number | boolean)[] = [];

    // Build joins
    const joinBuilder = new JoinBuilder();
    const { joinClauses, kvAliasMap } = joinBuilder.buildJoins(
      indexedKeys,
      params,
      options?.facet,
    );

    // Build base query
    let query =
      `SELECT record.* FROM record${joinClauses} WHERE record.collection = ?`;
    params.push(collection);

    // Add facet filter
    if (options?.facet) {
      query += ` AND facet_index.type = ? AND facet_index.value = ?`;
      params.push(options.facet.type, options.facet.value);
    }

    // Handle indexed key-value pairs
    const normalizedWhere = Array.isArray(options?.where)
      ? { AND: options.where }
      : options?.where;
    const extraKvClauses: string[] = [];
    if (normalizedWhere && typeof normalizedWhere === "object") {
      for (const key of indexedKeys) {
        let value: string | undefined;
        if (
          "field" in normalizedWhere && normalizedWhere.field === key &&
          normalizedWhere.equals !== undefined
        ) {
          value = String(normalizedWhere.equals);
        }
        if (value !== undefined) {
          extraKvClauses.push(`${kvAliasMap[key]}.value = ?`);
          params.push(value);
        }
      }
    }
    if (extraKvClauses.length > 0) {
      query += ` AND ` + extraKvClauses.join(" AND ");
    }

    // Add WHERE clause for non-indexed keys
    if (normalizedWhere) {
      try {
        const queryBuilder = new QueryBuilder(
          tableColumns,
          new Set(indexedKeys),
          kvAliasMap,
        );
        const whereClause = queryBuilder.buildWhereClause(
          normalizedWhere,
          params,
        );
        if (whereClause) query += ` AND (${whereClause})`;
      } catch (err) {
        console.warn("Invalid where clause", err);
      }
    }

    // Add cursor pagination
    if (options?.cursor) {
      const orderByClauses = options?.orderBy ||
        [{ field: "indexedAt", direction: "asc" }];
      const cursorManager = new CursorManager(tableColumns);
      const cursorCondition = cursorManager.buildCursorCondition(
        options.cursor,
        orderByClauses,
        params,
      );
      if (cursorCondition) {
        query += ` AND ${cursorCondition}`;
      }
    }

    // Add ORDER BY
    const orderByClauses = options?.orderBy ||
      [{ field: "indexedAt", direction: "asc" }];
    const orderBuilder = new OrderBuilder(tableColumns);
    query += orderBuilder.buildOrderClause(orderByClauses);

    // Add LIMIT
    if (options?.limit && options.limit > 0) {
      query += ` LIMIT ?`;
      params.push(options.limit.toString());
    }

    // Execute query
    const sqlParams = params.map((p) =>
      typeof p === "boolean" ? (p ? 1 : 0) : p
    );
    const rows = timedQuery<RecordTable[]>(
      this.db,
      query,
      sqlParams,
      "getRecords",
    );

    // Generate next cursor
    let nextCursor: string | undefined;
    if (rows.length > 0) {
      const lastRow = rows[rows.length - 1];
      const cursorManager = new CursorManager(tableColumns);
      nextCursor = cursorManager.generateCursor(lastRow, orderByClauses);
    }

    return {
      items: rows.map(
        (r) => ({
          uri: r.uri,
          cid: r.cid,
          did: r.did,
          indexedAt: r.indexedAt,
          ...hydrateBlobRefs(JSON.parse(r.json)),
        } as T),
      ),
      cursor: nextCursor,
    };
  }

  getRecord<T extends Record<string, unknown>>(
    uri: string,
  ): T | undefined {
    const result = this.db.prepare(`SELECT * FROM "record" WHERE uri = ?`).get(
      uri,
    ) as RecordTable | undefined;
    if (!result) return;
    return {
      uri: result.uri,
      cid: result.cid,
      did: result.did,
      indexedAt: result.indexedAt,
      ...hydrateBlobRefs(JSON.parse(result.json)),
    } as T;
  }

  insertRecord(record: RecordTable) {
    this.db.prepare(
      `INSERT INTO "record" (uri, cid, did, collection, json, "indexedAt") VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (uri) DO UPDATE SET cid = excluded.cid, collection = excluded.collection, json = excluded.json, "indexedAt" = excluded."indexedAt"`,
    ).run(
      record.uri,
      record.cid,
      record.did,
      record.collection,
      record.json,
      record.indexedAt,
    );

    const json = JSON.parse(record.json);

    // Sync record_kv
    const collectionKeyMap = this.cfg?.collectionKeyMap || {};
    const indexedKeys = collectionKeyMap[record.collection] || [];
    for (const key of indexedKeys) {
      const value = json[key];
      if (value !== undefined) {
        this.db.prepare(
          `INSERT INTO record_kv (uri, key, value) VALUES (?, ?, ?) ON CONFLICT(uri, key) DO UPDATE SET value = excluded.value`,
        ).run(record.uri, key, String(value));
      }
    }
    // Facet indexing
    if (Array.isArray(json.facets)) {
      // Remove old facets for this uri
      this.db.prepare(`DELETE FROM facet_index WHERE uri = ?`).run(record.uri);
      const facetEntries = indexFacets(record.uri, json.facets);
      for (const entry of facetEntries) {
        this.db.prepare(
          `INSERT INTO facet_index (uri, type, value) VALUES (?, ?, ?)`,
        ).run(
          entry.uri,
          entry.type,
          entry.value,
        );
      }
    }
  }
  updateRecord(record: RecordTable) {
    this.db.prepare(
      `UPDATE "record" SET cid = ?, collection = ?, json = ?, "indexedAt" = ? WHERE uri = ?`,
    ).run(
      record.cid,
      record.collection,
      record.json,
      record.indexedAt,
      record.uri,
    );

    const json = JSON.parse(record.json);

    // Sync record_kv
    const collectionKeyMap = this.cfg?.collectionKeyMap || {};
    const indexedKeys = collectionKeyMap[record.collection] || [];
    // Remove keys not present anymore
    const existingKvs = this.db.prepare(
      `SELECT key FROM record_kv WHERE uri = ?`,
    )
      .all(record.uri) as { key: string }[];
    for (const { key } of existingKvs) {
      if (!indexedKeys.includes(key) || json[key] === undefined) {
        this.db.prepare(`DELETE FROM record_kv WHERE uri = ? AND key = ?`).run(
          record.uri,
          key,
        );
      }
    }
    // Upsert current keys
    for (const key of indexedKeys) {
      const value = json[key];
      if (value !== undefined) {
        this.db.prepare(
          `INSERT INTO record_kv (uri, key, value) VALUES (?, ?, ?) ON CONFLICT(uri, key) DO UPDATE SET value = excluded.value`,
        ).run(record.uri, key, String(value));
      }
    }
    // Facet indexing
    if (Array.isArray(json.facets)) {
      // Remove old facets for this uri
      this.db.prepare(`DELETE FROM facet_index WHERE uri = ?`).run(record.uri);
      const facetEntries = indexFacets(record.uri, json.facets);
      for (const entry of facetEntries) {
        this.db.prepare(
          `INSERT INTO facet_index (uri, type, value) VALUES (?, ?, ?)`,
        ).run(
          entry.uri,
          entry.type,
          entry.value,
        );
      }
    }
  }
  deleteRecord(uri: string) {
    this.db.prepare(`DELETE FROM "record" WHERE uri = ?`).run(uri);
    this.db.prepare(`DELETE FROM record_kv WHERE uri = ?`).run(uri);
  }
  insertActor(actor: ActorTable) {
    this.db.prepare(
      `INSERT INTO "actor" (did, handle, "indexedAt") VALUES (?, ?, ?) ON CONFLICT (did) DO UPDATE SET handle = ?, "indexedAt" = ?`,
    ).run(
      actor.did,
      actor.handle,
      actor.indexedAt,
      actor.handle,
      actor.indexedAt,
    );
  }
  getActor(did: string): ActorTable | undefined {
    const result = this.db.prepare(`SELECT * FROM "actor" WHERE did = ?`).get(
      did,
    );
    return result as ActorTable | undefined;
  }
  getActorByHandle(handle: string): ActorTable | undefined {
    const result = this.db.prepare(`SELECT * FROM "actor" WHERE handle = ?`)
      .get(
        handle,
      );
    return result as ActorTable | undefined;
  }
  searchActors(
    query: string,
  ): ActorTable[] {
    const sql = `SELECT * FROM "actor" WHERE handle LIKE ?`;
    const params: string[] = [`%${query}%`];

    const rows = this.db.prepare(sql).all(...params) as ActorTable[];
    return rows;
  }
  getMentioningUris(did: string): string[] {
    const pattern = `%${did}%`;
    const result = this.db
      .prepare(`
        SELECT uri
        FROM record
        WHERE json LIKE ? AND did != ?
        ORDER BY COALESCE(
          json_extract(json, '$.updatedAt'),
          json_extract(json, '$.createdAt')
        ) DESC
      `)
      .all(pattern, did) as { uri: string }[];
    return result.map((r) => r.uri);
  }
  updateActor(did: string, lastSeenNotifs: string) {
    this.db.prepare(
      `UPDATE actor SET lastSeenNotifs = ? WHERE did = ?`,
    ).run(lastSeenNotifs, did);
  }
  insertLabel(label: LabelTable) {
    this.db.prepare(
      `INSERT INTO labels (src, uri, cid, val, neg, cts, exp)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(src, uri, cid, val) DO UPDATE SET
         neg = excluded.neg,
         cts = excluded.cts,
         exp = excluded.exp
       WHERE excluded.cts > labels.cts`,
    ).run(
      label.src,
      label.uri,
      label.cid ?? "",
      label.val,
      label.neg ? 1 : 0,
      label.cts,
      label.exp ?? null,
    );
  }
  queryLabels(
    options: {
      subjects: string[];
      issuers?: string[];
    },
  ) {
    const { subjects, issuers } = options;
    if (!subjects || subjects.length === 0) {
      return [];
    }

    const subjectConds = subjects.map(() => "l1.uri = ?").join(" OR ");
    const issuerConds = issuers && issuers.length > 0
      ? "AND (" + issuers.map(() => "l1.src = ?").join(" OR ") + ")"
      : "";

    const sql = `
      SELECT *
      FROM labels l1
      WHERE (${subjectConds})
        ${issuerConds}
        AND (l1.exp IS NULL OR l1.exp > CURRENT_TIMESTAMP)
        AND l1.cts = (
      SELECT MAX(l2.cts)
      FROM labels l2
      WHERE l2.src = l1.src AND l2.uri = l1.uri AND l2.val = l1.val
        )
        AND l1.neg = 0
    `.replace(/\s+/g, " ").trim();
    const params = [...subjects, ...(issuers ?? [])];
    const rawRows = this.db.prepare(sql).all(...params) as Record<
      string,
      unknown
    >[];

    // Map rawRows to Label[]
    const labels: Label[] = rawRows.map((row) => ({
      src: String(row.src),
      uri: String(row.uri),
      cid: typeof row.cid === "string"
        ? row.cid
        : row.cid === null
        ? undefined
        : String(row.cid),
      val: String(row.val),
      neg: Boolean(row.neg),
      cts: String(row.cts),
      exp: row.exp === null || row.exp === undefined
        ? undefined
        : String(row.exp),
    }));

    return labels;
  }
  clearLabels() {
    this.db.prepare(`DELETE FROM labels`).run();
  }
  countRecords(
    collection: string,
    options?: QueryOptions,
  ) {
    const collectionKeyMap = this.cfg?.collectionKeyMap || {};
    const indexedKeys = collectionKeyMap[collection] || [];
    const tableColumns = ["did", "uri", "indexedAt", "cid"];
    const params: (string | number | boolean)[] = [];

    // Build joins
    const joinBuilder = new JoinBuilder();
    const { joinClauses, kvAliasMap } = joinBuilder.buildJoins(
      indexedKeys,
      params,
    );

    // Build base query
    let query =
      `SELECT COUNT(*) as count FROM record${joinClauses} WHERE record.collection = ?`;
    params.push(collection);

    // Handle indexed key-value pairs
    const normalizedWhere = Array.isArray(options?.where)
      ? { AND: options.where }
      : options?.where;
    const extraKvClauses: string[] = [];
    if (normalizedWhere && typeof normalizedWhere === "object") {
      for (const key of indexedKeys) {
        let value: string | undefined;
        if (
          "field" in normalizedWhere && normalizedWhere.field === key &&
          normalizedWhere.equals !== undefined
        ) {
          value = String(normalizedWhere.equals);
        }
        if (value !== undefined) {
          extraKvClauses.push(`${kvAliasMap[key]}.value = ?`);
          params.push(value);
        }
      }
    }
    if (extraKvClauses.length > 0) {
      query += ` AND ` + extraKvClauses.join(" AND ");
    }

    // Add WHERE clause for non-indexed keys
    if (normalizedWhere) {
      try {
        const queryBuilder = new QueryBuilder(
          tableColumns,
          new Set(indexedKeys),
          kvAliasMap,
        );
        const whereClause = queryBuilder.buildWhereClause(
          normalizedWhere,
          params,
        );
        if (whereClause) query += ` AND (${whereClause})`;
      } catch (err) {
        console.warn("Invalid where clause", err);
      }
    }

    // Execute query
    const sqlParams = params.map((p) =>
      typeof p === "boolean" ? (p ? 1 : 0) : p
    );
    const row = timedQuery<{ count: number }>(
      this.db,
      query,
      sqlParams,
      "countRecords",
    );
    return row?.count ?? 0;
  }
}

export const createIndexService = (
  db: Database,
  cfg: BffConfig,
) => {
  return new IndexService(db, cfg);
};
