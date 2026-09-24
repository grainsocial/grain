// Groups: what a group looks like from grain's side.
//
// A group is an ordinary atproto account that a group host has declared.
// The declaration is the one public record, and it reaches grain through the
// index. The profile and rules live in the group's meta space, which
// grain reads as its host lists it; the roster lives in the members space,
// which grain never sees — the viewer's own PDS says which groups they are in.
//
// The declaration is read from its table by name. That is deliberate: the
// namespace moved from `group.opensocial.*` on 2026-09-16, the table names
// follow the NSIDs, and a rename that misses one fails silently — an index that
// matches nothing lists no groups, which reads as "none yet" rather than as a
// fault. These tests are what makes that loud.
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { startTestServer } from "@hatk/hatk/test";
import {
  acceptMembership,
  candidateGroups,
  groupsOf,
  membersSpaceOf,
  withdrawAcceptance,
} from "../server/helpers/membership.ts";

const CLUB = "did:plc:club";
const QUIET = "did:plc:quiet";
const ALICE = "did:plc:alice";
const BOB = "did:plc:bob";

let server: Awaited<ReturnType<typeof startTestServer>>;

/** Declare `did` a group, as its host's one public record would. */
async function declareGroup(db: any, did: string, opts: { handle: string; createdAt?: string }) {
  await db.run(`INSERT INTO _repos (did, status, handle) VALUES ($1, 'active', $2)`, [
    did,
    opts.handle,
  ]);
  await db.run(
    `INSERT INTO "fyi.opensocial.declaration" (uri, cid, did, indexed_at, meta, created_at)
     VALUES ($1, $2, $3, 'i', $4, $5)`,
    [
      `at://${did}/fyi.opensocial.declaration/self`,
      `cid-decl-${did}`,
      did,
      `at://${did}/space/fyi.opensocial.meta/self`,
      opts.createdAt ?? "2026-09-01T00:00:00Z",
    ],
  );
}

/** What the group's host lists about it: the public half of its meta space. */
const LISTING = [
  {
    did: "did:plc:club",
    handle: "club.test",
    displayName: "The Club",
    description: "A club.",
    joinPolicy: "fyi.opensocial.profile#request",
    url: "https://club.example",
    rules: [
      { rkey: "1", title: "Be kind", text: "Because." },
      { rkey: "2", title: "Ride safe", text: "Because." },
    ],
  },
];

/** A gallery with one photo in it, so the feeds' "not empty" rule passes. */
async function gallery(db: any, did: string, id: string, createdAt: string) {
  const uri = `at://${did}/social.grain.gallery/${id}`;
  await db.run(
    `INSERT INTO "social.grain.gallery" (uri, cid, did, indexed_at, title, created_at)
     VALUES ($1, $2, $3, 'i', $4, $5)`,
    [uri, `cid-${id}`, did, id, createdAt],
  );
  await db.run(
    `INSERT INTO "social.grain.gallery.item" (uri, cid, did, indexed_at, gallery, item, position, created_at)
     VALUES ($1, $2, $3, 'i', $4, $5, 0, $6)`,
    [
      `at://${did}/social.grain.gallery.item/${id}`,
      `cid-item-${id}`,
      did,
      uri,
      `at://${did}/social.grain.photo/${id}`,
      createdAt,
    ],
  );
  return uri;
}

/** The group's record that a gallery is in its pool. */
async function pool(db: any, groupDid: string, galleryUri: string, id: string, createdAt: string) {
  await db.run(
    `INSERT INTO "social.grain.group.item" (uri, cid, did, indexed_at, gallery, created_at)
     VALUES ($1, $2, $3, 'i', $4, $5)`,
    [
      `at://${groupDid}/social.grain.group.item/${id}`,
      `cid-gi-${id}`,
      groupDid,
      galleryUri,
      createdAt,
    ],
  );
}

/** The groups feed, as bare gallery ids. */
async function groupsFeed(as?: string) {
  const path = "/xrpc/dev.hatk.getFeed?feed=groups";
  const res = as ? await server.fetchAs(as, path) : await server.fetch(path);
  expect(res.status).toBe(200);
  return ((await res.json()).items ?? []).map((i: any) => i.uri.split("/").pop());
}

const listGroups = async (as?: string) => {
  const path = "/xrpc/social.grain.unspecced.listGroups";
  const res = as ? await server.fetchAs(as, path) : await server.fetch(path);
  return (await res.json()).groups as any[];
};

const getGroup = async (actor: string, as?: string) => {
  const path = `/xrpc/social.grain.unspecced.getGroup?actor=${encodeURIComponent(actor)}`;
  return as ? await server.fetchAs(as, path) : await server.fetch(path);
};

beforeAll(async () => {
  server = await startTestServer();
  const { db } = server;

  await declareGroup(db, CLUB, { handle: "club.test", createdAt: "2026-09-01T00:00:00Z" });
  await declareGroup(db, QUIET, { handle: "quiet.test", createdAt: "2026-09-03T00:00:00Z" });

  for (const did of [ALICE, BOB]) {
    await db.run(`INSERT INTO _repos (did, status, handle) VALUES ($1, 'active', $2)`, [
      did,
      `${did.split(":").pop()}.test`,
    ]);
  }

  // Two galleries in the club's pool. Grain cannot see the roster, so the
  // pool is whatever the group itself put in it.
  const byAlice = await gallery(db, ALICE, "ga", "2026-09-05T00:00:00Z");
  const byBob = await gallery(db, BOB, "gb", "2026-09-06T00:00:00Z");
  await pool(db, CLUB, byAlice, "pa", "2026-09-05T01:00:00Z");
  await pool(db, CLUB, byBob, "pb", "2026-09-06T01:00:00Z");
});

describe("the groups feed", () => {
  test("carries every gallery the group has pooled", async () => {
    expect((await groupsFeed()).sort()).toEqual(["ga", "gb"]);
  });
});

// `groupListing` asks each group's host what it lists, and
// `resolveGroupActor` may resolve a DID. Both hosts are stood in for here: the
// PLC directory names the club's PDS, the PDS names itself, and it lists the
// club. Anything else outbound is refused; the harness drives the server over
// loopback through the same global, so those calls pass through.
const realFetch = globalThis.fetch;
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : (input?.url ?? String(input));
      // A group's DID document, from whichever PLC directory is asked.
      const path = decodeURIComponent(url);
      if (path.endsWith(`/${CLUB}`) || path.endsWith(`/${QUIET}`)) {
        return json({ service: [{ id: "#atproto_pds", serviceEndpoint: "https://host.example" }] });
      }
      if (/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])[:/]/.test(url)) {
        return realFetch(input, init);
      }
      if (url === "https://host.example/.well-known/did.json") {
        return json({ id: "did:web:host.example" });
      }
      if (url === "https://host.example/xrpc/fyi.opensocial.listGroups") {
        return json({ groups: LISTING });
      }
      // The host admits Alice to the club's members space and nobody else.
      if (url === "https://host.example/xrpc/com.atproto.space.getSpaceCredential") {
        const { space } = JSON.parse(init?.body ?? "{}");
        const token = String(init?.headers?.authorization ?? "");
        return space === membersSpaceOf(CLUB) && token === `Bearer token-${ALICE}`
          ? json({ credential: "cred" })
          : new Response(JSON.stringify({ error: "UserNotAuthorized" }), { status: 400 });
      }
      throw new Error(`refused outbound fetch: ${url}`);
    }),
  );
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await server.close();
});

describe("listGroups", () => {
  test("lists every declared group", async () => {
    const groups = await listGroups();
    expect(groups.map((g) => g.did).sort()).toEqual([CLUB, QUIET].sort());
  });

  test("carries the group's profile as its host lists it", async () => {
    const club = (await listGroups()).find((g) => g.did === CLUB);
    expect(club.displayName).toBe("The Club");
    expect(club.handle).toBe("club.test");
    expect(club.joinPolicy).toBe("request");
    // How a third-party app finds the group's own site.
    expect(club.url).toBe("https://club.example");
  });

  test("says nothing about the roster", async () => {
    // Who belongs is members-only; there is no count to give.
    const club = (await listGroups()).find((g) => g.did === CLUB);
    expect(club).not.toHaveProperty("memberCount");
  });

  test("carries the rules in order, addressed in the meta space", async () => {
    const club = (await listGroups()).find((g) => g.did === CLUB);
    expect(club.rules.map((r: any) => r.title)).toEqual(["Be kind", "Ride safe"]);
    // The address a moderation label cites.
    expect(club.rules[0].uri).toBe(
      `at://${CLUB}/space/fyi.opensocial.meta/self/${CLUB}/fyi.opensocial.rule/1`,
    );
  });

  test("a group its host does not list shows by handle", async () => {
    const quiet = (await listGroups()).find((g) => g.did === QUIET);
    expect(quiet.handle).toBe("quiet.test");
    expect(quiet.displayName).toBeUndefined();
  });

  test("a group with an empty pool still lists", async () => {
    // Otherwise nobody could ever submit the first gallery to one.
    expect((await listGroups()).some((g) => g.did === QUIET)).toBe(true);
  });
});

describe("a profile edited on the host", () => {
  test("reaches whoever is acting as the group at once, and everyone else later", async () => {
    await listGroups(); // warm the cache
    const club = LISTING.find((g) => g.did === CLUB)!;
    const before = club.url;
    club.url = "https://moved.example";
    try {
      expect((await listGroups()).find((g) => g.did === CLUB).url).toBe(before);
      expect((await listGroups(CLUB)).find((g) => g.did === CLUB).url).toBe(
        "https://moved.example",
      );
      // The fresh read refills the cache for everyone.
      expect((await listGroups()).find((g) => g.did === CLUB).url).toBe("https://moved.example");
    } finally {
      club.url = before;
      await listGroups(CLUB); // and put the cache back
    }
  });
});

describe("viewer state", () => {
  test("a viewer whose PDS cannot be asked is not taken for a member", async () => {
    // No PDS stands behind a test session, so listSpaces fails — and a
    // failure is "no groups", never an error on the page.
    const club = (await listGroups(ALICE)).find((g) => g.did === CLUB);
    expect(club.viewer?.member ?? false).toBe(false);
  });

  test("a signed-out viewer has no membership either way", async () => {
    const club = (await listGroups()).find((g) => g.did === CLUB);
    expect(club.viewer?.member ?? false).toBe(false);
  });
});

describe("getGroup", () => {
  test("resolves a group by DID", async () => {
    const res = await getGroup(CLUB);
    expect(res.status).toBe(200);
    expect((await res.json()).displayName).toBe("The Club");
  });

  test("resolves a group by handle", async () => {
    const res = await getGroup("club.test");
    expect(res.status).toBe(200);
    expect((await res.json()).did).toBe(CLUB);
  });

  test("an account that is not a group is not a group", async () => {
    // Alice has a repo and a handle; what she does not have is a declaration.
    expect((await getGroup(ALICE)).status).toBe(400);
  });

  test("an unknown actor is not a group", async () => {
    expect((await getGroup("nobody.test")).status).toBe(400);
  });
});

// Which groups a viewer is in: candidates from their own PDS, each confirmed
// with the group's host. Both halves matter — a PDS lists a members space
// after the acceptance in it is gone, and stores one nobody admitted.
describe("groupsOf", () => {
  /** A viewer's PDS: `listSpaces` pages, and delegation tokens naming them. */
  const pdsFor = (viewer: string, pages: { spaces: { uri: string }[]; cursor?: string }[]) => {
    const listCalls: any[] = [];
    const pds = vi.fn(async (nsid: string, opts?: any) => {
      if (nsid === "com.atproto.space.getDelegationToken") return { token: `token-${viewer}` };
      listCalls.push({ nsid, ...opts });
      return pages[listCalls.length - 1] ?? { spaces: [] };
    });
    return { pds, listCalls };
  };

  test("asks the viewer's PDS for their members spaces", async () => {
    const { pds, listCalls } = pdsFor(ALICE, [{ spaces: [{ uri: membersSpaceOf(CLUB) }] }]);
    expect(await candidateGroups(pds)).toEqual([CLUB]);
    expect(listCalls[0]).toMatchObject({
      nsid: "com.atproto.space.listSpaces",
      params: { type: "fyi.opensocial.members" },
    });
  });

  test("follows the cursor", async () => {
    const { pds } = pdsFor(ALICE, [
      { spaces: [{ uri: membersSpaceOf(CLUB) }], cursor: "c1" },
      { spaces: [{ uri: membersSpaceOf(QUIET) }] },
    ]);
    expect(await candidateGroups(pds)).toEqual([CLUB, QUIET]);
  });

  test("keeps only the candidates the host admits", async () => {
    const { pds } = pdsFor(ALICE, [
      { spaces: [{ uri: membersSpaceOf(CLUB) }, { uri: membersSpaceOf(QUIET) }] },
    ]);
    expect(await groupsOf(pds, ALICE)).toEqual([CLUB]);
  });

  test("drops an acceptance the host never admitted", async () => {
    // Bob wrote one into the club's members space; his PDS lists it anyway.
    const { pds } = pdsFor(BOB, [{ spaces: [{ uri: membersSpaceOf(CLUB) }] }]);
    expect(await groupsOf(pds, BOB)).toEqual([]);
  });
});

describe("acceptance", () => {
  test("is written into the members space, in the viewer's own repo", async () => {
    const pds = vi.fn(async () => ({}));
    await acceptMembership(pds, ALICE, CLUB);
    expect(pds).toHaveBeenCalledWith("com.atproto.space.putRecord", {
      method: "POST",
      body: expect.objectContaining({
        space: membersSpaceOf(CLUB),
        repo: ALICE,
        collection: "fyi.opensocial.acceptance",
        rkey: "self",
      }),
    });
  });

  test("is withdrawn from the same place", async () => {
    const pds = vi.fn(async () => ({}));
    await withdrawAcceptance(pds, ALICE, CLUB);
    expect(pds).toHaveBeenCalledWith("com.atproto.space.deleteRecord", {
      method: "POST",
      body: {
        space: membersSpaceOf(CLUB),
        repo: ALICE,
        collection: "fyi.opensocial.acceptance",
        rkey: "self",
      },
    });
  });
});
