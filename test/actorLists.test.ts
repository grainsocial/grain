// The actor-facing read endpoints: the viewer's own block and mute lists,
// their favorites, and who to follow next. All four hydrate a list of DIDs into
// profiles the same way, so the handle fallback is checked once per endpoint
// rather than once per field.

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startTestServer } from "@hatk/hatk/test";

const ALICE = "did:plc:alice";
const BOB = "did:plc:bob";
const CAROL = "did:plc:carol"; // taken down
const DAVE = "did:plc:dave";
const ERIN = "did:plc:erin"; // no profile record, handle only
const FRANK = "did:plc:frank";
const GINA = "did:plc:gina";
const HOLLY = "did:plc:holly"; // popular on grain, and unrelated to Alice

let server: any;

async function gallery(id: string, did: string, createdAt: string, opts: { empty?: boolean } = {}) {
  const { db } = server;
  const uri = `at://${did}/social.grain.gallery/${id}`;
  await db.run(
    `INSERT INTO "social.grain.gallery" (uri, cid, did, indexed_at, title, created_at)
     VALUES ($1, $2, $3, 'i', $4, $5)`,
    [uri, `cid-${id}`, did, id, createdAt],
  );
  if (!opts.empty) {
    const photoUri = `at://${did}/social.grain.photo/${id}-p`;
    await db.run(
      `INSERT INTO "social.grain.photo" (uri, cid, did, indexed_at, photo, aspect_ratio, created_at)
       VALUES ($1, $2, $3, 'i', $4, '{"width":3,"height":2}', $5)`,
      [
        photoUri,
        `cid-p-${id}`,
        did,
        JSON.stringify({
          $type: "blob",
          ref: { $link: `bafy-${id}` },
          mimeType: "image/jpeg",
          size: 1,
        }),
        createdAt,
      ],
    );
    await db.run(
      `INSERT INTO "social.grain.gallery.item" (uri, cid, did, indexed_at, created_at, gallery, item, position)
       VALUES ($1, $2, $3, 'i', $4, $5, $6, 0)`,
      [`at://${did}/social.grain.gallery.item/${id}`, `cid-i-${id}`, did, createdAt, uri, photoUri],
    );
  }
  return uri;
}

/** `who` favorited `subject` at `createdAt`; `rkey` makes repeat records distinct. */
async function favorite(who: string, subject: string, createdAt: string, rkey: string) {
  await server.db.run(
    `INSERT INTO "social.grain.favorite" (uri, cid, did, indexed_at, created_at, subject)
     VALUES ($1, $2, $3, 'i', $4, $5)`,
    [`at://${who}/social.grain.favorite/${rkey}`, `cid-${rkey}`, who, createdAt, subject],
  );
}

async function get(path: string, as?: string) {
  const res = as ? await server.fetchAs(as, path) : await server.fetch(path);
  expect(res.status).toBe(200);
  return res.json();
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

  for (const [did, handle, status] of [
    [ALICE, "alice.test", "active"],
    [BOB, "bob.test", "active"],
    [CAROL, "carol.test", "takendown"],
    [DAVE, "dave.test", "active"],
    [ERIN, "erin.test", "active"],
    [FRANK, "frank.test", "active"],
    [GINA, "gina.test", "active"],
    [HOLLY, "holly.test", "active"],
  ]) {
    await db.run(`INSERT INTO _repos (did, status, handle) VALUES ($1, $2, $3)`, [
      did,
      status,
      handle,
    ]);
  }

  // Erin deliberately has no profile record — she exercises the handle fallback.
  for (const [did, name] of [
    [ALICE, "Alice A"],
    [BOB, "Bob Ross"],
    [CAROL, "Carol C"],
    [DAVE, "Dave D"],
    [FRANK, "Frank F"],
    [GINA, "Gina G"],
    [HOLLY, "Holly H"],
  ]) {
    await db.run(
      `INSERT INTO "social.grain.actor.profile" (uri, cid, did, indexed_at, display_name, created_at)
       VALUES ($1, $2, $3, 'i', $4, '2026-01-01')`,
      [`at://${did}/social.grain.actor.profile/self`, `cid-p-${did}`, did, name],
    );
  }

  // Alice blocked three people, most recently Erin.
  for (const [subject, at] of [
    [BOB, "2026-01-01"],
    [DAVE, "2026-01-02"],
    [ERIN, "2026-01-03"],
  ]) {
    await db.run(
      `INSERT INTO "social.grain.graph.block" (uri, cid, did, indexed_at, subject, created_at)
       VALUES ($1, $2, $3, 'i', $4, $5)`,
      [
        `at://${ALICE}/social.grain.graph.block/${subject}`,
        `cid-bl-${subject}`,
        ALICE,
        subject,
        at,
      ],
    );
  }

  // ...and muted two.
  await db.run(`INSERT INTO _mutes (did, subject, created_at) VALUES ($1, $2, $3)`, [
    ALICE,
    FRANK,
    "2026-02-01",
  ]);
  await db.run(`INSERT INTO _mutes (did, subject, created_at) VALUES ($1, $2, $3)`, [
    ALICE,
    ERIN,
    "2026-02-02",
  ]);

  // Galleries Alice can favorite.
  await gallery("g1", BOB, "2026-03-01");
  await gallery("g2", BOB, "2026-03-02");
  await gallery("g3", DAVE, "2026-03-03");
  await gallery("g-down", CAROL, "2026-03-04"); // taken-down author
  await gallery("g-empty", BOB, "2026-03-05", { empty: true });
  await gallery("g-hidden", BOB, "2026-03-06");
  await db.run(
    `INSERT INTO _labels (src, uri, val, neg, cts) VALUES ('did:plc:mod', $1, 'spam', 0, '2026-03-07')`,
    [`at://${BOB}/social.grain.gallery/g-hidden`],
  );

  // Alice's favorites. g1 is favorited twice — an account really can hold two
  // favorite records for one gallery, and the later one is what orders it.
  await favorite(ALICE, `at://${BOB}/social.grain.gallery/g2`, "2026-04-01", "f-g2");
  await favorite(ALICE, `at://${DAVE}/social.grain.gallery/g3`, "2026-04-02", "f-g3");
  await favorite(ALICE, `at://${BOB}/social.grain.gallery/g1`, "2026-04-03", "f-g1a");
  await favorite(ALICE, `at://${BOB}/social.grain.gallery/g1`, "2026-04-04", "f-g1b");
  for (const [id, owner] of [
    ["g-down", CAROL],
    ["g-empty", BOB],
    ["g-hidden", BOB],
  ]) {
    await favorite(ALICE, `at://${owner}/social.grain.gallery/${id}`, "2026-04-05", `f-${id}`);
  }
  await favorite(BOB, `at://${BOB}/social.grain.gallery/g1`, "2026-04-06", "f-bob");

  // Suggested follows: Alice follows Gina, Frank and Carol on Bluesky. Gina has
  // a grain profile and Alice does not follow her on grain, so she is the
  // suggestion. Frank is muted, Carol is taken down.
  for (const subject of [GINA, FRANK, CAROL, DAVE]) {
    await db.run(
      `INSERT INTO "app.bsky.graph.follow" (uri, cid, did, indexed_at, subject, created_at)
       VALUES ($1, $2, $3, 'i', $4, '2026-01-01')`,
      [`at://${ALICE}/app.bsky.graph.follow/${subject}`, `cid-bf-${subject}`, ALICE, subject],
    );
  }
  // Alice already follows Dave on grain, so he is not a suggestion.
  await db.run(
    `INSERT INTO "social.grain.graph.follow" (uri, cid, did, indexed_at, subject, created_at)
     VALUES ($1, 'cid-gf', $2, 'i', $3, '2026-01-01')`,
    [`at://${ALICE}/social.grain.graph.follow/dave`, ALICE, DAVE],
  );
  // Holly is popular on grain and unconnected to Alice, so she is what the
  // backfill reaches for. Bob could not be — Alice blocked him.
  for (const follower of [DAVE, ERIN, FRANK, GINA]) {
    await db.run(
      `INSERT INTO "social.grain.graph.follow" (uri, cid, did, indexed_at, subject, created_at)
       VALUES ($1, $2, $3, 'i', $4, '2026-01-01')`,
      [`at://${follower}/social.grain.graph.follow/holly`, `cid-gfh-${follower}`, follower, HOLLY],
    );
    await db.run(
      `INSERT INTO "social.grain.graph.follow" (uri, cid, did, indexed_at, subject, created_at)
       VALUES ($1, $2, $3, 'i', $4, '2026-01-01')`,
      [`at://${follower}/social.grain.graph.follow/bob`, `cid-gfb-${follower}`, follower, BOB],
    );
  }
});

afterAll(async () => await server?.close());

describe("getBlocks", () => {
  test("lists who the viewer blocked, most recent first", async () => {
    const { items } = await get("/xrpc/social.grain.unspecced.getBlocks", ALICE);
    expect(items.map((i: any) => i.did)).toEqual([ERIN, DAVE, BOB]);
  });

  test("carries the block record's uri so it can be undone", async () => {
    const { items } = await get("/xrpc/social.grain.unspecced.getBlocks", ALICE);
    const bob = items.find((i: any) => i.did === BOB);
    expect(bob.blockUri).toBe(`at://${ALICE}/social.grain.graph.block/${BOB}`);
  });

  test("hydrates each blocked account's profile", async () => {
    const { items } = await get("/xrpc/social.grain.unspecced.getBlocks", ALICE);
    expect(items.find((i: any) => i.did === BOB)).toMatchObject({
      handle: "bob.test",
      displayName: "Bob Ross",
    });
  });

  test("falls back to the handle for an account with no profile", async () => {
    const { items } = await get("/xrpc/social.grain.unspecced.getBlocks", ALICE);
    const erin = items.find((i: any) => i.did === ERIN);
    expect(erin.handle).toBe("erin.test");
    expect(erin.displayName).toBeUndefined();
  });

  test("pages, and stops offering a cursor at the end", async () => {
    const first = await get("/xrpc/social.grain.unspecced.getBlocks?limit=2", ALICE);
    expect(first.items.map((i: any) => i.did)).toEqual([ERIN, DAVE]);
    expect(first.cursor).toBeTruthy();

    const second = await get(
      `/xrpc/social.grain.unspecced.getBlocks?limit=2&cursor=${encodeURIComponent(first.cursor)}`,
      ALICE,
    );
    expect(second.items.map((i: any) => i.did)).toEqual([BOB]);
    expect(second.cursor).toBeUndefined();
  });

  test("is empty for a viewer who blocked nobody", async () => {
    const { items } = await get("/xrpc/social.grain.unspecced.getBlocks", BOB);
    expect(items).toEqual([]);
  });

  test("requires a session", async () => {
    const res = await server.fetch("/xrpc/social.grain.unspecced.getBlocks");
    expect(res.status).toBe(400);
  });
});

describe("getMutes", () => {
  test("lists who the viewer muted, most recent first", async () => {
    const { items } = await get("/xrpc/social.grain.unspecced.getMutes", ALICE);
    expect(items.map((i: any) => i.did)).toEqual([ERIN, FRANK]);
  });

  test("hydrates profiles and falls back to the handle", async () => {
    const { items } = await get("/xrpc/social.grain.unspecced.getMutes", ALICE);
    expect(items.find((i: any) => i.did === FRANK)).toMatchObject({
      handle: "frank.test",
      displayName: "Frank F",
    });
    expect(items.find((i: any) => i.did === ERIN).displayName).toBeUndefined();
  });

  test("carries no block uri, since a mute is not a record", async () => {
    const { items } = await get("/xrpc/social.grain.unspecced.getMutes", ALICE);
    expect(items[0].blockUri).toBeUndefined();
  });

  test("pages", async () => {
    const first = await get("/xrpc/social.grain.unspecced.getMutes?limit=1", ALICE);
    expect(first.items.map((i: any) => i.did)).toEqual([ERIN]);
    expect(first.cursor).toBeTruthy();

    const second = await get(
      `/xrpc/social.grain.unspecced.getMutes?limit=1&cursor=${encodeURIComponent(first.cursor)}`,
      ALICE,
    );
    expect(second.items.map((i: any) => i.did)).toEqual([FRANK]);
    expect(second.cursor).toBeUndefined();
  });

  test("requires a session", async () => {
    expect((await server.fetch("/xrpc/social.grain.unspecced.getMutes")).status).toBe(400);
  });
});

describe("getActorFavorites", () => {
  const path = (extra = "") =>
    `/xrpc/social.grain.unspecced.getActorFavorites?actor=${ALICE}${extra}`;
  const ids = (items: any[]) => items.map((i) => i.uri.split("/").pop());

  test("lists the actor's favorites, most recently favorited first", async () => {
    const { items } = await get(path(), ALICE);
    expect(ids(items)).toEqual(["g1", "g3", "g2"]);
  });

  test("lists a gallery once even when favorited twice", async () => {
    // Duplicate favorite records for one gallery are real and present in prod.
    const { items } = await get(path(), ALICE);
    expect(ids(items).filter((i) => i === "g1")).toHaveLength(1);
  });

  test("orders a re-favorited gallery by the later record", async () => {
    // g1's first favorite predates g2's and g3's; its second postdates both,
    // and that is the one that decides where it sits.
    const { items } = await get(path(), ALICE);
    expect(ids(items)[0]).toBe("g1");
  });

  test("drops favorites of taken-down, empty and hidden galleries", async () => {
    const { items } = await get(path(), ALICE);
    expect(ids(items)).not.toContain("g-down");
    expect(ids(items)).not.toContain("g-empty");
    expect(ids(items)).not.toContain("g-hidden");
  });

  test("shows nothing to anyone but the actor", async () => {
    // Favorites are private to the account that made them.
    expect((await get(path(), BOB)).items).toEqual([]);
    expect((await get(path())).items).toEqual([]);
  });

  test("pages with a created_at cursor", async () => {
    const first = await get(path("&limit=2"), ALICE);
    expect(ids(first.items)).toEqual(["g1", "g3"]);
    expect(first.cursor).toBeTruthy();

    const second = await get(path(`&limit=2&cursor=${encodeURIComponent(first.cursor)}`), ALICE);
    expect(ids(second.items)).toEqual(["g2"]);
    expect(second.cursor).toBeUndefined();
  });
});

describe("getSuggestedFollows", () => {
  const path = (extra = "") =>
    `/xrpc/social.grain.unspecced.getSuggestedFollows?actor=${ALICE}${extra}`;

  test("suggests Bluesky follows who are on grain but not followed here", async () => {
    const { items } = await get(path("&limit=1"), ALICE);
    expect(items.map((i: any) => i.did)).toEqual([GINA]);
  });

  test("skips accounts already followed on grain, taken down, or muted", async () => {
    const { items } = await get(path("&limit=10"), ALICE);
    const dids = items.map((i: any) => i.did);
    expect(dids).not.toContain(DAVE); // already followed on grain
    expect(dids).not.toContain(CAROL); // taken down
    expect(dids).not.toContain(FRANK); // muted
    expect(dids).not.toContain(ALICE); // never suggest yourself
  });

  test("backfills with popular grain profiles when the graph runs out", async () => {
    // Only Gina comes from the Bluesky graph. The rest of the page is filled
    // by follower count, and the Bluesky suggestion still leads.
    const { items } = await get(path("&limit=3"), ALICE);
    expect(items.map((i: any) => i.did)).toEqual([GINA, HOLLY]);
  });

  test("will not backfill someone the viewer blocked", async () => {
    // Bob has as many followers as Holly, but Alice blocked him.
    const { items } = await get(path("&limit=10"), ALICE);
    expect(items.map((i: any) => i.did)).not.toContain(BOB);
  });

  test("reports each suggestion's follower count", async () => {
    const { items } = await get(path("&limit=10"), ALICE);
    expect(items.find((i: any) => i.did === HOLLY).followersCount).toBe(4);
    expect(items.find((i: any) => i.did === GINA).followersCount).toBe(0);
  });

  test("cannot suggest an account with no grain profile", async () => {
    const { items } = await get(path("&limit=10"), ALICE);
    expect(items.map((i: any) => i.did)).not.toContain(ERIN);
  });
});
