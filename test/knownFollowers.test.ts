import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startTestServer } from "@hatk/hatk/test";

const ALICE = "did:plc:alice";
const VIC = "did:plc:vic";
const BOB = "did:plc:bob";
const CAROL = "did:plc:carol";
const DAVE = "did:plc:dave";

let server: Awaited<ReturnType<typeof startTestServer>>;

const follow = (rkey: string, did: string, subject: string, createdAt: string) =>
  server.db.run(
    `INSERT INTO "social.grain.graph.follow" (uri, cid, did, indexed_at, subject, created_at)
     VALUES ($1, $2, $3, 'i', $4, $5)`,
    [`at://${did}/social.grain.graph.follow/${rkey}`, `cid-${rkey}`, did, subject, createdAt],
  );

beforeAll(async () => {
  server = await startTestServer();
  const { db } = server;

  for (const [did, handle] of [
    [ALICE, "alice.test"],
    [VIC, "vic.test"],
    [BOB, "bob.test"],
    [CAROL, "carol.test"],
    [DAVE, "dave.test"],
  ]) {
    await db.run(`INSERT INTO _repos (did, status, handle) VALUES ($1, 'active', $2)`, [
      did,
      handle,
    ]);
  }

  // Dave deliberately has no grain profile — exercises the handle fallback.
  for (const [did, name] of [
    [ALICE, "Alice A"],
    [VIC, "Vic V"],
    [BOB, "Bob Ross"],
    [CAROL, "Carol Danvers"],
  ]) {
    await db.run(
      `INSERT INTO "social.grain.actor.profile" (uri, cid, did, indexed_at, display_name, created_at)
       VALUES ($1, $2, $3, '2026-01-01', $4, '2026-01-01')`,
      [`at://${did}/social.grain.actor.profile/self`, `cid-${did}`, did, name],
    );
  }

  // Bob, Carol and Dave all follow Alice.
  await follow("b-a", BOB, ALICE, "2026-05-02");
  await follow("c-a", CAROL, ALICE, "2026-05-01");
  await follow("d-a", DAVE, ALICE, "2026-05-03");

  // Vic follows Bob and Carol, but not Dave. The second Carol record is the
  // duplicate-follow case that occurs in prod — it must not fan the join out.
  await follow("v-b", VIC, BOB, "2026-04-01");
  await follow("v-b2", VIC, BOB, "2026-04-04");
  await follow("v-c", VIC, CAROL, "2026-04-02");
  await follow("v-c2", VIC, CAROL, "2026-04-03");
});

afterAll(async () => {
  await server?.close();
});

const path = (actor = ALICE, viewer = VIC, query = "") =>
  `/xrpc/social.grain.unspecced.getKnownFollowers?actor=${actor}&viewer=${viewer}${query}`;

const dids = async (res: Response) => (await res.json()).items.map((i: any) => i.did);

describe("getKnownFollowers", () => {
  test("returns Alice's followers that Vic also follows, most recent follow first", async () => {
    const res = await server.fetchAs(VIC, path());

    // Bob followed Alice after Carol did. Dave follows Alice but Vic doesn't
    // follow Dave, so he isn't "known".
    expect(await dids(res)).toEqual([BOB, CAROL]);
  });

  test("returns one entry per account even with duplicate follow records", async () => {
    const items = (await (await server.fetchAs(VIC, path())).json()).items;
    expect(items.filter((i: any) => i.did === CAROL)).toHaveLength(1);
  });

  test("does not let duplicate follow records eat into the limit", async () => {
    // Both Bob and Carol are followed twice by Vic. Applying the limit before
    // collapsing those duplicates would return a single face for limit=2.
    expect(await dids(await server.fetchAs(VIC, path(ALICE, VIC, "&limit=2")))).toEqual([
      BOB,
      CAROL,
    ]);
  });

  test("hides taken-down accounts", async () => {
    await server.db.run(`UPDATE _repos SET status = 'takendown' WHERE did = $1`, [CAROL]);

    try {
      expect(await dids(await server.fetchAs(VIC, path()))).toEqual([BOB]);
    } finally {
      await server.db.run(`UPDATE _repos SET status = 'active' WHERE did = $1`, [CAROL]);
    }
  });

  test("hides accounts the viewer blocks", async () => {
    await server.db.run(
      `INSERT INTO "social.grain.graph.block" (uri, cid, did, indexed_at, subject, created_at)
       VALUES ($1, 'cid-b', $2, 'i', $3, '2026-01-01')`,
      [`at://${VIC}/social.grain.graph.block/1`, VIC, CAROL],
    );

    try {
      expect(await dids(await server.fetchAs(VIC, path()))).toEqual([BOB]);
    } finally {
      await server.db.run(`DELETE FROM "social.grain.graph.block" WHERE did = $1`, [VIC]);
    }
  });

  test("hides accounts that block the viewer", async () => {
    await server.db.run(
      `INSERT INTO "social.grain.graph.block" (uri, cid, did, indexed_at, subject, created_at)
       VALUES ($1, 'cid-b', $2, 'i', $3, '2026-01-01')`,
      [`at://${BOB}/social.grain.graph.block/1`, BOB, VIC],
    );

    try {
      expect(await dids(await server.fetchAs(VIC, path()))).toEqual([CAROL]);
    } finally {
      await server.db.run(`DELETE FROM "social.grain.graph.block" WHERE did = $1`, [BOB]);
    }
  });

  test("still shows muted accounts — a mute hides content, not the follow", async () => {
    // The test harness skips server/setup, so _mutes isn't there by default.
    await server.db.run(
      `CREATE TABLE IF NOT EXISTS _mutes (
         did TEXT NOT NULL, subject TEXT NOT NULL, created_at TEXT NOT NULL,
         PRIMARY KEY (did, subject)
       )`,
    );
    await server.db.run(`INSERT INTO _mutes (did, subject, created_at) VALUES ($1, $2, 'i')`, [
      VIC,
      CAROL,
    ]);

    try {
      expect(await dids(await server.fetchAs(VIC, path()))).toContain(CAROL);
    } finally {
      await server.db.run(`DELETE FROM _mutes WHERE did = $1`, [VIC]);
    }
  });

  test("returns nothing when the viewer is the actor", async () => {
    expect(await dids(await server.fetchAs(ALICE, path(ALICE, ALICE)))).toEqual([]);
  });
});
