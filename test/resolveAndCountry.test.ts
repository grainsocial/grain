// Two helpers that answer questions the index alone cannot.
//
// `resolveActor` turns a handle into a DID, asking the index first and the
// viewer's own PDS second — the second step is the point of it, since an
// account on a PDS that serves permissioned spaces is exactly the kind grain
// may never have indexed.
//
// `country.ts` normalises whatever a third-party client put in
// `address.country`, so that clicking "Greece" in the sidebar finds records
// stored as "GR".

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startTestServer } from "@hatk/hatk/test";
import { resolveActor } from "../server/helpers/resolveActor.ts";
import { expandCountryAliases, normalizeCountry } from "../server/helpers/country.ts";

const ALICE = "did:plc:alice";
const REMOTE = "did:plc:remote";

let server: any;

/** Stands in for the viewer's PDS. Records what it was asked. */
function pdsThatKnows(handles: Record<string, string>) {
  const calls: Array<{ nsid: string; params?: Record<string, string> }> = [];
  const pds = async (nsid: string, options?: any) => {
    calls.push({ nsid, params: options?.params });
    const did = handles[options?.params?.handle];
    if (!did) throw new Error("Unable to resolve handle");
    return { did };
  };
  return { pds, calls };
}

beforeAll(async () => {
  server = await startTestServer();
  await server.db.run(`INSERT INTO _repos (did, status, handle) VALUES ($1, 'active', $2)`, [
    ALICE,
    "alice.test",
  ]);
});

afterAll(async () => await server?.close());

describe("resolveActor", () => {
  test("passes a did straight through without asking anyone", async () => {
    const { pds, calls } = pdsThatKnows({});
    expect(await resolveActor(server.db, pds, ALICE)).toBe(ALICE);
    expect(calls).toEqual([]);
  });

  test("answers from the index when grain already knows the handle", async () => {
    const { pds, calls } = pdsThatKnows({ "alice.test": "did:plc:wrong" });
    expect(await resolveActor(server.db, pds, "alice.test")).toBe(ALICE);
    // The index answered, so the PDS was never troubled.
    expect(calls).toEqual([]);
  });

  test("asks the viewer's PDS for a handle grain has never seen", async () => {
    // The case the helper exists for: an account on a permissioned-spaces PDS
    // that has never reached grain's index.
    const { pds, calls } = pdsThatKnows({ "remote.test": REMOTE });
    expect(await resolveActor(server.db, pds, "remote.test")).toBe(REMOTE);
    expect(calls).toEqual([
      { nsid: "com.atproto.identity.resolveHandle", params: { handle: "remote.test" } },
    ]);
  });

  test("strips a leading @ and surrounding whitespace", async () => {
    const { pds } = pdsThatKnows({ "remote.test": REMOTE });
    expect(await resolveActor(server.db, pds, "  @alice.test  ")).toBe(ALICE);
    expect(await resolveActor(server.db, pds, "@remote.test")).toBe(REMOTE);
  });

  test("gives up quietly when the PDS cannot resolve it either", async () => {
    const { pds } = pdsThatKnows({});
    expect(await resolveActor(server.db, pds, "nobody.test")).toBeNull();
  });

  test("gives up when the PDS answers without a did", async () => {
    const pds = async () => ({ notADid: true });
    expect(await resolveActor(server.db, pds as any, "nobody.test")).toBeNull();
  });

  test("returns null for an empty actor", async () => {
    const { pds, calls } = pdsThatKnows({});
    expect(await resolveActor(server.db, pds, "")).toBeNull();
    expect(await resolveActor(server.db, pds, "   ")).toBeNull();
    expect(await resolveActor(server.db, pds, "@")).toBeNull();
    expect(calls).toEqual([]);
  });
});

describe("normalizeCountry", () => {
  test("maps an English name to its ISO-2 code", () => {
    expect(normalizeCountry("Greece")).toBe("GR");
    expect(normalizeCountry("United States")).toBe("US");
  });

  test("maps a known spelling variant", () => {
    // "USA" is the one non-canonical value actually observed in the index.
    expect(normalizeCountry("USA")).toBe("US");
  });

  test("ignores case and surrounding whitespace", () => {
    expect(normalizeCountry("  greece  ")).toBe("GR");
    expect(normalizeCountry("uSa")).toBe("US");
  });

  test("passes an unrecognised string through upper-cased", () => {
    // Third-party clients can write anything; an unknown value is kept rather
    // than dropped, so it can still match other records holding the same text.
    expect(normalizeCountry("Waldport")).toBe("WALDPORT");
  });

  test("returns null only for nothing at all", () => {
    expect(normalizeCountry("")).toBeNull();
    expect(normalizeCountry("   ")).toBeNull();
    expect(normalizeCountry(null)).toBeNull();
    expect(normalizeCountry(undefined)).toBeNull();
  });
});

describe("expandCountryAliases", () => {
  test("offers the code, its aliases and the English name together", () => {
    // A sidebar click says "Greece"; the records say "GR".
    expect(new Set(expandCountryAliases("Greece"))).toEqual(new Set(["GR", "GREECE"]));
  });

  test("includes a known variant alongside the canonical code", () => {
    expect(new Set(expandCountryAliases("US"))).toEqual(new Set(["US", "USA", "UNITED STATES"]));
    // Reached from either spelling.
    expect(new Set(expandCountryAliases("USA"))).toEqual(new Set(expandCountryAliases("US")));
  });

  test("offers an unrecognised string as itself", () => {
    expect(expandCountryAliases("Waldport")).toEqual(["WALDPORT"]);
  });

  test("offers nothing for an empty string", () => {
    // The caller drops an interpretation that expands to nothing rather than
    // emitting `IN ()`, which SQLite will not parse.
    expect(expandCountryAliases("")).toEqual([]);
    expect(expandCountryAliases("   ")).toEqual([]);
  });
});
