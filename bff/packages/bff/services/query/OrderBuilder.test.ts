import { assertEquals } from "@std/assert";
import { OrderBuilder } from "./OrderBuilder.ts";

Deno.test("OrderBuilder - empty order clauses", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const orderBuilder = new OrderBuilder(tableColumns);

  const result = orderBuilder.buildOrderClause([]);

  assertEquals(result, "");
});

Deno.test("OrderBuilder - single table column ascending", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const orderBuilder = new OrderBuilder(tableColumns);

  const orderByClauses = [{ field: "indexedAt", direction: "asc" as const }];
  const result = orderBuilder.buildOrderClause(orderByClauses);

  assertEquals(result, " ORDER BY indexedAt asc, cid asc");
});

Deno.test("OrderBuilder - single table column descending", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const orderBuilder = new OrderBuilder(tableColumns);

  const orderByClauses = [{ field: "indexedAt", direction: "desc" as const }];
  const result = orderBuilder.buildOrderClause(orderByClauses);

  assertEquals(result, " ORDER BY indexedAt desc, cid desc");
});

Deno.test("OrderBuilder - single table column default direction", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const orderBuilder = new OrderBuilder(tableColumns);

  const orderByClauses = [{ field: "indexedAt" }];
  const result = orderBuilder.buildOrderClause(orderByClauses);

  assertEquals(result, " ORDER BY indexedAt asc, cid asc");
});

Deno.test("OrderBuilder - JSON field ascending", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const orderBuilder = new OrderBuilder(tableColumns);

  const orderByClauses = [{ field: "createdAt", direction: "asc" as const }];
  const result = orderBuilder.buildOrderClause(orderByClauses);

  assertEquals(
    result,
    " ORDER BY JSON_EXTRACT(json, '$.createdAt') asc, cid asc",
  );
});

Deno.test("OrderBuilder - JSON field descending", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const orderBuilder = new OrderBuilder(tableColumns);

  const orderByClauses = [{ field: "createdAt", direction: "desc" as const }];
  const result = orderBuilder.buildOrderClause(orderByClauses);

  assertEquals(
    result,
    " ORDER BY JSON_EXTRACT(json, '$.createdAt') desc, cid desc",
  );
});

Deno.test("OrderBuilder - multiple fields mixed types", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const orderBuilder = new OrderBuilder(tableColumns);

  const orderByClauses = [
    { field: "createdAt", direction: "desc" as const },
    { field: "indexedAt", direction: "asc" as const },
  ];
  const result = orderBuilder.buildOrderClause(orderByClauses);

  assertEquals(
    result,
    " ORDER BY JSON_EXTRACT(json, '$.createdAt') desc, indexedAt asc, cid asc",
  );
});

Deno.test("OrderBuilder - multiple JSON fields", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const orderBuilder = new OrderBuilder(tableColumns);

  const orderByClauses = [
    { field: "createdAt", direction: "desc" as const },
    { field: "author", direction: "asc" as const },
    { field: "text" },
  ];
  const result = orderBuilder.buildOrderClause(orderByClauses);

  const expected = " ORDER BY JSON_EXTRACT(json, '$.createdAt') desc, " +
    "JSON_EXTRACT(json, '$.author') asc, " +
    "JSON_EXTRACT(json, '$.text') asc, " +
    "cid asc";
  assertEquals(result, expected);
});

Deno.test("OrderBuilder - multiple table columns", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const orderBuilder = new OrderBuilder(tableColumns);

  const orderByClauses = [
    { field: "did", direction: "asc" as const },
    { field: "indexedAt", direction: "desc" as const },
    { field: "uri" },
  ];
  const result = orderBuilder.buildOrderClause(orderByClauses);

  assertEquals(result, " ORDER BY did asc, indexedAt desc, uri asc, cid asc");
});

Deno.test("OrderBuilder - CID direction follows last field", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const orderBuilder = new OrderBuilder(tableColumns);

  const orderByClauses = [
    { field: "createdAt", direction: "asc" as const },
    { field: "indexedAt", direction: "desc" as const },
  ];
  const result = orderBuilder.buildOrderClause(orderByClauses);

  assertEquals(
    result,
    " ORDER BY JSON_EXTRACT(json, '$.createdAt') asc, indexedAt desc, cid desc",
  );
});

Deno.test("OrderBuilder - CID direction defaults to asc when last field has no direction", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const orderBuilder = new OrderBuilder(tableColumns);

  const orderByClauses = [
    { field: "createdAt", direction: "desc" as const },
    { field: "indexedAt" }, // No direction specified
  ];
  const result = orderBuilder.buildOrderClause(orderByClauses);

  assertEquals(
    result,
    " ORDER BY JSON_EXTRACT(json, '$.createdAt') desc, indexedAt asc, cid asc",
  );
});

Deno.test("OrderBuilder - nested JSON field", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const orderBuilder = new OrderBuilder(tableColumns);

  const orderByClauses = [{
    field: "reply.parent.cid",
    direction: "asc" as const,
  }];
  const result = orderBuilder.buildOrderClause(orderByClauses);

  assertEquals(
    result,
    " ORDER BY JSON_EXTRACT(json, '$.reply.parent.cid') asc, cid asc",
  );
});

Deno.test("OrderBuilder - field not in table columns treated as JSON", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const orderBuilder = new OrderBuilder(tableColumns);

  const orderByClauses = [{
    field: "someRandomField",
    direction: "desc" as const,
  }];
  const result = orderBuilder.buildOrderClause(orderByClauses);

  assertEquals(
    result,
    " ORDER BY JSON_EXTRACT(json, '$.someRandomField') desc, cid desc",
  );
});

Deno.test("OrderBuilder - complex multi-field scenario", () => {
  const tableColumns = ["did", "uri", "indexedAt", "cid"];
  const orderBuilder = new OrderBuilder(tableColumns);

  const orderByClauses = [
    { field: "priority", direction: "desc" as const }, // JSON field
    { field: "did", direction: "asc" as const }, // Table column
    { field: "createdAt" }, // JSON field, default direction
    { field: "indexedAt", direction: "desc" as const }, // Table column
  ];
  const result = orderBuilder.buildOrderClause(orderByClauses);

  const expected = " ORDER BY JSON_EXTRACT(json, '$.priority') desc, " +
    "did asc, " +
    "JSON_EXTRACT(json, '$.createdAt') asc, " +
    "indexedAt desc, " +
    "cid desc";
  assertEquals(result, expected);
});

Deno.test("OrderBuilder - single field with various table column combinations", () => {
  // Test different table column configurations
  const testCases = [
    {
      tableColumns: ["id", "name"],
      field: "createdAt",
      expected: " ORDER BY JSON_EXTRACT(json, '$.createdAt') asc, cid asc",
    },
    {
      tableColumns: ["did", "uri", "indexedAt", "cid", "createdAt"],
      field: "createdAt",
      expected: " ORDER BY createdAt asc, cid asc",
    },
    {
      tableColumns: [],
      field: "indexedAt",
      expected: " ORDER BY JSON_EXTRACT(json, '$.indexedAt') asc, cid asc",
    },
  ];

  testCases.forEach(({ tableColumns, field, expected }, index) => {
    const orderBuilder = new OrderBuilder(tableColumns);
    const orderByClauses = [{ field, direction: "asc" as const }];
    const result = orderBuilder.buildOrderClause(orderByClauses);
    assertEquals(result, expected, `Test case ${index + 1} failed`);
  });
});
