import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startTestServer } from "@hatk/hatk/test";

const ALICE = "did:plc:alice";
const BOB = "did:plc:bob";
const CAROL = "did:plc:carol";

let server: Awaited<ReturnType<typeof startTestServer>>;

const follow = (rkey: string, did: string, subject: string, createdAt: string) =>
  server.db.run(
    `INSERT INTO "social.grain.graph.follow" (uri, cid, did, indexed_at, subject, created_at)
     VALUES ($1, $2, $3, 'i', $4, $5)`,
    [`at://${did}/social.grain.graph.follow/${rkey}`, `cid-${rkey}`, did, subject, createdAt],
  );

const fav = (rkey: string, did: string, subject: string, createdAt: string) =>
  server.db.run(
    `INSERT INTO "social.grain.favorite" (uri, cid, did, indexed_at, subject, created_at)
     VALUES ($1, $2, $3, 'i', $4, $5)`,
    [`at://${did}/social.grain.favorite/${rkey}`, `cid-${rkey}`, did, subject, createdAt],
  );

const gallery = (rkey: string, did: string, createdAt: string) =>
  server.db.run(
    `INSERT INTO "social.grain.gallery" (uri, cid, did, indexed_at, title, created_at)
     VALUES ($1, $2, $3, 'i', $4, $5)`,
    [`at://${did}/social.grain.gallery/${rkey}`, `cid-${rkey}`, did, "title", createdAt],
  );

beforeAll(async () => {
  server = await startTestServer();
  const { db } = server;

  // The test harness skips server/setup, so _mutes isn't there by default.
  await db.run(
    `CREATE TABLE IF NOT EXISTS _mutes (
       did TEXT NOT NULL, subject TEXT NOT NULL, created_at TEXT NOT NULL,
       PRIMARY KEY (did, subject)
     )`,
  );

  for (const [did, handle] of [
    [ALICE, "alice.test"],
    [BOB, "bob.test"],
    [CAROL, "carol.test"],
  ]) {
    await db.run(`INSERT INTO _repos (did, status, handle) VALUES ($1, 'active', $2)`, [
      did,
      handle,
    ]);
  }

  // Alice owns a gallery. Bob and Carol both follow her; Carol also favors the
  // gallery, so her activity would otherwise surface in two notification rows.
  await gallery("g-a", ALICE, "2026-01-01");
  await follow("b-a", BOB, ALICE, "2026-05-02");
  await follow("c-a", CAROL, ALICE, "2026-05-01");
  await fav("c-g", CAROL, `at://${ALICE}/social.grain.gallery/g-a`, "2026-05-03");
});

afterAll(async () => {
  await server?.close();
});

const path = (query = "") => `/xrpc/social.grain.unspecced.getNotifications${query}`;

describe("getNotifications", () => {
  test("returns activity from active accounts", async () => {
    const res = await server.fetchAs(ALICE, path());
    const rows = (await res.json()).notifications as Array<{
      reason: string;
      author: { did: string };
    }>;

    const follows = rows.filter((r) => r.reason === "follow");
    expect(follows.map((r) => r.author.did)).toEqual([BOB, CAROL]);
    expect(rows.some((r) => r.reason === "gallery-favorite" && r.author.did === CAROL)).toBe(true);
  });

  test("hides follow/favorite activity from taken-down accounts", async () => {
    await server.db.run(`UPDATE _repos SET status = 'takendown' WHERE did = $1`, [CAROL]);

    try {
      const res = await server.fetchAs(ALICE, path());
      const rows = (await res.json()).notifications as Array<{
        reason: string;
        author: { did: string };
      }>;
      expect(rows.some((r) => r.author.did === CAROL)).toBe(false);
      expect(rows.filter((r) => r.reason === "follow").map((r) => r.author.did)).toEqual([BOB]);
    } finally {
      await server.db.run(`UPDATE _repos SET status = 'active' WHERE did = $1`, [CAROL]);
    }
  });

  test("hides taken-down accounts from the unseen count", async () => {
    await server.db.run(`UPDATE _repos SET status = 'takendown' WHERE did = $1`, [CAROL]);

    try {
      const res = await server.fetchAs(ALICE, path());
      const { unseenCount } = (await res.json()) as { unseenCount: number };
      expect(unseenCount).toBe(1); // Bob's follow only
    } finally {
      await server.db.run(`UPDATE _repos SET status = 'active' WHERE did = $1`, [CAROL]);
    }
  });
});
