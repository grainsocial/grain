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

beforeAll(async () => {
  server = await startTestServer();
  const { db } = server;

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

  // Bob and Carol follow Alice; Alice follows both back.
  await follow("b-a", BOB, ALICE, "2026-05-02");
  await follow("c-a", CAROL, ALICE, "2026-05-01");
  await follow("a-b", ALICE, BOB, "2026-05-03");
  await follow("a-c", ALICE, CAROL, "2026-05-04");
});

afterAll(async () => {
  await server?.close();
});

describe("getFollowers", () => {
  const path = (query = "") => `/xrpc/social.grain.unspecced.getFollowers?actor=${ALICE}${query}`;

  test("lists active followers and counts them", async () => {
    const res = await server.fetchAs(ALICE, path());
    const body = (await res.json()) as { items: { did: string }[]; totalCount: number };
    expect(body.items.map((i) => i.did)).toEqual([BOB, CAROL]);
    expect(body.totalCount).toBe(2);
  });

  test("hides taken-down followers from the list and count", async () => {
    await server.db.run(`UPDATE _repos SET status = 'takendown' WHERE did = $1`, [CAROL]);
    try {
      const res = await server.fetchAs(ALICE, path());
      const body = (await res.json()) as { items: { did: string }[]; totalCount: number };
      expect(body.items.map((i) => i.did)).toEqual([BOB]);
      expect(body.totalCount).toBe(1);
    } finally {
      await server.db.run(`UPDATE _repos SET status = 'active' WHERE did = $1`, [CAROL]);
    }
  });

  test("hides followers the viewer blocks", async () => {
    await server.db.run(
      `INSERT INTO "social.grain.graph.block" (uri, cid, did, indexed_at, subject, created_at)
       VALUES ($1, 'cid-b', $2, 'i', $3, '2026-01-01')`,
      [`at://${ALICE}/social.grain.graph.block/1`, ALICE, CAROL],
    );
    try {
      const res = await server.fetchAs(ALICE, path());
      const body = (await res.json()) as { items: { did: string }[] };
      expect(body.items.map((i) => i.did)).toEqual([BOB]);
    } finally {
      await server.db.run(`DELETE FROM "social.grain.graph.block" WHERE did = $1`, [ALICE]);
    }
  });

  test("still lists muted followers — a mute hides content, not the follow", async () => {
    await server.db.run(
      `CREATE TABLE IF NOT EXISTS _mutes (
         did TEXT NOT NULL, subject TEXT NOT NULL, created_at TEXT NOT NULL,
         PRIMARY KEY (did, subject)
       )`,
    );
    await server.db.run(`INSERT INTO _mutes (did, subject, created_at) VALUES ($1, $2, 'i')`, [
      ALICE,
      CAROL,
    ]);
    try {
      const res = await server.fetchAs(ALICE, path());
      const body = (await res.json()) as { items: { did: string }[] };
      expect(body.items.map((i) => i.did)).toContain(CAROL);
    } finally {
      await server.db.run(`DELETE FROM _mutes WHERE did = $1`, [ALICE]);
    }
  });
});

describe("getFollowing", () => {
  const path = (query = "") => `/xrpc/social.grain.unspecced.getFollowing?actor=${ALICE}${query}`;

  test("lists active following and counts them", async () => {
    const res = await server.fetchAs(ALICE, path());
    const body = (await res.json()) as { items: { did: string }[]; totalCount: number };
    expect(body.items.map((i) => i.did)).toEqual([CAROL, BOB]);
    expect(body.totalCount).toBe(2);
  });

  test("hides taken-down accounts from the list and count", async () => {
    await server.db.run(`UPDATE _repos SET status = 'takendown' WHERE did = $1`, [BOB]);
    try {
      const res = await server.fetchAs(ALICE, path());
      const body = (await res.json()) as { items: { did: string }[]; totalCount: number };
      expect(body.items.map((i) => i.did)).toEqual([CAROL]);
      expect(body.totalCount).toBe(1);
    } finally {
      await server.db.run(`UPDATE _repos SET status = 'active' WHERE did = $1`, [BOB]);
    }
  });

  test("hides accounts the viewer blocks", async () => {
    await server.db.run(
      `INSERT INTO "social.grain.graph.block" (uri, cid, did, indexed_at, subject, created_at)
       VALUES ($1, 'cid-b', $2, 'i', $3, '2026-01-01')`,
      [`at://${ALICE}/social.grain.graph.block/1`, ALICE, CAROL],
    );
    try {
      const res = await server.fetchAs(ALICE, path());
      const body = (await res.json()) as { items: { did: string }[] };
      expect(body.items.map((i) => i.did)).toEqual([BOB]);
    } finally {
      await server.db.run(`DELETE FROM "social.grain.graph.block" WHERE did = $1`, [ALICE]);
    }
  });
});
