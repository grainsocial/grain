// The four search-backed endpoints: searchProfiles, searchGalleries,
// searchActorsTypeahead and mentionSearch's unscoped mode.
//
// These are the only tests in the suite that use `loadFixtures` rather than
// `db.run`, and they have to: a record is only searchable if it went in through
// `insertRecord`, which is what maintains the FTS index. A raw SQL insert
// leaves the row present but unfindable — the same as in production. The
// fixtures live in `test/fixtures/search/`.
//
// (Until @hatk/hatk alpha.82 none of this could be tested at all: the harness
// never built the FTS tables, so every query answered empty.)

import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { startTestServer } from "@hatk/hatk/test";

const ALICE = "did:plc:alice";
const BOB = "did:plc:bob";
const CAROL = "did:plc:carol"; // taken down

let server: any;

async function get(path: string) {
  const res = await server.fetch(path);
  expect(res.status).toBe(200);
  return res.json();
}

beforeAll(async () => {
  server = await startTestServer();
  await server.loadFixtures("test/fixtures/search");
});

afterEach(() => vi.unstubAllGlobals());
afterAll(async () => await server?.close());

describe("searchProfiles", () => {
  test("finds a profile by display name", async () => {
    const { items } = await get("/xrpc/social.grain.unspecced.searchProfiles?q=Anders");
    expect(items.map((i: any) => i.did)).toEqual([ALICE]);
    expect(items[0]).toMatchObject({
      handle: "alice.test",
      displayName: "Alice Anders",
      description: "landscape photographer in Portland",
    });
  });

  test("finds a profile by a word in its description", async () => {
    const { items } = await get("/xrpc/social.grain.unspecced.searchProfiles?q=trees");
    expect(items.map((i: any) => i.did)).toEqual([BOB]);
  });

  test("discriminates rather than returning everyone", async () => {
    const { items } = await get("/xrpc/social.grain.unspecced.searchProfiles?q=Anders");
    expect(items.map((i: any) => i.did)).not.toContain(BOB);
  });

  test("leaves out taken-down accounts", async () => {
    // Carol's description says "photographer", the same as Alice's.
    const { items } = await get("/xrpc/social.grain.unspecced.searchProfiles?q=photographer");
    expect(items.map((i: any) => i.did)).toContain(ALICE);
    expect(items.map((i: any) => i.did)).not.toContain(CAROL);
  });

  test("finds nothing for a word nobody wrote", async () => {
    const { items } = await get("/xrpc/social.grain.unspecced.searchProfiles?q=kayaking");
    expect(items).toEqual([]);
  });
});

describe("searchGalleries", () => {
  test("finds a gallery by title", async () => {
    const { items } = await get("/xrpc/social.grain.unspecced.searchGalleries?q=Sunsets");
    expect(items.map((i: any) => i.uri)).toEqual([`at://${ALICE}/social.grain.gallery/g1`]);
  });

  test("finds a gallery by description", async () => {
    const { items } = await get("/xrpc/social.grain.unspecced.searchGalleries?q=cascades");
    expect(items.map((i: any) => i.uri)).toEqual([`at://${BOB}/social.grain.gallery/g2`]);
  });

  test("hydrates the gallery rather than returning the raw row", async () => {
    const { items } = await get("/xrpc/social.grain.unspecced.searchGalleries?q=Sunsets");
    expect(items[0]).toMatchObject({
      title: "Portland Sunsets",
      creator: { did: ALICE, handle: "alice.test" },
    });
  });

  test("leaves out galleries from taken-down accounts", async () => {
    const { items } = await get("/xrpc/social.grain.unspecced.searchGalleries?q=Harbour");
    expect(items).toEqual([]);
  });

  test("finds nothing for a word nobody wrote", async () => {
    const { items } = await get("/xrpc/social.grain.unspecced.searchGalleries?q=kayaking");
    expect(items).toEqual([]);
  });
});

describe("searchActorsTypeahead", () => {
  /**
   * Answers the Bluesky typeahead call and passes everything else through —
   * the harness drives `server.fetch` over real HTTP, so a stub that swallowed
   * every request would break the request under test.
   */
  function stubBsky(actors: unknown[] | null, ok = true) {
    const real = globalThis.fetch;
    vi.stubGlobal("fetch", async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : input?.url;
      if (typeof url === "string" && url.includes("app.bsky.actor.searchActorsTypeahead")) {
        if (!ok) return new Response("nope", { status: 500 });
        return new Response(JSON.stringify({ actors }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return real(input, init);
    });
  }

  test("puts grain accounts ahead of Bluesky ones", async () => {
    // The point of the endpoint: someone already on grain is the better
    // suggestion, whatever Bluesky ranks first.
    stubBsky([{ did: "did:plc:stranger", handle: "stranger.bsky", displayName: "A Stranger" }]);
    const { actors } = await get("/xrpc/social.grain.unspecced.searchActorsTypeahead?q=Anders");
    expect(actors.map((a: any) => a.did)).toEqual([ALICE, "did:plc:stranger"]);
    expect(actors[0]).toMatchObject({ handle: "alice.test", displayName: "Alice Anders" });
  });

  test("lists an account once when both sides return it", async () => {
    stubBsky([{ did: ALICE, handle: "alice.bsky", displayName: "Alice from Bluesky" }]);
    const { actors } = await get("/xrpc/social.grain.unspecced.searchActorsTypeahead?q=Anders");
    expect(actors.filter((a: any) => a.did === ALICE)).toHaveLength(1);
    // The grain profile is the one kept.
    expect(actors[0].handle).toBe("alice.test");
  });

  test("still answers from grain when Bluesky returns an error status", async () => {
    stubBsky(null, false);
    const { actors } = await get("/xrpc/social.grain.unspecced.searchActorsTypeahead?q=Anders");
    expect(actors.map((a: any) => a.did)).toEqual([ALICE]);
  });

  test("still answers from grain when the call to Bluesky never lands", async () => {
    // A refused connection or a DNS failure rejects rather than returning a
    // response, which is a different branch from an error status.
    const real = globalThis.fetch;
    vi.stubGlobal("fetch", async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : input?.url;
      if (typeof url === "string" && url.includes("app.bsky.actor.searchActorsTypeahead")) {
        throw new TypeError("fetch failed");
      }
      return real(input, init);
    });
    const { actors } = await get("/xrpc/social.grain.unspecced.searchActorsTypeahead?q=Anders");
    expect(actors.map((a: any) => a.did)).toEqual([ALICE]);
  });

  test("still answers from Bluesky when grain has no match", async () => {
    stubBsky([{ did: "did:plc:stranger", handle: "stranger.bsky", displayName: "A Stranger" }]);
    const { actors } = await get("/xrpc/social.grain.unspecced.searchActorsTypeahead?q=kayaking");
    expect(actors.map((a: any) => a.did)).toEqual(["did:plc:stranger"]);
  });

  test("copes with Bluesky answering without an actors array", async () => {
    stubBsky(null);
    const { actors } = await get("/xrpc/social.grain.unspecced.searchActorsTypeahead?q=Anders");
    expect(actors.map((a: any) => a.did)).toEqual([ALICE]);
  });

  test("honours the limit across both sources", async () => {
    stubBsky([
      { did: "did:plc:s1", handle: "s1.bsky" },
      { did: "did:plc:s2", handle: "s2.bsky" },
    ]);
    const { actors } = await get(
      "/xrpc/social.grain.unspecced.searchActorsTypeahead?q=Anders&limit=2",
    );
    expect(actors).toHaveLength(2);
    expect(actors[0].did).toBe(ALICE);
  });
});

describe("mentionSearch, searching users", () => {
  test("finds a grain user by name", async () => {
    const { results } = await get(
      `/xrpc/parts.page.mention.search?service=${encodeURIComponent("at://did:plc:svc/parts.page.mention.service/self")}&search=Anders`,
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      uri: `at://${ALICE}/social.grain.actor.profile/self`,
      name: "Alice Anders",
      description: "landscape photographer in Portland",
      href: `http://127.0.0.1:3000/profile/${ALICE}`,
      subscope: { scope: ALICE, label: "Galleries" },
    });
  });

  test("finds nothing for a word nobody wrote", async () => {
    const { results } = await get(
      `/xrpc/parts.page.mention.search?service=${encodeURIComponent("at://did:plc:svc/parts.page.mention.service/self")}&search=kayaking`,
    );
    expect(results).toEqual([]);
  });
});
