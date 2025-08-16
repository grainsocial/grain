import { assertEquals } from "@std/assert";
import { JoinBuilder } from "./JoinBuilder.ts";

Deno.test("JoinBuilder - no indexed keys, no facet query", () => {
  const joinBuilder = new JoinBuilder();
  const params: (string | number | boolean)[] = [];
  const indexedKeys: string[] = [];

  const result = joinBuilder.buildJoins(indexedKeys, params);

  assertEquals(result.joinClauses, "");
  assertEquals(result.kvAliasMap, {});
  assertEquals(params, []);
});

Deno.test("JoinBuilder - single indexed key", () => {
  const joinBuilder = new JoinBuilder();
  const params: (string | number | boolean)[] = [];
  const indexedKeys = ["author"];

  const result = joinBuilder.buildJoins(indexedKeys, params);

  assertEquals(
    result.joinClauses,
    " LEFT JOIN record_kv AS kv0 ON kv0.uri = record.uri AND kv0.key = ?",
  );
  assertEquals(result.kvAliasMap, { author: "kv0" });
  assertEquals(params, ["author"]);
});

Deno.test("JoinBuilder - multiple indexed keys", () => {
  const joinBuilder = new JoinBuilder();
  const params: (string | number | boolean)[] = [];
  const indexedKeys = ["author", "language", "createdAt"];

  const result = joinBuilder.buildJoins(indexedKeys, params);

  const expectedJoinClauses =
    " LEFT JOIN record_kv AS kv0 ON kv0.uri = record.uri AND kv0.key = ?" +
    " LEFT JOIN record_kv AS kv1 ON kv1.uri = record.uri AND kv1.key = ?" +
    " LEFT JOIN record_kv AS kv2 ON kv2.uri = record.uri AND kv2.key = ?";

  assertEquals(result.joinClauses, expectedJoinClauses);
  assertEquals(result.kvAliasMap, {
    author: "kv0",
    language: "kv1",
    createdAt: "kv2",
  });
  assertEquals(params, ["author", "language", "createdAt"]);
});

Deno.test("JoinBuilder - facet query only", () => {
  const joinBuilder = new JoinBuilder();
  const params: (string | number | boolean)[] = [];
  const indexedKeys: string[] = [];
  const facetQuery = { type: "mention", value: "did:plc:test" };

  const result = joinBuilder.buildJoins(indexedKeys, params, facetQuery);

  assertEquals(
    result.joinClauses,
    " JOIN facet_index ON record.uri = facet_index.uri",
  );
  assertEquals(result.kvAliasMap, {});
  assertEquals(params, []);
});

Deno.test("JoinBuilder - indexed keys with facet query", () => {
  const joinBuilder = new JoinBuilder();
  const params: (string | number | boolean)[] = [];
  const indexedKeys = ["author", "language"];
  const facetQuery = { type: "mention", value: "did:plc:test" };

  const result = joinBuilder.buildJoins(indexedKeys, params, facetQuery);

  const expectedJoinClauses =
    " LEFT JOIN record_kv AS kv0 ON kv0.uri = record.uri AND kv0.key = ?" +
    " LEFT JOIN record_kv AS kv1 ON kv1.uri = record.uri AND kv1.key = ?" +
    " JOIN facet_index ON record.uri = facet_index.uri";

  assertEquals(result.joinClauses, expectedJoinClauses);
  assertEquals(result.kvAliasMap, {
    author: "kv0",
    language: "kv1",
  });
  assertEquals(params, ["author", "language"]);
});

Deno.test("JoinBuilder - alias mapping correctness", () => {
  const joinBuilder = new JoinBuilder();
  const params: (string | number | boolean)[] = [];
  const indexedKeys = ["field1", "field2", "field3", "field4", "field5"];

  const result = joinBuilder.buildJoins(indexedKeys, params);

  // Verify alias mapping is consistent and sequential
  assertEquals(result.kvAliasMap.field1, "kv0");
  assertEquals(result.kvAliasMap.field2, "kv1");
  assertEquals(result.kvAliasMap.field3, "kv2");
  assertEquals(result.kvAliasMap.field4, "kv3");
  assertEquals(result.kvAliasMap.field5, "kv4");

  // Verify join clauses use correct aliases
  const expectedJoinClauses =
    " LEFT JOIN record_kv AS kv0 ON kv0.uri = record.uri AND kv0.key = ?" +
    " LEFT JOIN record_kv AS kv1 ON kv1.uri = record.uri AND kv1.key = ?" +
    " LEFT JOIN record_kv AS kv2 ON kv2.uri = record.uri AND kv2.key = ?" +
    " LEFT JOIN record_kv AS kv3 ON kv3.uri = record.uri AND kv3.key = ?" +
    " LEFT JOIN record_kv AS kv4 ON kv4.uri = record.uri AND kv4.key = ?";

  assertEquals(result.joinClauses, expectedJoinClauses);
  assertEquals(params, ["field1", "field2", "field3", "field4", "field5"]);
});

Deno.test("JoinBuilder - empty indexed keys with facet", () => {
  const joinBuilder = new JoinBuilder();
  const params: (string | number | boolean)[] = [];
  const indexedKeys: string[] = [];
  const facetQuery = { type: "hashtag", value: "test" };

  const result = joinBuilder.buildJoins(indexedKeys, params, facetQuery);

  assertEquals(
    result.joinClauses,
    " JOIN facet_index ON record.uri = facet_index.uri",
  );
  assertEquals(result.kvAliasMap, {});
  assertEquals(params, []);
});

Deno.test("JoinBuilder - params not modified when no indexed keys", () => {
  const joinBuilder = new JoinBuilder();
  const params = ["existing", "params"];
  const indexedKeys: string[] = [];

  const result = joinBuilder.buildJoins(indexedKeys, params);

  assertEquals(result.joinClauses, "");
  assertEquals(result.kvAliasMap, {});
  assertEquals(params, ["existing", "params"]); // Should be unchanged
});

Deno.test("JoinBuilder - params appended correctly", () => {
  const joinBuilder = new JoinBuilder();
  const params = ["existing"];
  const indexedKeys = ["author", "language"];

  const result = joinBuilder.buildJoins(indexedKeys, params);

  assertEquals(params, ["existing", "author", "language"]);
  assertEquals(result.kvAliasMap, { author: "kv0", language: "kv1" });
});
