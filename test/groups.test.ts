// Groups: what a community looks like from grain's side.
//
// A group is an ordinary atproto account that a community host has declared,
// and everything public about it — that it is one, who is on its roster, its
// profile and rules — reaches grain the ordinary way, through the index. Only
// the pool is private, and none of that is exercised here.
//
// These read from the `fyi.opensocial.*` tables by name. That is deliberate:
// the namespace moved from `community.opensocial.*` on 2026-09-16, the table
// names follow the NSIDs, and a rename that misses one of them fails silently —
// an index that matches nothing returns an empty roster, which reads as "no
// members" rather than as a fault. These tests are what makes that loud.
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { startTestServer } from "@hatk/hatk/test";
import { groupsOf } from "../server/helpers/pool.ts";

const CLUB = "did:plc:club";
const QUIET = "did:plc:quiet";
const ALICE = "did:plc:alice";
const BOB = "did:plc:bob";

let server: Awaited<ReturnType<typeof startTestServer>>;

/** Declare `did` a community, as its host's public records would. */
async function declareCommunity(
  db: any,
  did: string,
  opts: { handle: string; displayName?: string; url?: string; createdAt?: string },
) {
  await db.run(`INSERT INTO _repos (did, status, handle) VALUES ($1, 'active', $2)`, [
    did,
    opts.handle,
  ]);
  await db.run(
    `INSERT INTO "fyi.opensocial.declaration" (uri, cid, did, indexed_at, about, created_at)
     VALUES ($1, $2, $3, 'i', $4, $5)`,
    [
      `at://${did}/fyi.opensocial.declaration/self`,
      `cid-decl-${did}`,
      did,
      `at://${did}/space/fyi.opensocial.about/self`,
      opts.createdAt ?? "2026-09-01T00:00:00Z",
    ],
  );
  await db.run(
    `INSERT INTO "fyi.opensocial.profile"
       (uri, cid, did, indexed_at, display_name, description, join_policy, url, created_at)
     VALUES ($1, $2, $3, 'i', $4, $5, $6, $7, $8)`,
    [
      `at://${did}/fyi.opensocial.profile/self`,
      `cid-prof-${did}`,
      did,
      opts.displayName ?? opts.handle,
      "A club.",
      "fyi.opensocial.profile#request",
      opts.url ?? null,
      opts.createdAt ?? "2026-09-01T00:00:00Z",
    ],
  );
}

/** The community's public attestation that someone is on its roster. */
async function addMember(db: any, groupDid: string, memberDid: string) {
  await db.run(
    `INSERT INTO "fyi.opensocial.member" (uri, cid, did, indexed_at, member, created_at)
     VALUES ($1, $2, $3, 'i', $4, '2026-09-02T00:00:00Z')`,
    [
      `at://${groupDid}/fyi.opensocial.member/${memberDid}`,
      `cid-mem-${groupDid}-${memberDid}`,
      groupDid,
      memberDid,
    ],
  );
}

async function rule(db: any, groupDid: string, rkey: string, title: string) {
  await db.run(
    `INSERT INTO "fyi.opensocial.rule" (uri, cid, did, indexed_at, title, text, created_at)
     VALUES ($1, $2, $3, 'i', $4, 'Because.', $5)`,
    [
      `at://${groupDid}/fyi.opensocial.rule/${rkey}`,
      `cid-${rkey}`,
      groupDid,
      title,
      `2026-09-0${rkey}T00:00:00Z`,
    ],
  );
}

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

  await declareCommunity(db, CLUB, {
    handle: "club.test",
    displayName: "The Club",
    url: "https://club.example",
    createdAt: "2026-09-01T00:00:00Z",
  });
  await declareCommunity(db, QUIET, { handle: "quiet.test", createdAt: "2026-09-03T00:00:00Z" });

  // Alice is on the club's roster; Bob is not on anyone's.
  await addMember(db, CLUB, ALICE);
  await rule(db, CLUB, "1", "Be kind");
  await rule(db, CLUB, "2", "Ride safe");

  for (const did of [ALICE, BOB]) {
    await db.run(`INSERT INTO _repos (did, status, handle) VALUES ($1, 'active', $2)`, [
      did,
      `${did.split(":").pop()}.test`,
    ]);
  }

  // Two galleries in the club's pool: one by a member, one by an account the
  // club has since taken off its roster.
  const byMember = await gallery(db, ALICE, "ga", "2026-09-05T00:00:00Z");
  const byStranger = await gallery(db, BOB, "gb", "2026-09-06T00:00:00Z");
  await pool(db, CLUB, byMember, "pa", "2026-09-05T01:00:00Z");
  await pool(db, CLUB, byStranger, "pb", "2026-09-06T01:00:00Z");
});

describe("the groups feed", () => {
  test("carries a pooled gallery whose author is on the roster", async () => {
    expect(await groupsFeed()).toContain("ga");
  });

  test("drops one whose author is not", async () => {
    // Membership is the permission. A gallery pooled by someone since ejected
    // stops being visible with them, without the item record being deleted —
    // which is what makes ejection mean something here.
    expect(await groupsFeed()).not.toContain("gb");
  });
});

// `communitySite` asks each community's host where it lives, and `resolveGroupActor`
// may resolve a DID. There is no host here and no network worth waiting for, and
// both swallow the failure by design. Only outbound calls are refused; the
// harness drives the server through the same global, so those pass through.
const realFetch = globalThis.fetch;
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : (input?.url ?? String(input));
      // The harness drives the server over loopback through this same global.
      if (!/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])[:/]/.test(url)) {
        throw new Error(`refused outbound fetch: ${url}`);
      }
      return realFetch(input, init);
    }),
  );
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await server.close();
});

describe("listGroups", () => {
  test("lists every declared community", async () => {
    const groups = await listGroups();
    expect(groups.map((g) => g.did).sort()).toEqual([CLUB, QUIET].sort());
  });

  test("carries the community's public profile", async () => {
    const club = (await listGroups()).find((g) => g.did === CLUB);
    expect(club.displayName).toBe("The Club");
    expect(club.handle).toBe("club.test");
    // Read from the profile record, which is how a third-party app finds the
    // community's own site.
    expect(club.url).toBe("https://club.example");
  });

  test("counts the roster", async () => {
    const groups = await listGroups();
    expect(groups.find((g) => g.did === CLUB).memberCount).toBe(1);
    expect(groups.find((g) => g.did === QUIET).memberCount ?? 0).toBe(0);
  });

  test("carries the rules in the order they were written", async () => {
    const club = (await listGroups()).find((g) => g.did === CLUB);
    expect(club.rules.map((r: any) => r.title)).toEqual(["Be kind", "Ride safe"]);
  });

  test("a group with an empty pool still lists", async () => {
    // Otherwise nobody could ever submit the first gallery to one.
    expect((await listGroups()).some((g) => g.did === QUIET)).toBe(true);
  });
});

describe("viewer state", () => {
  test("a member is told they are on the roster", async () => {
    const club = (await listGroups(ALICE)).find((g) => g.did === CLUB);
    expect(club.viewer?.member).toBe(true);
  });

  test("a non-member is not", async () => {
    const club = (await listGroups(BOB)).find((g) => g.did === CLUB);
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

  test("an account that is not a community is not a group", async () => {
    // Alice has a repo and a handle; what she does not have is a declaration.
    expect((await getGroup(ALICE)).status).toBe(400);
  });

  test("an unknown actor is not a group", async () => {
    expect((await getGroup("nobody.test")).status).toBe(400);
  });
});

// `groupsOf` decides which pools a viewer's feed even asks about. It reads the
// same roster table as everything above, so it breaks the same way on a missed
// rename — and it breaks quietly, as an empty feed rather than an error.
describe("groupsOf", () => {
  test("names the communities whose roster the viewer is on", async () => {
    expect(await groupsOf(server.db, ALICE)).toEqual([CLUB]);
  });

  test("is empty for someone on no roster", async () => {
    expect(await groupsOf(server.db, BOB)).toEqual([]);
  });

  test("is empty for an account that does not exist", async () => {
    expect(await groupsOf(server.db, "did:plc:nobody")).toEqual([]);
  });
});
