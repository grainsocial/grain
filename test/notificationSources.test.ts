// getNotifications is a UNION ALL over nine sources, each mapped to a reason
// and hydrated differently. `test/notifications.test.ts` covers the moderation
// filtering with a deliberately small fixture; this file covers the sources
// themselves, the preference filters and the paging, and needs a much larger
// one — hence the separate file rather than a second fixture in that one.

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startTestServer } from "@hatk/hatk/test";

const ALICE = "did:plc:alice"; // the viewer
const BOB = "did:plc:bob";
const CAROL = "did:plc:carol";
const ERIN = "did:plc:erin"; // no profile record

const GA = `at://${ALICE}/social.grain.gallery/ga`; // Alice's gallery
const SA = `at://${ALICE}/social.grain.story/sa`; // Alice's story
const GB = `at://${BOB}/social.grain.gallery/gb`; // Bob's gallery
const GM = `at://${BOB}/social.grain.gallery/gm`; // Bob's gallery, mentioning Alice
const CA = `at://${ALICE}/social.grain.comment/ca`; // Alice's comment, on Bob's gallery
const CC = `at://${CAROL}/social.grain.comment/cc`; // Carol's comment, on Bob's gallery

/** A facets blob mentioning `did`, in the shape getReason looks for. */
const mentions = (did: string) =>
  JSON.stringify([
    {
      index: { byteStart: 0, byteEnd: 6 },
      features: [{ $type: "app.bsky.richtext.facet#mention", did }],
    },
  ]);

let server: any;

async function get(query = "", as: string = ALICE) {
  const res = await server.fetchAs(as, `/xrpc/social.grain.unspecced.getNotifications${query}`);
  expect(res.status).toBe(200);
  return res.json();
}

const reasons = (notifications: any[]) => notifications.map((n) => n.reason);
const byReason = (notifications: any[], reason: string) =>
  notifications.find((n) => n.reason === reason);

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

  for (const [did, handle] of [
    [ALICE, "alice.test"],
    [BOB, "bob.test"],
    [CAROL, "carol.test"],
    [ERIN, "erin.test"],
  ]) {
    await db.run(`INSERT INTO _repos (did, status, handle) VALUES ($1, 'active', $2)`, [
      did,
      handle,
    ]);
  }
  // Erin has no profile record, so she exercises the handle fallback.
  for (const [did, name] of [
    [ALICE, "Alice A"],
    [BOB, "Bob Ross"],
    [CAROL, "Carol C"],
  ]) {
    await db.run(
      `INSERT INTO "social.grain.actor.profile" (uri, cid, did, indexed_at, display_name, created_at)
       VALUES ($1, $2, $3, 'i', $4, '2026-01-01')`,
      [`at://${did}/social.grain.actor.profile/self`, `cid-p-${did}`, did, name],
    );
  }

  const gallery = async (uri: string, did: string, title: string, extra = {}) => {
    const e = extra as { description?: string; facets?: string };
    await db.run(
      `INSERT INTO "social.grain.gallery" (uri, cid, did, indexed_at, title, description, facets, created_at)
       VALUES ($1, $2, $3, 'i', $4, $5, $6, '2026-05-01')`,
      [uri, `cid-${uri}`, did, title, e.description ?? null, e.facets ?? null],
    );
  };
  await gallery(GA, ALICE, "Alice's gallery");
  await gallery(GB, BOB, "Bob's gallery");
  // A gallery whose description mentions Alice.
  await gallery(GM, BOB, "Bob's other gallery", {
    description: "@alice look at this",
    facets: mentions(ALICE),
  });

  // Two photos on Alice's gallery, inserted out of order so the thumbnail has
  // to come from position 0 rather than from insert order.
  for (const [id, position] of [
    ["p-second", 1],
    ["p-first", 0],
  ] as [string, number][]) {
    const photoUri = `at://${ALICE}/social.grain.photo/${id}`;
    await db.run(
      `INSERT INTO "social.grain.photo" (uri, cid, did, indexed_at, photo, aspect_ratio, created_at)
       VALUES ($1, $2, $3, 'i', $4, '{"width":3,"height":2}', '2026-05-01')`,
      [
        photoUri,
        `cid-${id}`,
        ALICE,
        JSON.stringify({
          $type: "blob",
          ref: { $link: `bafy-${id}` },
          mimeType: "image/jpeg",
          size: 1,
        }),
      ],
    );
    await db.run(
      `INSERT INTO "social.grain.gallery.item" (uri, cid, did, indexed_at, created_at, gallery, item, position)
       VALUES ($1, $2, $3, 'i', '2026-05-01', $4, $5, $6)`,
      [
        `at://${ALICE}/social.grain.gallery.item/${id}`,
        `cid-i-${id}`,
        ALICE,
        GA,
        photoUri,
        position,
      ],
    );
  }

  await db.run(
    `INSERT INTO "social.grain.story" (uri, cid, did, indexed_at, media, aspect_ratio, created_at)
     VALUES ($1, 'cid-sa', $2, 'i', $3, '{"width":9,"height":16}', '2026-05-01')`,
    [
      SA,
      ALICE,
      JSON.stringify({
        $type: "blob",
        ref: { $link: "bafy-sa" },
        mimeType: "image/jpeg",
        size: 1,
      }),
    ],
  );

  const comment = async (
    uri: string,
    did: string,
    subject: string,
    text: string,
    createdAt: string,
    extra: { replyTo?: string; facets?: string } = {},
  ) => {
    await db.run(
      `INSERT INTO "social.grain.comment" (uri, cid, did, indexed_at, created_at, subject, text, reply_to, facets)
       VALUES ($1, $2, $3, 'i', $4, $5, $6, $7, $8)`,
      [
        uri,
        `cid-${uri}`,
        did,
        createdAt,
        subject,
        text,
        extra.replyTo ?? null,
        extra.facets ?? null,
      ],
    );
  };
  const favorite = async (rkey: string, did: string, subject: string, createdAt: string) => {
    await db.run(
      `INSERT INTO "social.grain.favorite" (uri, cid, did, indexed_at, created_at, subject)
       VALUES ($1, $2, $3, 'i', $4, $5)`,
      [`at://${did}/social.grain.favorite/${rkey}`, `cid-${rkey}`, did, createdAt, subject],
    );
  };

  // Alice's own comment on Bob's gallery, and Carol's alongside it.
  await comment(CA, ALICE, GB, "alice's comment", "2026-05-02");
  await comment(CC, CAROL, GB, "carol's comment", "2026-05-03");

  // One event per source, oldest first.
  await db.run(
    `INSERT INTO "social.grain.graph.follow" (uri, cid, did, indexed_at, subject, created_at)
     VALUES ($1, 'cid-fol', $2, 'i', $3, '2026-06-01')`,
    [`at://${BOB}/social.grain.graph.follow/alice`, BOB, ALICE],
  );
  await favorite("f-ga", BOB, GA, "2026-06-02");
  await comment(`at://${BOB}/social.grain.comment/c1`, BOB, GA, "nice gallery", "2026-06-03");
  await comment(`at://${BOB}/social.grain.comment/c2`, BOB, GB, "replying to you", "2026-06-04", {
    replyTo: CA,
  });
  await favorite("f-sa", BOB, SA, "2026-06-05");
  await comment(`at://${BOB}/social.grain.comment/c4`, BOB, SA, "nice story", "2026-06-06");
  await favorite("f-ca", BOB, CA, "2026-06-07");
  // A mention inside a reply to someone else's comment.
  await comment(`at://${BOB}/social.grain.comment/c3`, BOB, GB, "@alice see this", "2026-06-08", {
    replyTo: CC,
    facets: mentions(ALICE),
  });
  // A top-level mention on Bob's gallery — no reply_to at all.
  await comment(`at://${BOB}/social.grain.comment/c6`, BOB, GB, "@alice top level", "2026-05-05", {
    facets: mentions(ALICE),
  });
  // A plain comment on Alice's own gallery that also mentions her — the source
  // is "comment", and only the facets promote it to a mention.
  await comment(`at://${BOB}/social.grain.comment/c5`, BOB, GA, "@alice yours", "2026-06-10", {
    facets: mentions(ALICE),
  });
  // Erin follows Alice last, and has no profile.
  await db.run(
    `INSERT INTO "social.grain.graph.follow" (uri, cid, did, indexed_at, subject, created_at)
     VALUES ($1, 'cid-fol-e', $2, 'i', $3, '2026-06-11')`,
    [`at://${ERIN}/social.grain.graph.follow/alice`, ERIN, ALICE],
  );
});

afterAll(async () => await server?.close());

describe("notification sources", () => {
  test("reports every kind of activity on the viewer's content", async () => {
    const { notifications } = await get("?limit=50");
    expect(new Set(reasons(notifications))).toEqual(
      new Set([
        "follow",
        "gallery-favorite",
        "gallery-comment",
        "reply",
        "story-favorite",
        "story-comment",
        "comment-favorite",
        "gallery-comment-mention",
        "gallery-mention",
      ]),
    );
  });

  test("orders them newest first", async () => {
    const { notifications } = await get("?limit=50");
    const times = notifications.map((n: any) => n.createdAt);
    expect([...times].sort().reverse()).toEqual(times);
  });

  test("a favorite on a gallery carries the gallery's title and cover", async () => {
    const n = byReason((await get("?limit=50")).notifications, "gallery-favorite");
    expect(n.galleryUri).toBe(GA);
    expect(n.galleryTitle).toBe("Alice's gallery");
    // The cover is the photo at position 0, which was inserted second.
    expect(n.galleryThumb).toContain("bafy-p-first");
  });

  test("a comment carries its text", async () => {
    const n = byReason((await get("?limit=50")).notifications, "gallery-comment");
    expect(n.commentText).toBe("nice gallery");
    expect(n.galleryUri).toBe(GA);
  });

  test("a reply carries both its own text and the comment it answers", async () => {
    const n = byReason((await get("?limit=50")).notifications, "reply");
    expect(n.commentText).toBe("replying to you");
    expect(n.replyToText).toBe("alice's comment");
  });

  test("a story favorite and comment carry the story and its thumbnail", async () => {
    const { notifications } = await get("?limit=50");
    for (const reason of ["story-favorite", "story-comment"]) {
      const n = byReason(notifications, reason);
      expect(n.storyUri).toBe(SA);
      expect(n.storyThumb).toContain("bafy-sa");
      expect(n.galleryUri).toBeUndefined();
    }
  });

  test("a favorite on a comment resolves through to the gallery it sits on", async () => {
    // The favorited record is Alice's comment; what she needs to see is which
    // gallery that conversation is on, and what she said.
    const n = byReason((await get("?limit=50")).notifications, "comment-favorite");
    expect(n.commentText).toBe("alice's comment");
    expect(n.galleryUri).toBe(GB);
    expect(n.galleryTitle).toBe("Bob's gallery");
  });

  test("a gallery whose description mentions the viewer", async () => {
    const n = byReason((await get("?limit=50")).notifications, "gallery-mention");
    expect(n.galleryUri).toBe(GM);
    expect(n.commentText).toBe("@alice look at this");
  });

  test("a top-level comment mentioning the viewer notifies them", async () => {
    // Regression: the mention source excluded replies to the viewer's own
    // comments with `reply_to NOT IN (...)`, which is NULL — and therefore
    // false — for a top-level comment. It only worked while the viewer had
    // never commented and the subquery was empty, so mentions went silent for
    // everyone the moment they posted their first comment. Alice has a comment
    // in this fixture, which is what makes this test meaningful.
    const { notifications } = await get("?limit=50");
    const top = notifications.find((n: any) => n.commentText === "@alice top level");
    expect(top).toBeDefined();
    expect(top.reason).toBe("gallery-comment-mention");
  });

  test("a comment on the viewer's own gallery is promoted to a mention by its facets", async () => {
    // Source is "comment", not "comment-mention" — the gallery is Alice's, so
    // the mention source excludes it and only getReason's facet check catches it.
    const { notifications } = await get("?limit=50");
    const mention = notifications.find(
      (n: any) => n.reason === "gallery-comment-mention" && n.commentText === "@alice yours",
    );
    expect(mention).toBeDefined();
    expect(mention.galleryUri).toBe(GA);
  });

  test("hydrates the author, falling back to the handle without a profile", async () => {
    const { notifications } = await get("?limit=50");
    const fromBob = notifications.find((n: any) => n.author.did === BOB);
    expect(fromBob.author).toMatchObject({ handle: "bob.test", displayName: "Bob Ross" });

    const fromErin = notifications.find((n: any) => n.author.did === ERIN);
    expect(fromErin.author.handle).toBe("erin.test");
    expect(fromErin.author.displayName).toBeUndefined();
  });

  test("never reports the viewer's own activity", async () => {
    const { notifications } = await get("?limit=50");
    expect(notifications.map((n: any) => n.author.did)).not.toContain(ALICE);
  });
});

describe("unseen count", () => {
  test("counts everything when the viewer has never looked", async () => {
    const { notifications, unseenCount } = await get("?limit=50");
    expect(unseenCount).toBe(notifications.length);
  });

  test("counts only what arrived after the last look", async () => {
    await server.db.run(`INSERT INTO _preferences (did, key, value) VALUES ($1, $2, $3)`, [
      ALICE,
      "lastSeenNotifications",
      JSON.stringify("2026-06-06T00:00:00Z"),
    ]);
    try {
      const { unseenCount } = await get("?limit=50");
      // f-ca, c3, c5 and Erin's follow postdate the mark; the gallery mention
      // is dated with its gallery, in May.
      expect(unseenCount).toBe(4);
    } finally {
      await server.db.run(`DELETE FROM _preferences WHERE did = $1 AND key = $2`, [
        ALICE,
        "lastSeenNotifications",
      ]);
    }
  });

  test("countOnly returns the number without the list", async () => {
    const { notifications, unseenCount } = await get("?countOnly=true&limit=50");
    expect(notifications).toEqual([]);
    expect(unseenCount).toBeGreaterThan(0);
  });
});

describe("notification preferences", () => {
  async function withPrefs(prefs: unknown, fn: () => Promise<void>) {
    await server.db.run(
      `INSERT INTO _preferences (did, key, value) VALUES ($1, 'notificationPrefs', $2)`,
      [ALICE, JSON.stringify(prefs)],
    );
    try {
      await fn();
    } finally {
      await server.db.run(`DELETE FROM _preferences WHERE did = $1 AND key = $2`, [
        ALICE,
        "notificationPrefs",
      ]);
    }
  }

  test("drops a category the viewer turned off in-app", async () => {
    await withPrefs({ favorites: { push: true, inApp: false, from: "all" } }, async () => {
      const { notifications } = await get("?limit=50");
      expect(reasons(notifications)).not.toContain("gallery-favorite");
      expect(reasons(notifications)).not.toContain("story-favorite");
      expect(reasons(notifications)).not.toContain("comment-favorite");
      // Other categories are untouched.
      expect(reasons(notifications)).toContain("follow");
    });
  });

  test("leaves a category alone when only push is off", async () => {
    await withPrefs({ favorites: { push: false, inApp: true, from: "all" } }, async () => {
      expect(reasons((await get("?limit=50")).notifications)).toContain("gallery-favorite");
    });
  });

  test("with from:follows, keeps only activity from accounts the viewer follows", async () => {
    // Alice follows nobody, so a follows-only category empties out.
    await withPrefs({ follows: { push: true, inApp: true, from: "follows" } }, async () => {
      expect(reasons((await get("?limit=50")).notifications)).not.toContain("follow");
    });

    await server.db.run(
      `INSERT INTO "social.grain.graph.follow" (uri, cid, did, indexed_at, subject, created_at)
       VALUES ($1, 'cid-af', $2, 'i', $3, '2026-05-01')`,
      [`at://${ALICE}/social.grain.graph.follow/bob`, ALICE, BOB],
    );
    try {
      await withPrefs({ follows: { push: true, inApp: true, from: "follows" } }, async () => {
        const { notifications } = await get("?limit=50");
        const follows = notifications.filter((n: any) => n.reason === "follow");
        // Bob's follow survives, Erin's does not.
        expect(follows.map((n: any) => n.author.did)).toEqual([BOB]);
      });
    } finally {
      await server.db.run(`DELETE FROM "social.grain.graph.follow" WHERE did = $1`, [ALICE]);
    }
  });

  test("keeps everything when a category has no preference set", async () => {
    await withPrefs({ comments: { push: true, inApp: false, from: "all" } }, async () => {
      expect(reasons((await get("?limit=50")).notifications)).toContain("follow");
    });
  });
});

describe("paging", () => {
  test("pages newest first with a created_at cursor", async () => {
    const first = await get("?limit=3");
    expect(first.notifications).toHaveLength(3);
    expect(first.cursor).toBeTruthy();

    const second = await get(`?limit=3&cursor=${encodeURIComponent(first.cursor)}`);
    const firstTimes = first.notifications.map((n: any) => n.createdAt);
    const secondTimes = second.notifications.map((n: any) => n.createdAt);
    expect(Math.max(...secondTimes.map(Date.parse))).toBeLessThan(
      Math.min(...firstTimes.map(Date.parse)),
    );
  });

  test("stops offering a cursor on the last page", async () => {
    const { notifications, cursor } = await get("?limit=50");
    expect(notifications.length).toBeGreaterThan(0);
    expect(cursor).toBeUndefined();
  });

  test("requires a session", async () => {
    const res = await server.fetch("/xrpc/social.grain.unspecced.getNotifications");
    expect(res.status).toBe(400);
  });
});
