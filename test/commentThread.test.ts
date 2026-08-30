import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startTestServer } from "@hatk/hatk/test";

const ALICE = "did:plc:alice";
const BOB = "did:plc:bob";
const CAROL = "did:plc:carol";

let server: Awaited<ReturnType<typeof startTestServer>>;

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

  await db.run(
    `INSERT INTO "social.grain.gallery" (uri, cid, did, indexed_at, title, created_at)
     VALUES ($1, $2, $3, 'i', $4, $5)`,
    [`at://${ALICE}/social.grain.gallery/g1`, "cid-g", ALICE, "title", "2026-01-01"],
  );

  const subject = `at://${ALICE}/social.grain.gallery/g1`;
  for (const [rkey, did, text, createdAt] of [
    ["c1", BOB, "bob comment", "2026-02-01"],
    ["c2", CAROL, "carol comment", "2026-02-02"],
  ]) {
    await db.run(
      `INSERT INTO "social.grain.comment" (uri, cid, did, indexed_at, subject, text, created_at)
       VALUES ($1, $2, $3, 'i', $4, $5, $6)`,
      [`at://${did}/social.grain.comment/${rkey}`, `cid-${rkey}`, did, subject, text, createdAt],
    );
  }
});

afterAll(async () => {
  await server?.close();
});

const path = (query = "") =>
  `/xrpc/social.grain.unspecced.getCommentThread?subject=${encodeURIComponent(
    `at://${ALICE}/social.grain.gallery/g1`,
  )}${query}`;

describe("getCommentThread", () => {
  test("lists comments from active accounts", async () => {
    const res = await server.fetchAs(ALICE, path());
    const body = (await res.json()) as {
      comments: { author: { did: string } }[];
      totalCount: number;
    };
    expect(body.comments.map((c) => c.author.did)).toEqual([BOB, CAROL]);
    expect(body.totalCount).toBe(2);
  });

  test("hides comments from taken-down accounts and recounts", async () => {
    await server.db.run(`UPDATE _repos SET status = 'takendown' WHERE did = $1`, [CAROL]);
    try {
      const res = await server.fetchAs(ALICE, path());
      const body = (await res.json()) as {
        comments: { author: { did: string } }[];
        totalCount: number;
      };
      expect(body.comments.map((c) => c.author.did)).toEqual([BOB]);
      expect(body.totalCount).toBe(1);
    } finally {
      await server.db.run(`UPDATE _repos SET status = 'active' WHERE did = $1`, [CAROL]);
    }
  });
});
