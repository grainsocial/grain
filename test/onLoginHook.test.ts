// The on-login hook, which seeds a grain profile from the user's Bluesky one
// the first time they sign in.
//
// Like the on-commit hooks, `defineHook` hands back the handler untouched, so
// this runs against a real database. `fetch` is stubbed because the hook reads
// the Bluesky profile straight off the user's PDS, and the two record writers
// are stubbed to record what would have been written to it.

import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { startTestServer } from "@hatk/hatk/test";
import onLogin from "../server/hooks/on-login.ts";

const NEW = "did:plc:newcomer"; // no grain profile at all
const BARE = "did:plc:bare"; // a grain profile with no display name
const DONE = "did:plc:done"; // a grain profile already filled in
const NOSESSION = "did:plc:nosession"; // no oauth session row

const PDS = "https://pds.example";

let server: any;

/** Runs the hook and reports what it tried to do. */
async function fire(did: string) {
  const created: any[] = [];
  const put: any[] = [];
  const ensured: string[] = [];
  await onLogin.handler({
    did,
    db: server.db,
    lookup: (async (_collection: string, _field: string, dids: string[]) => {
      const rows = (await server.db.query(
        `SELECT did, cid, display_name, created_at FROM "social.grain.actor.profile" WHERE did IN (${dids
          .map((_, i) => `$${i + 1}`)
          .join(",")})`,
        dids,
      )) as any[];
      const map = new Map();
      for (const r of rows) {
        map.set(r.did, {
          did: r.did,
          cid: r.cid,
          value: { displayName: r.display_name ?? undefined, createdAt: r.created_at },
        });
      }
      return map;
    }) as any,
    ensureRepo: async (d: string) => void ensured.push(d),
    createRecord: async (collection: string, record: any, opts?: any) => {
      created.push({ collection, record, opts });
      return {};
    },
    putRecord: async (collection: string, rkey: string, record: any) => {
      put.push({ collection, rkey, record });
      return {};
    },
    deleteRecord: async () => {},
  } as any);
  return { created, put, ensured };
}

const BSKY_PROFILE = {
  displayName: "Alice from Bluesky",
  description: "photographer",
  avatar: { $type: "blob", ref: { $link: "bafy-avatar" }, mimeType: "image/jpeg", size: 1 },
};

/** Answers the PDS getRecord call; everything else 404s. */
function stubPds(value: unknown | null, ok = true) {
  vi.stubGlobal("fetch", async (url: string) => {
    if (typeof url === "string" && url.includes("com.atproto.repo.getRecord")) {
      if (!ok) return new Response("nope", { status: 500 });
      return new Response(JSON.stringify({ value }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("{}", { status: 404 });
  });
}

beforeAll(async () => {
  server = await startTestServer();
  const { db } = server;

  for (const did of [NEW, BARE, DONE, NOSESSION]) {
    await db.run(`INSERT INTO _repos (did, status, handle) VALUES ($1, 'active', $2)`, [
      did,
      `${did.split(":").pop()}.test`,
    ]);
  }

  // Everyone but NOSESSION has signed in, so we know where their PDS is.
  for (const did of [NEW, BARE, DONE]) {
    await db.run(
      `INSERT INTO _oauth_sessions (did, pds_endpoint, access_token, dpop_jkt)
       VALUES ($1, $2, 'tok', 'jkt')`,
      [did, PDS],
    );
  }

  // BARE has a profile record but never set a display name; DONE has one.
  await db.run(
    `INSERT INTO "social.grain.actor.profile" (uri, cid, did, indexed_at, created_at)
     VALUES ($1, 'cid-bare', $2, 'i', '2020-01-01')`,
    [`at://${BARE}/social.grain.actor.profile/self`, BARE],
  );
  await db.run(
    `INSERT INTO "social.grain.actor.profile" (uri, cid, did, indexed_at, display_name, created_at)
     VALUES ($1, 'cid-done', $2, 'i', 'Already Set', '2020-01-01')`,
    [`at://${DONE}/social.grain.actor.profile/self`, DONE],
  );
});

afterEach(() => vi.unstubAllGlobals());
afterAll(async () => await server?.close());

describe("on-login", () => {
  test("kicks off a backfill for whoever just signed in", async () => {
    stubPds(BSKY_PROFILE);
    const { ensured } = await fire(NEW);
    expect(ensured).toEqual([NEW]);
  });

  test("creates a grain profile from the Bluesky one on a first sign-in", async () => {
    stubPds(BSKY_PROFILE);
    const { created, put } = await fire(NEW);
    expect(put).toEqual([]);
    expect(created).toHaveLength(1);
    expect(created[0].collection).toBe("social.grain.actor.profile");
    expect(created[0].opts).toEqual({ rkey: "self" });
    expect(created[0].record).toMatchObject({
      displayName: "Alice from Bluesky",
      description: "photographer",
      avatar: BSKY_PROFILE.avatar,
    });
    expect(created[0].record.createdAt).toBeTruthy();
  });

  test("updates an existing but empty profile rather than creating a second", async () => {
    stubPds(BSKY_PROFILE);
    const { created, put } = await fire(BARE);
    expect(created).toEqual([]);
    expect(put).toHaveLength(1);
    expect(put[0]).toMatchObject({ collection: "social.grain.actor.profile", rkey: "self" });
    expect(put[0].record.displayName).toBe("Alice from Bluesky");
  });

  test("keeps the original createdAt when filling in an existing profile", async () => {
    // The account's own history, not the moment we noticed it was blank.
    stubPds(BSKY_PROFILE);
    const { put } = await fire(BARE);
    expect(put[0].record.createdAt).toBe("2020-01-01");
  });

  test("leaves a profile that already has a display name alone", async () => {
    stubPds(BSKY_PROFILE);
    const { created, put } = await fire(DONE);
    expect(created).toEqual([]);
    expect(put).toEqual([]);
  });

  test("writes only the fields Bluesky actually had", async () => {
    stubPds({ displayName: "Just a name" });
    const { created } = await fire(NEW);
    expect(created[0].record.displayName).toBe("Just a name");
    expect(created[0].record).not.toHaveProperty("description");
    expect(created[0].record).not.toHaveProperty("avatar");
  });

  test("writes nothing when there is no session to find the PDS with", async () => {
    stubPds(BSKY_PROFILE);
    const { created, put, ensured } = await fire(NOSESSION);
    expect(ensured).toEqual([NOSESSION]); // the backfill still runs
    expect(created).toEqual([]);
    expect(put).toEqual([]);
  });

  test("writes nothing when the PDS refuses the request", async () => {
    stubPds(BSKY_PROFILE, false);
    const { created, put } = await fire(NEW);
    expect(created).toEqual([]);
    expect(put).toEqual([]);
  });

  test("writes nothing when the PDS has no Bluesky profile to copy", async () => {
    stubPds(null);
    const { created, put } = await fire(NEW);
    expect(created).toEqual([]);
    expect(put).toEqual([]);
  });
});
