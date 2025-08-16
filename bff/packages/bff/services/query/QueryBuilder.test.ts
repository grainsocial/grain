import { assertEquals, assertThrows } from "@std/assert";
import type { Where, WhereCondition } from "../../types.d.ts";
import { QueryBuilder } from "./QueryBuilder.ts";

Deno.test("QueryBuilder - simple equals condition", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const indexedKeys = new Set<string>();
  const kvAliasMap = {};
  const builder = new QueryBuilder(tableColumns, indexedKeys, kvAliasMap);
  const params: (string | number | boolean)[] = [];

  const condition: WhereCondition = { field: "did", equals: "did:plc:test" };
  const result = builder.buildWhereClause(condition, params);

  assertEquals(result, "record.did = ?");
  assertEquals(params, ["did:plc:test"]);
});

Deno.test("QueryBuilder - contains condition", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const indexedKeys = new Set<string>();
  const kvAliasMap = {};
  const builder = new QueryBuilder(tableColumns, indexedKeys, kvAliasMap);
  const params: (string | number | boolean)[] = [];

  const condition: WhereCondition = { field: "did", contains: "test" };
  const result = builder.buildWhereClause(condition, params);

  assertEquals(result, "record.did LIKE ?");
  assertEquals(params, ["%test%"]);
});

Deno.test("QueryBuilder - in array condition", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const indexedKeys = new Set<string>();
  const kvAliasMap = {};
  const builder = new QueryBuilder(tableColumns, indexedKeys, kvAliasMap);
  const params: (string | number | boolean)[] = [];

  const condition: WhereCondition = {
    field: "did",
    in: ["did1", "did2", "did3"],
  };
  const result = builder.buildWhereClause(condition, params);

  assertEquals(result, "record.did IN (?, ?, ?)");
  assertEquals(params, ["did1", "did2", "did3"]);
});

Deno.test("QueryBuilder - JSON field extraction", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const indexedKeys = new Set<string>();
  const kvAliasMap = {};
  const builder = new QueryBuilder(tableColumns, indexedKeys, kvAliasMap);
  const params: (string | number | boolean)[] = [];

  const condition: WhereCondition = { field: "author", equals: "alice" };
  const result = builder.buildWhereClause(condition, params);

  assertEquals(result, "JSON_EXTRACT(json, '$.author') = ?");
  assertEquals(params, ["alice"]);
});

Deno.test("QueryBuilder - indexed key with alias", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const indexedKeys = new Set(["author"]);
  const kvAliasMap = { author: "kv0" };
  const builder = new QueryBuilder(tableColumns, indexedKeys, kvAliasMap);
  const params: (string | number | boolean)[] = [];

  const condition: WhereCondition = { field: "author", equals: "alice" };
  const result = builder.buildWhereClause(condition, params);

  assertEquals(result, "kv0.value = ?");
  assertEquals(params, ["alice"]);
});

Deno.test("QueryBuilder - AND condition", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const indexedKeys = new Set<string>();
  const kvAliasMap = {};
  const builder = new QueryBuilder(tableColumns, indexedKeys, kvAliasMap);
  const params: (string | number | boolean)[] = [];

  const condition: Where = {
    AND: [
      { field: "did", equals: "did:plc:test" },
      { field: "author", equals: "alice" },
    ],
  };
  const result = builder.buildWhereClause(condition, params);

  assertEquals(
    result,
    "(record.did = ?) AND (JSON_EXTRACT(json, '$.author') = ?)",
  );
  assertEquals(params, ["did:plc:test", "alice"]);
});

Deno.test("QueryBuilder - OR condition", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const indexedKeys = new Set<string>();
  const kvAliasMap = {};
  const builder = new QueryBuilder(tableColumns, indexedKeys, kvAliasMap);
  const params: (string | number | boolean)[] = [];

  const condition: Where = {
    OR: [
      { field: "did", equals: "did1" },
      { field: "did", equals: "did2" },
    ],
  };
  const result = builder.buildWhereClause(condition, params);

  assertEquals(result, "(record.did = ?) OR (record.did = ?)");
  assertEquals(params, ["did1", "did2"]);
});

Deno.test("QueryBuilder - NOT condition", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const indexedKeys = new Set<string>();
  const kvAliasMap = {};
  const builder = new QueryBuilder(tableColumns, indexedKeys, kvAliasMap);
  const params: (string | number | boolean)[] = [];

  const condition: Where = {
    NOT: { field: "did", equals: "did:plc:blocked" },
  };
  const result = builder.buildWhereClause(condition, params);

  assertEquals(result, "NOT (record.did = ?)");
  assertEquals(params, ["did:plc:blocked"]);
});

Deno.test("QueryBuilder - array of conditions (implicit AND)", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const indexedKeys = new Set<string>();
  const kvAliasMap = {};
  const builder = new QueryBuilder(tableColumns, indexedKeys, kvAliasMap);
  const params: (string | number | boolean)[] = [];

  const condition: Where[] = [
    { field: "did", equals: "did:plc:test" },
    { field: "author", equals: "alice" },
  ];
  const result = builder.buildWhereClause(condition, params);

  assertEquals(result, "record.did = ? AND JSON_EXTRACT(json, '$.author') = ?");
  assertEquals(params, ["did:plc:test", "alice"]);
});

Deno.test("QueryBuilder - complex nested condition", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const indexedKeys = new Set(["author"]);
  const kvAliasMap = { author: "kv0" };
  const builder = new QueryBuilder(tableColumns, indexedKeys, kvAliasMap);
  const params: (string | number | boolean)[] = [];

  const condition: Where = {
    AND: [
      { field: "did", equals: "did:plc:test" },
      {
        OR: [
          { field: "author", equals: "alice" },
          { field: "author", equals: "bob" },
        ],
      },
    ],
  };
  const result = builder.buildWhereClause(condition, params);

  assertEquals(
    result,
    "(record.did = ?) AND ((kv0.value = ?) OR (kv0.value = ?))",
  );
  assertEquals(params, ["did:plc:test", "alice", "bob"]);
});

Deno.test("QueryBuilder - missing field throws error", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const indexedKeys = new Set<string>();
  const kvAliasMap = {};
  const builder = new QueryBuilder(tableColumns, indexedKeys, kvAliasMap);
  const params: (string | number | boolean)[] = [];

  const condition = { equals: "test" } as WhereCondition; // Missing field

  assertThrows(
    () => {
      builder.buildWhereClause(condition, params);
    },
    Error,
    "Missing 'field' in condition",
  );
});

Deno.test("QueryBuilder - unsupported condition format throws error", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const indexedKeys = new Set<string>();
  const kvAliasMap = {};
  const builder = new QueryBuilder(tableColumns, indexedKeys, kvAliasMap);
  const params: (string | number | boolean)[] = [];

  const condition = { field: "test" } as WhereCondition; // No operation

  assertThrows(
    () => {
      builder.buildWhereClause(condition, params);
    },
    Error,
    "Unsupported condition format",
  );
});

Deno.test("QueryBuilder - boolean parameters", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const indexedKeys = new Set<string>();
  const kvAliasMap = {};
  const builder = new QueryBuilder(tableColumns, indexedKeys, kvAliasMap);
  const params: (string | number | boolean)[] = [];

  const condition: WhereCondition = { field: "active", equals: true };
  const result = builder.buildWhereClause(condition, params);

  assertEquals(result, "JSON_EXTRACT(json, '$.active') = ?");
  assertEquals(params, [true]);
});

Deno.test("QueryBuilder - number parameters", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const indexedKeys = new Set<string>();
  const kvAliasMap = {};
  const builder = new QueryBuilder(tableColumns, indexedKeys, kvAliasMap);
  const params: (string | number | boolean)[] = [];

  const condition: WhereCondition = { field: "count", equals: 42 };
  const result = builder.buildWhereClause(condition, params);

  assertEquals(result, "JSON_EXTRACT(json, '$.count') = ?");
  assertEquals(params, [42]);
});
