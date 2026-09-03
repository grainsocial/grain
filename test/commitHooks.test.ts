// The three on-commit hooks that turn firehose records into push
// notifications, and the four helpers they gate on: isRecent, isBlockedOrMuted,
// shouldPush and getUnseenCount.
//
// `defineHook` returns the handler untouched, so these run against a real
// database without a firehose or a server. Only `push` and `lookup` are
// stubbed: `push` to capture what would have been delivered, `lookup` because
// the hooks use it for one thing, the actor's display name.

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startTestServer } from "@hatk/hatk/test";
import commentHook from "../server/hooks/on-commit-comment.ts";
import favoriteHook from "../server/hooks/on-commit-favorite.ts";
import followHook from "../server/hooks/on-commit-follow.ts";
import { isBlockedOrMuted } from "../server/helpers/isModerated.ts";

const ALICE = "did:plc:alice";
const BOB = "did:plc:bob";
const FRED = "did:plc:fred"; // no profile record
const CAROL = "did:plc:carol"; // taken down
const DAVE = "did:plc:dave"; // Alice blocked him
const ERIN = "did:plc:erin"; // Alice muted her
const HANK = "did:plc:hank"; // wrote the comment others reply to
const ZARA = "did:plc:zara"; // badge arithmetic
const IVY = "did:plc:ivy";
const JUDY = "did:plc:judy";
const MORT = "did:plc:mort"; // taken down, favorited Zara's gallery
const NELL = "did:plc:nell"; // Zara blocked her, favorited Zara's gallery
const PAT = "did:plc:pat"; // turned favorite pushes off
const QUINN = "did:plc:quinn"; // only wants pushes from accounts she follows
const OTTO = "did:plc:otto"; // blocked Alice, rather than the other way round

const G1 = `at://${ALICE}/social.grain.gallery/g1`;
const S1 = `at://${ALICE}/social.grain.story/s1`;
const CM1 = `at://${HANK}/social.grain.comment/cm1`;
const GZ = `at://${ZARA}/social.grain.gallery/gz`;
const GP = `at://${PAT}/social.grain.gallery/gp`;
const GQ = `at://${QUINN}/social.grain.gallery/gq`;

const PROFILES: Record<string, string> = { [BOB]: "Bob Ross", [HANK]: "Hank Hill" };

const now = () => new Date().toISOString();
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

let server: any;

/** Stands in for the hydrate lookup, which the hooks use only for a name. */
const lookup = (async (_collection: string, _field: string, dids: string[]) => {
  const map = new Map<string, { value: { displayName: string } }>();
  for (const did of dids) {
    if (PROFILES[did]) map.set(did, { value: { displayName: PROFILES[did] } });
  }
  return map;
}) as any;

/** Run a hook against the real database and collect what it tried to push. */
async function fire(
  hook: { handler: (ctx: any) => Promise<void> },
  ctx: { repo: string; record: Record<string, unknown> | null; action?: "create" | "delete" },
) {
  const sent: any[] = [];
  await hook.handler({
    action: ctx.action ?? "create",
    collection: "test",
    record: ctx.record,
    repo: ctx.repo,
    uri: `at://${ctx.repo}/test/1`,
    db: server.db,
    lookup,
    push: { send: async (message: any) => void sent.push(message) },
  });
  return sent;
}

async function favorite(who: string, subject: string, createdAt: string, rkey: string) {
  await server.db.run(
    `INSERT INTO "social.grain.favorite" (uri, cid, did, indexed_at, created_at, subject)
     VALUES ($1, $2, $3, 'i', $4, $5)`,
    [`at://${who}/social.grain.favorite/${rkey}`, `cid-${rkey}`, who, createdAt, subject],
  );
}

beforeAll(async () => {
  server = await startTestServer();
  const { db } = server;

  await db.run(
    `CREATE TABLE IF NOT EXISTS _mutes (
       did TEXT NOT NULL, subject TEXT NOT NULL, created_at TEXT NOT NULL,
       PRIMARY KEY (did, subject)
     )`,
  );
  await db.run(
    `CREATE TABLE IF NOT EXISTS _preferences (
       did TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL,
       PRIMARY KEY (did, key)
     )`,
  );

  for (const [did, status] of [
    [ALICE, "active"],
    [BOB, "active"],
    [FRED, "active"],
    [CAROL, "takendown"],
    [DAVE, "active"],
    [ERIN, "active"],
    [HANK, "active"],
    [ZARA, "active"],
    [IVY, "active"],
    [JUDY, "active"],
    [MORT, "takendown"],
    [NELL, "active"],
    [PAT, "active"],
    [QUINN, "active"],
    [OTTO, "active"],
  ]) {
    await db.run(`INSERT INTO _repos (did, status, handle) VALUES ($1, $2, $3)`, [
      did,
      status,
      `${did.split(":").pop()}.test`,
    ]);
  }

  for (const [uri, did] of [
    [G1, ALICE],
    [GZ, ZARA],
    [GP, PAT],
    [GQ, QUINN],
  ]) {
    await db.run(
      `INSERT INTO "social.grain.gallery" (uri, cid, did, indexed_at, title, created_at)
       VALUES ($1, $2, $3, 'i', 'g', '2026-01-01')`,
      [uri, `cid-${uri}`, did],
    );
  }
  await db.run(
    `INSERT INTO "social.grain.story" (uri, cid, did, indexed_at, media, aspect_ratio, created_at)
     VALUES ($1, 'cid-s1', $2, 'i', $3, '{"width":3,"height":2}', '2026-01-01')`,
    [
      S1,
      ALICE,
      JSON.stringify({
        $type: "blob",
        ref: { $link: "bafy-s1" },
        mimeType: "image/jpeg",
        size: 1,
      }),
    ],
  );
  // Hank's comment on Alice's gallery — the thing replies reply to.
  await db.run(
    `INSERT INTO "social.grain.comment" (uri, cid, did, indexed_at, created_at, subject, text)
     VALUES ($1, 'cid-cm1', $2, 'i', '2026-01-01', $3, 'nice one')`,
    [CM1, HANK, G1],
  );

  // Alice blocked Dave and muted Erin.
  await db.run(
    `INSERT INTO "social.grain.graph.block" (uri, cid, did, indexed_at, subject, created_at)
     VALUES ($1, 'cid-bl', $2, 'i', $3, '2026-01-01')`,
    [`at://${ALICE}/social.grain.graph.block/dave`, ALICE, DAVE],
  );
  await db.run(`INSERT INTO _mutes (did, subject, created_at) VALUES ($1, $2, 'i')`, [ALICE, ERIN]);
  // Otto blocked Alice, so the block runs the other way from Dave's.
  await db.run(
    `INSERT INTO "social.grain.graph.block" (uri, cid, did, indexed_at, subject, created_at)
     VALUES ($1, 'cid-bl-o', $2, 'i', $3, '2026-01-01')`,
    [`at://${OTTO}/social.grain.graph.block/alice`, OTTO, ALICE],
  );

  // Zara's unseen pile: two that count, two that must not.
  await favorite(IVY, GZ, "2026-02-01", "z1");
  await favorite(JUDY, GZ, "2026-02-02", "z2");
  await favorite(MORT, GZ, "2026-02-03", "z3"); // taken down
  await favorite(NELL, GZ, "2026-02-04", "z4"); // Zara blocked her
  await db.run(
    `INSERT INTO "social.grain.graph.block" (uri, cid, did, indexed_at, subject, created_at)
     VALUES ($1, 'cid-bl-n', $2, 'i', $3, '2026-01-01')`,
    [`at://${ZARA}/social.grain.graph.block/nell`, ZARA, NELL],
  );

  // Pat turned favorite pushes off; Quinn only wants them from accounts she follows.
  await db.run(`INSERT INTO _preferences (did, key, value) VALUES ($1, $2, $3)`, [
    PAT,
    "notificationPrefs",
    JSON.stringify({ favorites: { push: false, inApp: true, from: "all" } }),
  ]);
  await db.run(`INSERT INTO _preferences (did, key, value) VALUES ($1, $2, $3)`, [
    QUINN,
    "notificationPrefs",
    JSON.stringify({
      favorites: { push: true, inApp: true, from: "follows" },
      follows: { push: true, inApp: true, from: "follows" },
    }),
  ]);
  await db.run(
    `INSERT INTO "social.grain.graph.follow" (uri, cid, did, indexed_at, subject, created_at)
     VALUES ($1, 'cid-fol', $2, 'i', $3, '2026-01-01')`,
    [`at://${QUINN}/social.grain.graph.follow/bob`, QUINN, BOB],
  );
});

afterAll(async () => await server?.close());

// isBlockedOrMuted gates every push the three hooks send, so it is worth
// testing on its own rather than only through them.
describe("isBlockedOrMuted", () => {
  test("returns an answer instead of throwing", async () => {
    // Regression: the three existence checks each carried their own LIMIT 1
    // before a UNION ALL, which SQLite rejects at parse time. Because
    // fireOnCommitHooks swallows a hook rejection into a log line, that threw
    // on every push path and silently turned off favorite, comment and follow
    // notifications entirely. A thrown error is a different failure from a
    // `true`, so assert the type, not just the value.
    await expect(isBlockedOrMuted(server.db, ALICE, BOB)).resolves.toBe(false);
  });

  test("is true when the recipient muted the actor", async () => {
    expect(await isBlockedOrMuted(server.db, ALICE, ERIN)).toBe(true);
  });

  test("is true when the recipient blocked the actor", async () => {
    expect(await isBlockedOrMuted(server.db, ALICE, DAVE)).toBe(true);
  });

  test("is true when the actor blocked the recipient", async () => {
    // Otto blocked Alice; Alice should still not hear from him.
    expect(await isBlockedOrMuted(server.db, ALICE, OTTO)).toBe(true);
  });

  test("is false between two unrelated accounts", async () => {
    expect(await isBlockedOrMuted(server.db, ALICE, HANK)).toBe(false);
  });
});

describe("on-commit-favorite", () => {
  const fav = (subject: string, repo = BOB, createdAt = now()) =>
    fire(favoriteHook, { repo, record: { subject, createdAt } });

  test("tells a gallery owner who favorited it", async () => {
    const [sent, ...rest] = await fav(G1);
    expect(rest).toEqual([]);
    expect(sent).toMatchObject({
      did: ALICE,
      title: "New favorite",
      body: "Bob Ross favorited your gallery",
      data: { type: "gallery-favorite", uri: G1 },
    });
  });

  test("tells a story owner", async () => {
    const [sent] = await fav(S1);
    expect(sent).toMatchObject({
      did: ALICE,
      body: "Bob Ross favorited your story",
      data: { type: "story-favorite", uri: S1 },
    });
  });

  test("tells a comment author", async () => {
    const [sent] = await fav(CM1);
    expect(sent).toMatchObject({
      did: HANK,
      body: "Bob Ross favorited your comment",
      data: { type: "comment-favorite", uri: CM1 },
    });
  });

  test("falls back to 'Someone' when the actor has no profile", async () => {
    const [sent] = await fav(G1, FRED);
    expect(sent.body).toBe("Someone favorited your gallery");
  });

  test("says nothing about favoriting your own gallery", async () => {
    expect(await fav(G1, ALICE)).toEqual([]);
  });

  test("ignores deletes", async () => {
    const sent = await fire(favoriteHook, {
      repo: BOB,
      record: { subject: G1, createdAt: now() },
      action: "delete",
    });
    expect(sent).toEqual([]);
  });

  test("ignores a favorite with no subject", async () => {
    expect(await fire(favoriteHook, { repo: BOB, record: { createdAt: now() } })).toEqual([]);
  });

  test("ignores a favorite of something that is not a gallery, story or comment", async () => {
    expect(await fav("at://did:plc:nobody/social.grain.gallery/gone")).toEqual([]);
  });

  describe("backfill suppression", () => {
    // Backfill replays a repo's whole history as fresh `create` events, so the
    // record's own timestamp is the only thing separating it from live traffic.
    test("stays quiet for a record older than an hour", async () => {
      expect(await fav(G1, BOB, minutesAgo(90))).toEqual([]);
    });

    test("still notifies for one just under the hour", async () => {
      expect(await fav(G1, BOB, minutesAgo(30))).toHaveLength(1);
    });

    test("treats a future timestamp as clock skew, not as stale", async () => {
      expect(await fav(G1, BOB, new Date(Date.now() + 60_000).toISOString())).toHaveLength(1);
    });

    test("fails closed on a record with no usable createdAt", async () => {
      expect(await fire(favoriteHook, { repo: BOB, record: { subject: G1 } })).toEqual([]);
      expect(
        await fire(favoriteHook, { repo: BOB, record: { subject: G1, createdAt: "not a date" } }),
      ).toEqual([]);
    });
  });

  describe("moderation", () => {
    test("a taken-down account cannot announce itself", async () => {
      expect(await fav(G1, CAROL)).toEqual([]);
    });

    test("someone the recipient blocked cannot announce themselves", async () => {
      expect(await fav(G1, DAVE)).toEqual([]);
    });

    test("someone the recipient muted cannot either", async () => {
      expect(await fav(G1, ERIN)).toEqual([]);
    });

    test("nor can someone who blocked the recipient", async () => {
      expect(await fav(G1, OTTO)).toEqual([]);
    });
  });

  describe("notification preferences", () => {
    test("respects favorites being switched off", async () => {
      expect(await fav(GP)).toEqual([]);
    });

    test("with from:follows, notifies only for accounts the recipient follows", async () => {
      expect(await fav(GQ, BOB)).toHaveLength(1); // Quinn follows Bob
      expect(await fav(GQ, FRED)).toEqual([]); // she does not follow Fred
    });

    test("defaults to notifying when the recipient has no preferences at all", async () => {
      expect(await fav(G1)).toHaveLength(1);
    });
  });

  describe("badge count", () => {
    test("is the unseen count plus this notification", async () => {
      // Zara has four favorites on her gallery, but Mort is taken down and she
      // blocked Nell, so only two of them count.
      const [sent] = await fav(GZ);
      expect(sent.badge).toBe(3);
    });

    test("counts only what arrived after the recipient last looked", async () => {
      await server.db.run(`INSERT INTO _preferences (did, key, value) VALUES ($1, $2, $3)`, [
        ZARA,
        "lastSeenNotifications",
        JSON.stringify("2026-02-01T12:00:00Z"),
      ]);
      const [sent] = await fav(GZ);
      expect(sent.badge).toBe(2); // Ivy's 2026-02-01 favorite now predates the mark
      await server.db.run(`DELETE FROM _preferences WHERE did = $1 AND key = $2`, [
        ZARA,
        "lastSeenNotifications",
      ]);
    });
  });
});

describe("on-commit-comment", () => {
  test("tells a gallery owner about a comment", async () => {
    const [sent, ...rest] = await fire(commentHook, {
      repo: BOB,
      record: { subject: G1, createdAt: now(), text: "hi" },
    });
    expect(rest).toEqual([]);
    expect(sent).toMatchObject({
      did: ALICE,
      title: "New comment",
      body: "Bob Ross commented on your gallery",
      data: { type: "gallery-comment", uri: G1 },
    });
  });

  test("tells a story owner about a comment", async () => {
    const [sent] = await fire(commentHook, {
      repo: BOB,
      record: { subject: S1, createdAt: now(), text: "hi" },
    });
    expect(sent).toMatchObject({
      did: ALICE,
      body: "Bob Ross commented on your story",
      data: { type: "story-comment", uri: S1 },
    });
  });

  test("a reply notifies both the parent author and the gallery owner", async () => {
    // Hank wrote the parent comment, Alice owns the gallery it sits on, so one
    // reply is news to two different people.
    const sent = await fire(commentHook, {
      repo: BOB,
      record: { subject: G1, replyTo: CM1, createdAt: now(), text: "hi" },
    });
    expect(sent.map((s) => [s.did, s.title])).toEqual([
      [HANK, "New reply"],
      [ALICE, "New comment"],
    ]);
  });

  test("says nothing about replying to yourself", async () => {
    const sent = await fire(commentHook, {
      repo: HANK,
      record: { subject: G1, replyTo: CM1, createdAt: now(), text: "hi" },
    });
    // Hank replying to Hank is not news, but Alice still owns the gallery.
    expect(sent.map((s) => s.did)).toEqual([ALICE]);
  });

  test("a taken-down account cannot announce itself", async () => {
    expect(
      await fire(commentHook, { repo: CAROL, record: { subject: G1, createdAt: now() } }),
    ).toEqual([]);
  });

  test("stays quiet for a backfilled comment", async () => {
    expect(
      await fire(commentHook, { repo: BOB, record: { subject: G1, createdAt: minutesAgo(90) } }),
    ).toEqual([]);
  });
});

describe("on-commit-follow", () => {
  const follow = (subject: string, repo = BOB, createdAt = now()) =>
    fire(followHook, { repo, record: { subject, createdAt } });

  test("tells the followed account who followed them", async () => {
    const [sent] = await follow(ALICE);
    expect(sent).toMatchObject({
      did: ALICE,
      title: "New follower",
      body: "Bob Ross followed you",
      data: { type: "follow", did: BOB },
    });
  });

  test("ignores a self-follow", async () => {
    expect(await follow(BOB, BOB)).toEqual([]);
  });

  test("a taken-down account cannot announce itself", async () => {
    expect(await follow(ALICE, CAROL)).toEqual([]);
  });

  test("someone the recipient blocked or muted cannot either", async () => {
    expect(await follow(ALICE, DAVE)).toEqual([]);
    expect(await follow(ALICE, ERIN)).toEqual([]);
  });

  test("stays quiet for a backfilled follow", async () => {
    expect(await follow(ALICE, BOB, minutesAgo(90))).toEqual([]);
  });

  test("respects a from:follows preference", async () => {
    expect(await follow(QUINN, BOB)).toHaveLength(1); // Quinn follows Bob back
    expect(await follow(QUINN, FRED)).toEqual([]);
  });
});
