// The story surface: getStories (the last 24 hours), getStoryArchive (all of
// them, paged), getStoryAuthors (who has one right now), getStory (a single
// one by uri or handle), and the hydrator all but the last share.
//
// Stories expire after 24 hours, so the fixture is dated relative to now.

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startTestServer } from "@hatk/hatk/test";

const ALICE = "did:plc:alice";
const BOB = "did:plc:bob";
const CAROL = "did:plc:carol"; // taken down
const DAVE = "did:plc:dave"; // Alice blocked him
const ERIN = "did:plc:erin"; // no profile record, only a handle

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

const PDX = "8a28f002358ffff";

let server: any;

async function story(opts: {
  id: string;
  did: string;
  ageHours: number;
  location?: { name: string; value: string } | null;
  address?: { locality?: string; region?: string; country?: string } | null;
  badAspect?: boolean;
  selfLabel?: string;
}) {
  const { db } = server;
  const at = hoursAgo(opts.ageHours);
  const uri = `at://${opts.did}/social.grain.story/${opts.id}`;
  await db.run(
    `INSERT INTO "social.grain.story" (uri, cid, did, indexed_at, media, aspect_ratio, location, address, created_at)
     VALUES ($1, $2, $3, 'i', $4, $5, $6, $7, $8)`,
    [
      uri,
      `cid-${opts.id}`,
      opts.did,
      JSON.stringify({
        $type: "blob",
        ref: { $link: `bafy-${opts.id}` },
        mimeType: "image/jpeg",
        size: 1,
      }),
      opts.badAspect ? "{oops" : '{"width":9,"height":16}',
      opts.location ? JSON.stringify(opts.location) : null,
      opts.address ? JSON.stringify(opts.address) : null,
      at,
    ],
  );
  if (opts.selfLabel) {
    await db.run(
      `INSERT INTO "social.grain.story__labels_self_labels" (parent_uri, parent_did, val)
       VALUES ($1, $2, $3)`,
      [uri, opts.did, opts.selfLabel],
    );
  }
  return uri;
}

async function get(path: string, as?: string) {
  const res = as ? await server.fetchAs(as, path) : await server.fetch(path);
  expect(res.status).toBe(200);
  return res.json();
}

/** For the cases where the interesting part is the status code. */
const status = async (path: string) => (await server.fetch(path)).status;

async function post(nsid: string, body: unknown, as?: string) {
  const path = `/xrpc/${nsid}`;
  const init = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
  return as ? server.fetchAs(as, path, init) : server.fetch(path, init);
}

const storyUri = (did: string, id: string) => `at://${did}/social.grain.story/${id}`;

const ids = (stories: any[]) => stories.map((s) => s.uri.split("/").pop());

beforeAll(async () => {
  server = await startTestServer();
  const { db } = server;

  await db.run(
    `CREATE TABLE IF NOT EXISTS _mutes (
       did TEXT NOT NULL, subject TEXT NOT NULL, created_at TEXT NOT NULL,
       PRIMARY KEY (did, subject)
     )`,
  );
  // Setup scripts do not run under the test server, so the private tables
  // the story handlers read are created here, as _mutes is above.
  await db.run(
    `CREATE TABLE IF NOT EXISTS _story_views (
       did TEXT NOT NULL, subject TEXT NOT NULL, created_at TEXT NOT NULL,
       PRIMARY KEY (did, subject)
     )`,
  );

  for (const [did, handle, status] of [
    [ALICE, "alice.test", "active"],
    [BOB, "bob.test", "active"],
    [CAROL, "carol.test", "takendown"],
    [DAVE, "dave.test", "active"],
    [ERIN, "erin.test", "active"],
  ]) {
    await db.run(`INSERT INTO _repos (did, status, handle) VALUES ($1, $2, $3)`, [
      did,
      status,
      handle,
    ]);
  }

  // Everyone but Erin has a profile, so Erin exercises the handle fallback.
  for (const [did, name] of [
    [ALICE, "Alice A"],
    [BOB, "Bob Ross"],
    [DAVE, "Dave D"],
  ]) {
    await db.run(
      `INSERT INTO "social.grain.actor.profile" (uri, cid, did, indexed_at, display_name, created_at)
       VALUES ($1, $2, $3, 'i', $4, '2026-01-01')`,
      [`at://${did}/social.grain.actor.profile/self`, `cid-p-${did}`, did, name],
    );
  }

  // Alice: three live, one expired, one hidden by a self-label.
  await story({ id: "a1", did: ALICE, ageHours: 1 });
  await story({
    id: "a2",
    did: ALICE,
    ageHours: 3,
    location: { name: "Portland", value: PDX },
    address: { locality: "Portland", region: "Oregon", country: "US" },
  });
  await story({ id: "a3", did: ALICE, ageHours: 5 });
  await story({ id: "a-old", did: ALICE, ageHours: 30 });
  await story({ id: "a-hidden", did: ALICE, ageHours: 2, selfLabel: "spam" });
  // An aspect ratio that is not valid JSON — the hydrator falls back.
  await story({ id: "a-bad", did: ALICE, ageHours: 4, badAspect: true });

  await story({ id: "b1", did: BOB, ageHours: 2 });
  await story({ id: "c1", did: CAROL, ageHours: 2 }); // taken down
  await story({ id: "d1", did: DAVE, ageHours: 4 }); // Alice blocked him
  await story({ id: "e1", did: ERIN, ageHours: 6 }); // no profile

  await db.run(
    `INSERT INTO "social.grain.graph.block" (uri, cid, did, indexed_at, subject, created_at)
     VALUES ($1, 'cid-bl', $2, 'i', $3, '2026-01-01')`,
    [`at://${ALICE}/social.grain.graph.block/dave`, ALICE, DAVE],
  );

  // Bob favorited and commented on Alice's a1.
  const a1 = `at://${ALICE}/social.grain.story/a1`;
  await db.run(
    `INSERT INTO "social.grain.favorite" (uri, cid, did, indexed_at, created_at, subject)
     VALUES ($1, 'cid-fav', $2, 'i', $3, $4)`,
    [`at://${BOB}/social.grain.favorite/f1`, BOB, hoursAgo(1), a1],
  );
  for (const [rkey, who] of [
    ["cm1", BOB],
    ["cm2", ALICE],
  ]) {
    await db.run(
      `INSERT INTO "social.grain.comment" (uri, cid, did, indexed_at, created_at, subject, text)
       VALUES ($1, $2, $3, 'i', $4, $5, 'nice')`,
      [`at://${who}/social.grain.comment/${rkey}`, `cid-${rkey}`, who, hoursAgo(1), a1],
    );
  }

  // Alice cross-posted a2 to Bluesky; the hydrator finds it by the link text.
  await db.run(
    `INSERT INTO "app.bsky.feed.post" (uri, cid, did, indexed_at, text, created_at)
     VALUES ($1, 'cid-post', $2, 'i', $3, '2026-01-01')`,
    [
      `at://${ALICE}/app.bsky.feed.post/post1`,
      ALICE,
      `look at this https://grain.social/profile/${ALICE}/story/a2`,
    ],
  );
});

afterAll(async () => await server?.close());

describe("getStories", () => {
  test("returns an actor's last 24 hours, oldest first", async () => {
    // Oldest first is deliberate: a story ring plays forward in time.
    const { stories } = await get(`/xrpc/social.grain.unspecced.getStories?actor=${ALICE}`);
    expect(ids(stories)).toEqual(["a3", "a-bad", "a2", "a1"]);
  });

  test("drops a story older than 24 hours", async () => {
    const { stories } = await get(`/xrpc/social.grain.unspecced.getStories?actor=${ALICE}`);
    expect(ids(stories)).not.toContain("a-old");
  });

  test("drops a story its author labelled with a hide value", async () => {
    const { stories } = await get(`/xrpc/social.grain.unspecced.getStories?actor=${ALICE}`);
    expect(ids(stories)).not.toContain("a-hidden");
  });

  test("returns nothing for a taken-down author", async () => {
    const { stories } = await get(`/xrpc/social.grain.unspecced.getStories?actor=${CAROL}`);
    expect(stories).toEqual([]);
  });

  test("rejects a request with no actor", async () => {
    // `actor` is required by the lexicon, so this is refused before the
    // handler runs — its own `if (!actor)` guard is unreachable.
    expect(await status("/xrpc/social.grain.unspecced.getStories")).toBe(400);
  });

  test("attaches the author's profile to every story", async () => {
    const { stories } = await get(`/xrpc/social.grain.unspecced.getStories?actor=${ALICE}`);
    for (const s of stories) {
      expect(s.creator).toMatchObject({ did: ALICE, handle: "alice.test", displayName: "Alice A" });
    }
  });

  test("falls back to the handle when the author has no profile record", async () => {
    const { stories } = await get(`/xrpc/social.grain.unspecced.getStories?actor=${ERIN}`);
    expect(stories[0].creator).toMatchObject({ did: ERIN, handle: "erin.test" });
    expect(stories[0].creator.displayName).toBeUndefined();
  });

  test("counts comments and marks nothing expired inside the window", async () => {
    const { stories } = await get(`/xrpc/social.grain.unspecced.getStories?actor=${ALICE}`);
    const a1 = stories.find((s: any) => s.uri.endsWith("/a1"));
    expect(a1.commentCount).toBe(2);
    expect(a1.expired).toBe(false);
  });

  test("formats a stored location for display", async () => {
    const { stories } = await get(`/xrpc/social.grain.unspecced.getStories?actor=${ALICE}`);
    const a2 = stories.find((s: any) => s.uri.endsWith("/a2"));
    expect(a2.location).toEqual({ name: "Portland", value: PDX });
    expect(a2.address).toMatchObject({ locality: "Portland", region: "Oregon", country: "US" });
    expect(a2.locationDisplay).toBe("Portland, Oregon, US");
  });

  test("links a story back to the Bluesky post that cross-posted it", async () => {
    const { stories } = await get(`/xrpc/social.grain.unspecced.getStories?actor=${ALICE}`);
    const a2 = stories.find((s: any) => s.uri.endsWith("/a2"));
    expect(a2.crossPost).toEqual({
      url: `https://bsky.app/profile/${ALICE}/post/post1`,
    });
    const a1 = stories.find((s: any) => s.uri.endsWith("/a1"));
    expect(a1.crossPost).toBeUndefined();
  });

  test("falls back to 4:3 when the stored aspect ratio is not valid JSON", async () => {
    const { stories } = await get(`/xrpc/social.grain.unspecced.getStories?actor=${ALICE}`);
    const bad = stories.find((s: any) => s.uri.endsWith("/a-bad"));
    expect(bad).toBeDefined();
    expect(bad.aspectRatio).toEqual({ width: 4, height: 3 });
  });

  test("marks the viewer's own favorite", async () => {
    const anon = await get(`/xrpc/social.grain.unspecced.getStories?actor=${ALICE}`);
    expect(anon.stories.find((s: any) => s.uri.endsWith("/a1")).viewer).toBeUndefined();

    const seen = await get(`/xrpc/social.grain.unspecced.getStories?actor=${ALICE}`, BOB);
    const a1 = seen.stories.find((s: any) => s.uri.endsWith("/a1"));
    expect(a1.viewer.fav).toBe(`at://${BOB}/social.grain.favorite/f1`);
    // Alice did not favorite it, so hers stays bare.
    const mine = await get(`/xrpc/social.grain.unspecced.getStories?actor=${ALICE}`, ALICE);
    expect(mine.stories.find((s: any) => s.uri.endsWith("/a1")).viewer).toBeUndefined();
  });
});

describe("getStoryArchive", () => {
  test("returns every story newest first, expiry included", async () => {
    const { stories } = await get(`/xrpc/social.grain.unspecced.getStoryArchive?actor=${ALICE}`);
    expect(ids(stories)).toEqual(["a1", "a2", "a-bad", "a3", "a-old"]);
  });

  test("marks an expired story expired", async () => {
    const { stories } = await get(`/xrpc/social.grain.unspecced.getStoryArchive?actor=${ALICE}`);
    const byId = Object.fromEntries(stories.map((s: any) => [s.uri.split("/").pop(), s]));
    expect(byId["a-old"].expired).toBe(true);
    expect(byId["a1"].expired).toBe(false);
  });

  test("pages with a created_at cursor", async () => {
    // A page can come back shorter than the limit. The LIMIT is applied in
    // SQL, but hidden stories are filtered afterwards in the hydrator, so a
    // labelled story still consumes a slot on its page. a-hidden is the second
    // newest, so the first page of two yields one story. A client has to page
    // until the cursor is gone rather than until a page looks short.
    const first = await get(`/xrpc/social.grain.unspecced.getStoryArchive?actor=${ALICE}&limit=2`);
    expect(ids(first.stories)).toEqual(["a1"]);
    expect(first.cursor).toBeTruthy();

    const second = await get(
      `/xrpc/social.grain.unspecced.getStoryArchive?actor=${ALICE}&limit=2&cursor=${encodeURIComponent(first.cursor)}`,
    );
    expect(ids(second.stories)).toEqual(["a2", "a-bad"]);

    const third = await get(
      `/xrpc/social.grain.unspecced.getStoryArchive?actor=${ALICE}&limit=2&cursor=${encodeURIComponent(second.cursor)}`,
    );
    expect(ids(third.stories)).toEqual(["a3", "a-old"]);
    expect(third.cursor).toBeUndefined();
  });

  test("still hides a self-labelled story", async () => {
    const { stories } = await get(`/xrpc/social.grain.unspecced.getStoryArchive?actor=${ALICE}`);
    expect(ids(stories)).not.toContain("a-hidden");
  });

  test("returns nothing for a taken-down author, and rejects a missing actor", async () => {
    expect(
      (await get(`/xrpc/social.grain.unspecced.getStoryArchive?actor=${CAROL}`)).stories,
    ).toEqual([]);
    expect(await status("/xrpc/social.grain.unspecced.getStoryArchive")).toBe(400);
  });
});

describe("getStoryAuthors", () => {
  test("lists who has a live story, most recent first", async () => {
    const { authors } = await get("/xrpc/social.grain.unspecced.getStoryAuthors");
    expect(authors.map((a: any) => a.profile.did)).toEqual([ALICE, BOB, DAVE, ERIN]);
  });

  test("counts each author's live stories, ignoring expired and hidden ones", async () => {
    const { authors } = await get("/xrpc/social.grain.unspecced.getStoryAuthors");
    const alice = authors.find((a: any) => a.profile.did === ALICE);
    // a1, a2, a3 and a-bad: what getStories serves. a-old is outside the
    // window and a-hidden is self-labelled spam, which getStories drops, so
    // the count agrees with what the viewer will actually show.
    expect(alice.storyCount).toBe(4);
  });

  test("omits taken-down authors", async () => {
    const { authors } = await get("/xrpc/social.grain.unspecced.getStoryAuthors");
    expect(authors.map((a: any) => a.profile.did)).not.toContain(CAROL);
  });

  test("omits authors the viewer blocked", async () => {
    const { authors } = await get("/xrpc/social.grain.unspecced.getStoryAuthors", ALICE);
    expect(authors.map((a: any) => a.profile.did)).not.toContain(DAVE);
  });

  test("falls back to the handle for an author with no profile", async () => {
    const { authors } = await get("/xrpc/social.grain.unspecced.getStoryAuthors");
    const erin = authors.find((a: any) => a.profile.did === ERIN);
    expect(erin.profile).toMatchObject({ did: ERIN, handle: "erin.test", cid: "" });
  });
});

describe("getStory", () => {
  test("returns one story by its at:// uri", async () => {
    const uri = `at://${ALICE}/social.grain.story/a2`;
    const { story } = await get(
      `/xrpc/social.grain.unspecced.getStory?story=${encodeURIComponent(uri)}`,
    );
    expect(story.uri).toBe(uri);
    expect(story.creator).toMatchObject({ did: ALICE, displayName: "Alice A" });
    expect(story.aspectRatio).toEqual({ width: 9, height: 16 });
    expect(story.location).toEqual({ name: "Portland", value: PDX });
    expect(story.crossPost).toEqual({ url: `https://bsky.app/profile/${ALICE}/post/post1` });
  });

  test("accepts a handle in the uri's authority position", async () => {
    const { story } = await get(
      `/xrpc/social.grain.unspecced.getStory?story=${encodeURIComponent("at://alice.test/social.grain.story/a2")}`,
    );
    expect(story.uri).toBe(`at://${ALICE}/social.grain.story/a2`);
  });

  test("returns a self-label on the story", async () => {
    const uri = `at://${ALICE}/social.grain.story/a-hidden`;
    const { story } = await get(
      `/xrpc/social.grain.unspecced.getStory?story=${encodeURIComponent(uri)}`,
    );
    // getStory serves a labelled story and reports the label, leaving the
    // decision to the client — unlike the list endpoints, which filter it out.
    expect(story.labels.map((l: any) => l.val)).toEqual(["spam"]);
  });

  test("returns nothing for a taken-down author", async () => {
    const uri = `at://${CAROL}/social.grain.story/c1`;
    expect(
      await get(`/xrpc/social.grain.unspecced.getStory?story=${encodeURIComponent(uri)}`),
    ).toEqual({});
  });

  test("returns nothing for an unknown story or an unresolvable handle", async () => {
    const gone = `at://${ALICE}/social.grain.story/nope`;
    expect(
      await get(`/xrpc/social.grain.unspecced.getStory?story=${encodeURIComponent(gone)}`),
    ).toEqual({});
    expect(
      await get(
        `/xrpc/social.grain.unspecced.getStory?story=${encodeURIComponent("at://nobody.test/social.grain.story/a1")}`,
      ),
    ).toEqual({});
  });

  test("rejects a request with no story uri", async () => {
    expect(await status("/xrpc/social.grain.unspecced.getStory")).toBe(400);
  });
});

// Viewed state is private to the viewer and lives in _story_views. Bob does
// the watching here; nothing he marks is visible to Alice, and nothing he
// marks changes what an anonymous request sees.
describe("markStoriesViewed", () => {
  const MARK = "social.grain.unspecced.markStoriesViewed";
  const authors = async (as?: string) =>
    (await get("/xrpc/social.grain.unspecced.getStoryAuthors", as)).authors;
  const alice = async (as?: string) =>
    (await authors(as)).find((a: any) => a.profile.did === ALICE);

  test("requires a session", async () => {
    const res = await post(MARK, { stories: [storyUri(ALICE, "a1")] });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test("rejects an empty list, a non-list, and a list that is too long", async () => {
    expect((await post(MARK, { stories: [] }, BOB)).status).toBeGreaterThanOrEqual(400);
    expect((await post(MARK, {}, BOB)).status).toBeGreaterThanOrEqual(400);
    expect((await post(MARK, { stories: "at://x" }, BOB)).status).toBeGreaterThanOrEqual(400);
    expect((await post(MARK, { stories: ["not-a-uri"] }, BOB)).status).toBeGreaterThanOrEqual(400);
    const many = Array.from({ length: 101 }, (_, i) => storyUri(ALICE, `x${i}`));
    expect((await post(MARK, { stories: many }, BOB)).status).toBeGreaterThanOrEqual(400);
  });

  test("before anything is watched, an authenticated viewer sees every story unwatched", async () => {
    const a = await alice(BOB);
    expect(a.unviewedCount).toBe(a.storyCount);
    expect(a.lastViewedAt).toBeUndefined();

    const { stories } = await get(`/xrpc/social.grain.unspecced.getStories?actor=${ALICE}`, BOB);
    expect(stories.some((s: any) => s.viewer?.viewed)).toBe(false);
  });

  test("an anonymous request carries no viewed state at all", async () => {
    const a = await alice();
    expect(a.unviewedCount).toBeUndefined();
    expect(a.lastViewedAt).toBeUndefined();
  });

  test("marking a story flags it on the story and moves the author's high-water mark", async () => {
    // a3 is the oldest live story; a1 is the newest.
    const res = await post(MARK, { stories: [storyUri(ALICE, "a3")] }, BOB);
    expect(res.status).toBe(200);

    const { stories } = await get(`/xrpc/social.grain.unspecced.getStories?actor=${ALICE}`, BOB);
    const a3 = stories.find((s: any) => s.uri.endsWith("/a3"));
    const a1 = stories.find((s: any) => s.uri.endsWith("/a1"));
    expect(a3.viewer.viewed).toBe(true);
    // Bob favorited a1 but has not watched it: the fav stays, viewed stays off.
    expect(a1.viewer).toEqual({ fav: `at://${BOB}/social.grain.favorite/f1` });

    const a = await alice(BOB);
    expect(a.lastViewedAt).toBe(a3.createdAt);
    expect(a.unviewedCount).toBe(a.storyCount - 1);
  });

  test("the single-story endpoint agrees", async () => {
    const seen = await get(
      `/xrpc/social.grain.unspecced.getStory?story=${storyUri(ALICE, "a3")}`,
      BOB,
    );
    expect(seen.story.viewer).toEqual({ viewed: true });
    const unseen = await get(
      `/xrpc/social.grain.unspecced.getStory?story=${storyUri(ALICE, "a1")}`,
      BOB,
    );
    expect(unseen.story.viewer).toBeUndefined();
  });

  test("watching everything catches the viewer up", async () => {
    const { stories } = await get(`/xrpc/social.grain.unspecced.getStories?actor=${ALICE}`, BOB);
    const res = await post(MARK, { stories: stories.map((s: any) => s.uri) }, BOB);
    expect(res.status).toBe(200);

    const a = await alice(BOB);
    // Every story getStories served is watched, and a-hidden, which it never
    // serves, is not counted either: the ring can actually reach grey.
    expect(a.unviewedCount).toBe(0);
    expect(a.lastViewedAt).toBe(a.latestAt);
  });

  test("marking twice is not an error and stores one row", async () => {
    expect((await post(MARK, { stories: [storyUri(ALICE, "a3")] }, BOB)).status).toBe(200);
    const rows = await server.db.query(
      `SELECT * FROM _story_views WHERE did = $1 AND subject = $2`,
      [BOB, storyUri(ALICE, "a3")],
    );
    expect(rows).toHaveLength(1);
  });

  test("a URI that is not a known story is ignored rather than stored", async () => {
    expect((await post(MARK, { stories: [storyUri(ALICE, "nope")] }, BOB)).status).toBe(200);
    const rows = await server.db.query(`SELECT * FROM _story_views WHERE subject = $1`, [
      storyUri(ALICE, "nope"),
    ]);
    expect(rows).toHaveLength(0);
  });

  test("one account's views are invisible to another", async () => {
    const a = await alice(ERIN);
    expect(a.lastViewedAt).toBeUndefined();
    expect(a.unviewedCount).toBe(a.storyCount);
    const { stories } = await get(`/xrpc/social.grain.unspecced.getStories?actor=${ALICE}`, ERIN);
    expect(stories.some((s: any) => s.viewer?.viewed)).toBe(false);
  });
});
