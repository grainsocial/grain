import { assert, assertEquals } from "@std/assert";
import { Buffer } from "node:buffer";
import type { RecordTable } from "../../types.d.ts";
import { CursorManager } from "./CursorManager.ts";

Deno.test("CursorManager - generateCursor with table column", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const cursorManager = new CursorManager(tableColumns);

  const lastRow: RecordTable = {
    did: "did:plc:test",
    uri: "at://did:plc:test/app.bsky.feed.post/123",
    cid: "bafytest123",
    collection: "app.bsky.feed.post",
    json: '{"text": "hello"}',
    indexedAt: "2024-01-01T00:00:00Z",
  };

  const orderByClauses = [{ field: "indexedAt", direction: "asc" as const }];
  const cursor = cursorManager.generateCursor(lastRow, orderByClauses);

  // Should be base64 encoded "2024-01-01T00:00:00Z|bafytest123"
  const decoded = Buffer.from(cursor, "base64").toString("utf-8");
  assertEquals(decoded, "2024-01-01T00:00:00Z|bafytest123");
});

Deno.test("CursorManager - generateCursor with JSON field", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const cursorManager = new CursorManager(tableColumns);

  const lastRow: RecordTable = {
    did: "did:plc:test",
    uri: "at://did:plc:test/app.bsky.feed.post/123",
    cid: "bafytest123",
    collection: "app.bsky.feed.post",
    json: '{"createdAt": "2024-01-01T10:00:00Z", "text": "hello"}',
    indexedAt: "2024-01-01T00:00:00Z",
  };

  const orderByClauses = [{ field: "createdAt", direction: "desc" as const }];
  const cursor = cursorManager.generateCursor(lastRow, orderByClauses);

  const decoded = Buffer.from(cursor, "base64").toString("utf-8");
  assertEquals(decoded, "2024-01-01T10:00:00Z|bafytest123");
});

Deno.test("CursorManager - generateCursor with nested JSON field", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const cursorManager = new CursorManager(tableColumns);

  const lastRow: RecordTable = {
    did: "did:plc:test",
    uri: "at://did:plc:test/app.bsky.feed.post/123",
    cid: "bafytest123",
    collection: "app.bsky.feed.post",
    json: '{"reply": {"parent": {"cid": "parent123"}}, "text": "hello"}',
    indexedAt: "2024-01-01T00:00:00Z",
  };

  const orderByClauses = [{
    field: "reply.parent.cid",
    direction: "asc" as const,
  }];
  const cursor = cursorManager.generateCursor(lastRow, orderByClauses);

  const decoded = Buffer.from(cursor, "base64").toString("utf-8");
  assertEquals(decoded, "parent123|bafytest123");
});

Deno.test("CursorManager - generateCursor with multiple fields", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const cursorManager = new CursorManager(tableColumns);

  const lastRow: RecordTable = {
    did: "did:plc:test",
    uri: "at://did:plc:test/app.bsky.feed.post/123",
    cid: "bafytest123",
    collection: "app.bsky.feed.post",
    json: '{"createdAt": "2024-01-01T10:00:00Z", "text": "hello"}',
    indexedAt: "2024-01-01T00:00:00Z",
  };

  const orderByClauses = [
    { field: "createdAt", direction: "desc" as const },
    { field: "indexedAt", direction: "asc" as const },
  ];
  const cursor = cursorManager.generateCursor(lastRow, orderByClauses);

  const decoded = Buffer.from(cursor, "base64").toString("utf-8");
  assertEquals(
    decoded,
    "2024-01-01T10:00:00Z|2024-01-01T00:00:00Z|bafytest123",
  );
});

Deno.test("CursorManager - buildCursorCondition with single field", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const cursorManager = new CursorManager(tableColumns);
  const params: (string | number | boolean)[] = [];

  // Create cursor for "2024-01-01T10:00:00Z|bafytest123"
  const cursor = Buffer.from("2024-01-01T10:00:00Z|bafytest123", "utf-8")
    .toString("base64");
  const orderByClauses = [{ field: "indexedAt", direction: "asc" as const }];

  const condition = cursorManager.buildCursorCondition(
    cursor,
    orderByClauses,
    params,
  );

  assertEquals(condition, "(indexedAt > ? OR (indexedAt = ? AND cid > ?))");
  assertEquals(params, [
    "2024-01-01T10:00:00Z",
    "2024-01-01T10:00:00Z",
    "bafytest123",
  ]);
});

Deno.test("CursorManager - buildCursorCondition with DESC direction", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const cursorManager = new CursorManager(tableColumns);
  const params: (string | number | boolean)[] = [];

  const cursor = Buffer.from("2024-01-01T10:00:00Z|bafytest123", "utf-8")
    .toString("base64");
  const orderByClauses = [{ field: "indexedAt", direction: "desc" as const }];

  const condition = cursorManager.buildCursorCondition(
    cursor,
    orderByClauses,
    params,
  );

  assertEquals(condition, "(indexedAt < ? OR (indexedAt = ? AND cid < ?))");
  assertEquals(params, [
    "2024-01-01T10:00:00Z",
    "2024-01-01T10:00:00Z",
    "bafytest123",
  ]);
});

Deno.test("CursorManager - buildCursorCondition with JSON field", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const cursorManager = new CursorManager(tableColumns);
  const params: (string | number | boolean)[] = [];

  const cursor = Buffer.from("2024-01-01T10:00:00Z|bafytest123", "utf-8")
    .toString("base64");
  const orderByClauses = [{ field: "createdAt", direction: "asc" as const }];

  const condition = cursorManager.buildCursorCondition(
    cursor,
    orderByClauses,
    params,
  );

  assertEquals(
    condition,
    "(JSON_EXTRACT(json, '$.createdAt') > ? OR (JSON_EXTRACT(json, '$.createdAt') = ? AND cid > ?))",
  );
  assertEquals(params, [
    "2024-01-01T10:00:00Z",
    "2024-01-01T10:00:00Z",
    "bafytest123",
  ]);
});

Deno.test("CursorManager - buildCursorCondition with multiple fields", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const cursorManager = new CursorManager(tableColumns);
  const params: (string | number | boolean)[] = [];

  // Cursor for "2024-01-01T10:00:00Z|2024-01-01T00:00:00Z|bafytest123"
  const cursor = Buffer.from(
    "2024-01-01T10:00:00Z|2024-01-01T00:00:00Z|bafytest123",
    "utf-8",
  ).toString("base64");
  const orderByClauses = [
    { field: "createdAt", direction: "desc" as const },
    { field: "indexedAt", direction: "asc" as const },
  ];

  const condition = cursorManager.buildCursorCondition(
    cursor,
    orderByClauses,
    params,
  );

  const expectedCondition = "(JSON_EXTRACT(json, '$.createdAt') < ? OR " +
    "(JSON_EXTRACT(json, '$.createdAt') = ? AND indexedAt > ?) OR " +
    "(JSON_EXTRACT(json, '$.createdAt') = ? AND indexedAt = ? AND cid > ?))";

  assertEquals(condition, expectedCondition);
  assertEquals(params, [
    "2024-01-01T10:00:00Z", // first field comparison
    "2024-01-01T10:00:00Z",
    "2024-01-01T00:00:00Z", // second field comparison
    "2024-01-01T10:00:00Z",
    "2024-01-01T00:00:00Z",
    "bafytest123", // final equality check
  ]);
});

Deno.test("CursorManager - buildCursorCondition with invalid cursor format", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const cursorManager = new CursorManager(tableColumns);
  const params: (string | number | boolean)[] = [];

  // Invalid cursor with wrong number of parts
  const cursor = Buffer.from("only-one-part", "utf-8").toString("base64");
  const orderByClauses = [
    { field: "createdAt", direction: "desc" as const },
    { field: "indexedAt", direction: "asc" as const },
  ];

  const condition = cursorManager.buildCursorCondition(
    cursor,
    orderByClauses,
    params,
  );

  assertEquals(condition, ""); // Should return empty string on error
  assertEquals(params, []); // Should not modify params
});

Deno.test("CursorManager - buildCursorCondition with invalid base64", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const cursorManager = new CursorManager(tableColumns);
  const params: (string | number | boolean)[] = [];

  const invalidCursor = "invalid-base64!@#";
  const orderByClauses = [{ field: "indexedAt", direction: "asc" as const }];

  const condition = cursorManager.buildCursorCondition(
    invalidCursor,
    orderByClauses,
    params,
  );

  assertEquals(condition, ""); // Should return empty string on error
  assertEquals(params, []); // Should not modify params
});

Deno.test("CursorManager - round trip consistency", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const cursorManager = new CursorManager(tableColumns);

  const lastRow: RecordTable = {
    did: "did:plc:test",
    uri: "at://did:plc:test/app.bsky.feed.post/123",
    cid: "bafytest123",
    collection: "app.bsky.feed.post",
    json: '{"createdAt": "2024-01-01T10:00:00Z", "text": "hello"}',
    indexedAt: "2024-01-01T00:00:00Z",
  };

  const orderByClauses = [
    { field: "createdAt", direction: "desc" as const },
    { field: "indexedAt", direction: "asc" as const },
  ];

  // Generate cursor
  const cursor = cursorManager.generateCursor(lastRow, orderByClauses);

  // Build condition from cursor
  const params: (string | number | boolean)[] = [];
  const condition = cursorManager.buildCursorCondition(
    cursor,
    orderByClauses,
    params,
  );

  // Should produce a valid condition
  assert(condition.length > 0);
  assert(params.length > 0);

  // Decode cursor to verify format
  const decoded = Buffer.from(cursor, "base64").toString("utf-8");
  assertEquals(
    decoded,
    "2024-01-01T10:00:00Z|2024-01-01T00:00:00Z|bafytest123",
  );
});
