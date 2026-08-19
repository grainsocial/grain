import { afterEach, describe, expect, test, vi } from "vitest";
import { getSpaceSupport, probeSpaceSupport } from "../server/helpers/spaceSupport.ts";

const PDS = "https://pds.example.com";

/**
 * The method list a pds.js deployment with PDS_ENABLE_SPACES answers with,
 * trimmed to the space methods. Captured from pds.chad-53c.workers.dev.
 */
const SPACE_METHODS = [
  "com.atproto.simplespace.addMember",
  "com.atproto.simplespace.createSpace",
  "com.atproto.simplespace.deleteSpace",
  "com.atproto.simplespace.getSpace",
  "com.atproto.simplespace.listMembers",
  "com.atproto.simplespace.removeMember",
  "com.atproto.simplespace.updateSpace",
  "com.atproto.space.applyWrites",
  "com.atproto.space.createRecord",
  "com.atproto.space.deleteRecord",
  "com.atproto.space.getBlob",
  "com.atproto.space.getDelegationToken",
  "com.atproto.space.getLatestCommit",
  "com.atproto.space.getRecord",
  "com.atproto.space.getRepo",
  "com.atproto.space.getSpaceCredential",
  "com.atproto.space.listRecords",
  "com.atproto.space.listRepos",
  "com.atproto.space.putRecord",
  "com.atproto.space.registerNotify",
];

/** Stand in for a describe response listing `methods`. */
function describeResponse(methods: string[]) {
  return new Response(
    JSON.stringify({
      roles: ["pds"],
      methods: methods.map((value) => ({
        $type: "community.lexicon.service.describe#nsid",
        value,
      })),
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function stubFetch(response: Response | Error) {
  const fn = vi.fn(async (url: string | URL | Request) => {
    expect(String(url)).toBe(`${PDS}/xrpc/community.lexicon.service.describe`);
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("probeSpaceSupport", () => {
  test("a spaces-enabled PDS is supported", async () => {
    stubFetch(describeResponse(SPACE_METHODS));

    const result = await probeSpaceSupport(PDS);

    expect(result.supported).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.pds).toBe(PDS);
  });

  test("accepts either spelling of getSpace", async () => {
    // The proposal renamed things after implementations shipped, so a server
    // may answer to com.atproto.space.getSpace instead.
    const renamed = SPACE_METHODS.filter((m) => m !== "com.atproto.simplespace.getSpace").concat(
      "com.atproto.space.getSpace",
    );
    stubFetch(describeResponse(renamed));

    expect((await probeSpaceSupport(PDS)).supported).toBe(true);
  });

  test("names the methods a partial implementation is missing", async () => {
    stubFetch(
      describeResponse(
        SPACE_METHODS.filter(
          (m) => m !== "com.atproto.space.getBlob" && m !== "com.atproto.space.getSpaceCredential",
        ),
      ),
    );

    const result = await probeSpaceSupport(PDS);

    expect(result.supported).toBe(false);
    expect(result.missing).toEqual([
      "com.atproto.space.getSpaceCredential",
      "com.atproto.space.getBlob",
    ]);
  });

  test("a PDS with no space methods is unsupported", async () => {
    stubFetch(describeResponse(["com.atproto.repo.createRecord", "com.atproto.sync.getBlob"]));

    const result = await probeSpaceSupport(PDS);

    expect(result.supported).toBe(false);
    expect(result.missing).toHaveLength(10);
  });

  test("no describe endpoint reads as unsupported, not as an error", async () => {
    // What every PDS that predates the proposal does, bsky.social included.
    stubFetch(new Response("not found", { status: 404 }));

    const result = await probeSpaceSupport(PDS);

    expect(result.supported).toBe(false);
    expect(result.missing).toContain("com.atproto.simplespace.createSpace");
  });

  test("an unreachable PDS reads as unsupported", async () => {
    stubFetch(new TypeError("fetch failed"));

    await expect(probeSpaceSupport(PDS)).resolves.toMatchObject({ supported: false });
  });

  test("a describe answer that isn't one reads as unsupported", async () => {
    stubFetch(new Response("<html>hello</html>", { status: 200 }));

    await expect(probeSpaceSupport(PDS)).resolves.toMatchObject({ supported: false });
  });
});

/** The one row of _space_support this helper reads and writes, in memory. */
function fakeDb(row?: { supported: number; missing: string; checked_at: string }) {
  let stored = row;
  return {
    query: async () => (stored ? [{ ...stored }] : []),
    run: async (_sql: string, params?: unknown[]) => {
      const [, supported, missing, checkedAt] = params as [string, number, string, string];
      stored = { supported, missing, checked_at: checkedAt };
    },
    get stored() {
      return stored;
    },
  };
}

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const YES = { supported: 1, missing: "[]", checked_at: ago(0) };
const NO = { supported: 0, missing: '["com.atproto.simplespace.createSpace"]', checked_at: ago(0) };

describe("getSpaceSupport caching", () => {
  test("a fresh answer is served from cache without probing", async () => {
    const fetchFn = stubFetch(describeResponse(SPACE_METHODS));
    const db = fakeDb({ ...YES, checked_at: ago(60 * 1000) });

    await expect(getSpaceSupport(db, PDS)).resolves.toMatchObject({ supported: true });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test("force probes again even when the cached answer is fresh", async () => {
    const fetchFn = stubFetch(describeResponse(SPACE_METHODS));
    const db = fakeDb({ ...NO, checked_at: ago(1000) });

    // The recourse for a viewer whose server has just gained spaces: the thing
    // that would change the answer has already happened, and without this they
    // wait out a cache for it.
    await expect(getSpaceSupport(db, PDS, { force: true })).resolves.toMatchObject({
      supported: true,
    });
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  test("a no is re-probed long before a yes would be", async () => {
    // Ten minutes: past the window a no is held for, nowhere near a yes's.
    const fetchFn = stubFetch(describeResponse(SPACE_METHODS));
    const db = fakeDb({ ...NO, checked_at: ago(10 * 60 * 1000) });

    await expect(getSpaceSupport(db, PDS)).resolves.toMatchObject({ supported: true });
    expect(fetchFn).toHaveBeenCalledOnce();

    // And the fresh yes is what gets written back.
    expect(db.stored?.supported).toBe(1);
  });

  test("a yes that old is still trusted", async () => {
    const fetchFn = stubFetch(describeResponse(SPACE_METHODS));
    const db = fakeDb({ ...YES, checked_at: ago(10 * 60 * 1000) });

    await expect(getSpaceSupport(db, PDS)).resolves.toMatchObject({ supported: true });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test("a probe that could not reach the server does not outlive the minute it failed in", async () => {
    // The case that stranded a real account: a restart mid-probe, cached as
    // though the server had answered and said no.
    const fetchFn = stubFetch(describeResponse(SPACE_METHODS));
    const db = fakeDb({ supported: 0, missing: "[]", checked_at: ago(6 * 60 * 1000) });

    await expect(getSpaceSupport(db, PDS)).resolves.toMatchObject({ supported: true });
    expect(fetchFn).toHaveBeenCalledOnce();
  });
});
