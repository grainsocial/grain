// The "For You" feed: collaborative filtering over favorites, with a
// most-favorited fallback when there is nothing to filter on.
//
// Scores decay with a six-hour half life, so every gallery here is dated
// relative to now rather than to a fixed date — a fixture pinned to a calendar
// date would score ~0 across the board and the ordering would stop meaning
// anything. The two paths get a world each, because the cold start's ranking
// is over every gallery present and a shared fixture would make both sets of
// assertions guesswork.

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startTestServer } from "@hatk/hatk/test";

const ALICE = "did:plc:alice";
const BOB = "did:plc:bob";
const DAN = "did:plc:dan";
const ERIN = "did:plc:erin";
const FRANK = "did:plc:frank";
const HANK = "did:plc:hank";
const GINA = "did:plc:gina";
const VIC = "did:plc:vic";
const ZOE = "did:plc:zoe";
const MALLORY = "did:plc:mallory"; // muted
const TAKEN = "did:plc:taken"; // taken down

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

async function repos(server: any, dids: [string, string][]) {
  for (const [did, status] of dids) {
    await server.db.run(`INSERT INTO _repos (did, status, handle) VALUES ($1, $2, $3)`, [
      did,
      status,
      `${did.split(":").pop()}.test`,
    ]);
  }
}

async function gallery(
  server: any,
  opts: { id: string; did: string; ageHours: number; empty?: boolean; hidden?: boolean },
) {
  const { db } = server;
  const at = hoursAgo(opts.ageHours);
  const uri = `at://${opts.did}/social.grain.gallery/${opts.id}`;
  await db.run(
    `INSERT INTO "social.grain.gallery" (uri, cid, did, indexed_at, title, created_at)
     VALUES ($1, $2, $3, $4, $5, $4)`,
    [uri, `cid-${opts.id}`, opts.did, at, opts.id],
  );
  if (!opts.empty) {
    const photoUri = `at://${opts.did}/social.grain.photo/${opts.id}-p`;
    await db.run(
      `INSERT INTO "social.grain.photo" (uri, cid, did, indexed_at, photo, aspect_ratio, created_at)
       VALUES ($1, $2, $3, 'i', $4, '{"width":3,"height":2}', $5)`,
      [
        photoUri,
        `cid-p-${opts.id}`,
        opts.did,
        JSON.stringify({
          $type: "blob",
          ref: { $link: `bafy-${opts.id}` },
          mimeType: "image/jpeg",
          size: 1,
        }),
        at,
      ],
    );
    await db.run(
      `INSERT INTO "social.grain.gallery.item" (uri, cid, did, indexed_at, created_at, gallery, item, position)
       VALUES ($1, $2, $3, 'i', $4, $5, $6, 0)`,
      [
        `at://${opts.did}/social.grain.gallery.item/${opts.id}`,
        `cid-i-${opts.id}`,
        opts.did,
        at,
        uri,
        photoUri,
      ],
    );
  }
  if (opts.hidden) {
    await db.run(
      `INSERT INTO _labels (src, uri, val, neg, cts) VALUES ('did:plc:mod', $1, 'spam', 0, $2)`,
      [uri, at],
    );
  }
  return uri;
}

/** `who` favorited gallery `id`, `ageHours` ago. */
async function favorite(server: any, who: string, ownerDid: string, id: string, ageHours: number) {
  const at = hoursAgo(ageHours);
  await server.db.run(
    `INSERT INTO "social.grain.favorite" (uri, cid, did, indexed_at, created_at, subject)
     VALUES ($1, $2, $3, 'i', $4, $5)`,
    [
      `at://${who}/social.grain.favorite/${id}`,
      `cid-fav-${who}-${id}`,
      who,
      at,
      `at://${ownerDid}/social.grain.gallery/${id}`,
    ],
  );
}

/** The test harness skips server/setup, so _mutes isn't there by default — and
 *  every feed query references it through blockMuteFilter, so a world without
 *  it answers 500 rather than merely skipping the mute check. */
async function ensureMutes(server: any) {
  await server.db.run(
    `CREATE TABLE IF NOT EXISTS _mutes (
       did TEXT NOT NULL, subject TEXT NOT NULL, created_at TEXT NOT NULL,
       PRIMARY KEY (did, subject)
     )`,
  );
}

async function mute(server: any, did: string, subject: string) {
  await ensureMutes(server);
  await server.db.run(`INSERT INTO _mutes (did, subject, created_at) VALUES ($1, $2, 'i')`, [
    did,
    subject,
  ]);
}

async function feed(server: any, query: string) {
  const res = await server.fetch(`/xrpc/dev.hatk.getFeed?feed=foryou&${query}`);
  expect(res.status).toBe(200);
  const body = await res.json();
  return {
    ids: (body.items ?? []).map((i: any) => i.uri.split("/").pop()),
    cursor: body.cursor as string | undefined,
  };
}

describe("for you feed, collaborative filtering", () => {
  let server: any;

  // Alice favorited S1. Five accounts favorited S1 before her, so each is a
  // co-liker, and whatever else they favorited becomes a candidate. Their
  // total like counts differ, which is what separates a discriminating
  // recommendation from a promiscuous one.
  //
  //   BOB    likes S1, C1                      -> 2 total
  //   DAN    likes S1, C1, C2, and 4 excluded  -> 7 total
  //   ERIN   likes S1, C3                      -> 2 total
  //   FRANK  likes S1, C4, and 8 of Alice's    -> 10 total
  //   HANK   likes S1, C6, C7                  -> 3 total
  //   GINA   likes S1 two days *after* Alice   -> outside the window
  beforeAll(async () => {
    server = await startTestServer();
    await repos(server, [
      [ALICE, "active"],
      [BOB, "active"],
      [DAN, "active"],
      [ERIN, "active"],
      [FRANK, "active"],
      [HANK, "active"],
      [GINA, "active"],
      [VIC, "active"],
      [MALLORY, "active"],
      [TAKEN, "takendown"],
    ]);
    await mute(server, ALICE, MALLORY);

    // Candidates share an age of 2h so time decay cancels between them, except
    // C6 and C7 which exist only to show the decay.
    for (const id of ["S1", "S2", "C1", "C2", "C3", "C4", "C5"]) {
      await gallery(server, { id, did: BOB, ageHours: 2 });
    }
    await gallery(server, { id: "C6", did: BOB, ageHours: 1 });
    await gallery(server, { id: "C7", did: BOB, ageHours: 25 });
    for (let i = 1; i <= 8; i++) await gallery(server, { id: `A${i}`, did: ALICE, ageHours: 2 });
    await gallery(server, { id: "X_down", did: TAKEN, ageHours: 2 });
    await gallery(server, { id: "X_hidden", did: BOB, ageHours: 2, hidden: true });
    await gallery(server, { id: "X_empty", did: BOB, ageHours: 2, empty: true });
    await gallery(server, { id: "X_muted", did: MALLORY, ageHours: 2 });

    // Alice's seed, 10 hours ago.
    await favorite(server, ALICE, BOB, "S1", 10);
    for (const who of [BOB, DAN, ERIN, FRANK, HANK]) {
      await favorite(server, who, BOB, "S1", 11); // an hour before Alice
    }
    await favorite(server, GINA, BOB, "S1", -38); // 48h after Alice, outside the window

    await favorite(server, BOB, BOB, "C1", 3);
    await favorite(server, DAN, BOB, "C1", 3);
    await favorite(server, DAN, BOB, "C2", 3);
    await favorite(server, ERIN, BOB, "C3", 3);
    await favorite(server, FRANK, BOB, "C4", 3);
    await favorite(server, GINA, BOB, "C5", 3);
    await favorite(server, HANK, BOB, "C6", 3);
    await favorite(server, HANK, BOB, "C7", 3);
    for (const id of ["X_down", "X_hidden", "X_empty", "X_muted"]) {
      const owner = id === "X_down" ? TAKEN : id === "X_muted" ? MALLORY : BOB;
      await favorite(server, DAN, owner, id, 3);
    }
    // Frank's eight extra likes are all on Alice's own galleries, which can
    // never be recommended to her — they inflate his like count without adding
    // candidates that would muddy the ranking.
    for (let i = 1; i <= 8; i++) await favorite(server, FRANK, ALICE, `A${i}`, 3);

    // Vic favorited a gallery nobody else did, so he has no co-likers at all.
    await favorite(server, VIC, BOB, "S2", 5);
  });

  afterAll(async () => await server?.close());

  test("ranks what co-likers also favorited", async () => {
    const { ids } = await feed(server, `actor=${ALICE}&limit=50`);
    expect(ids).toEqual(["C1", "C3", "C6", "C2", "C4", "C7"]);
  });

  test("prefers a co-liker who favorites sparingly over one who favorites everything", async () => {
    // C3 came from Erin (2 likes total), C4 from Frank (10). Same age, same
    // popularity, one path each — the like count is the only difference.
    const { ids } = await feed(server, `actor=${ALICE}&limit=50`);
    expect(ids.indexOf("C3")).toBeLessThan(ids.indexOf("C4"));
  });

  test("ranks a gallery two co-likers agreed on above one only a single co-liker liked", async () => {
    const { ids } = await feed(server, `actor=${ALICE}&limit=50`);
    expect(ids.indexOf("C1")).toBeLessThan(ids.indexOf("C2"));
  });

  test("decays a gallery's score with its age", async () => {
    // C6 and C7 both come from Hank alone and are equally popular; C6 is an
    // hour old and C7 is twenty-five, more than four half-lives apart.
    const { ids } = await feed(server, `actor=${ALICE}&limit=50`);
    expect(ids.indexOf("C6")).toBeLessThan(ids.indexOf("C7"));
  });

  test("never recommends the seed it started from", async () => {
    const { ids } = await feed(server, `actor=${ALICE}&limit=50`);
    expect(ids).not.toContain("S1");
  });

  test("never recommends the actor's own galleries", async () => {
    const { ids } = await feed(server, `actor=${ALICE}&limit=50`);
    for (let i = 1; i <= 8; i++) expect(ids).not.toContain(`A${i}`);
  });

  test("ignores a co-liker who liked the seed long after the actor did", async () => {
    // Gina liked S1 two days after Alice, past the 24h window, so C5 — the
    // only gallery reachable through her — is not a candidate.
    const { ids } = await feed(server, `actor=${ALICE}&limit=50`);
    expect(ids).not.toContain("C5");
  });

  test("drops taken-down, labelled, empty and muted candidates", async () => {
    const { ids } = await feed(server, `actor=${ALICE}&limit=50`);
    expect(ids).not.toContain("X_down");
    expect(ids).not.toContain("X_hidden");
    expect(ids).not.toContain("X_empty");
    expect(ids).not.toContain("X_muted");
  });

  test("pages by offset", async () => {
    const first = await feed(server, `actor=${ALICE}&limit=2`);
    expect(first.ids).toEqual(["C1", "C3"]);
    expect(first.cursor).toBe("2");

    const second = await feed(server, `actor=${ALICE}&limit=2&cursor=2`);
    expect(second.ids).toEqual(["C6", "C2"]);
    expect(second.cursor).toBe("4");

    const third = await feed(server, `actor=${ALICE}&limit=2&cursor=4`);
    expect(third.ids).toEqual(["C4", "C7"]);
    expect(third.cursor).toBeUndefined();
  });

  test("falls back to popularity for an actor whose likes nobody shares", async () => {
    // Vic has a seed but no co-likers, which is the same dead end as having no
    // seed at all. S1 is the most-favorited gallery in this world.
    const { ids } = await feed(server, `actor=${VIC}&limit=50`);
    expect(ids[0]).toBe("S1");
  });

  test("is empty without an actor", async () => {
    const { ids } = await feed(server, "limit=50");
    expect(ids).toEqual([]);
  });
});

describe("for you feed, scoring terms", () => {
  let server: any;

  // Two pairs, each built so that dropping one scoring term flips its order.
  //
  //   G_multi  2 co-likers with 5 likes each -> raw 0.40, 2 paths, popularity 2
  //   G_single 1 co-liker with 2 likes       -> raw 0.50, 1 path,  popularity 2
  //     Multi wins only because paths^0.5 boosts it past a higher raw score.
  //
  //   H_pop    1 co-liker with 2 likes       -> raw 0.50, popularity 20
  //   H_rare   1 co-liker with 4 likes       -> raw 0.25, popularity 1
  //     Rare wins only because the popularity penalty drags H_pop under it.
  //
  // Everything is two hours old, so time decay is the same multiplier
  // throughout and cannot account for any of the ordering.
  const P = "did:plc:pp";
  const Q = "did:plc:qq";
  const R = "did:plc:rr";
  const U = "did:plc:uu";
  const V = "did:plc:vv";

  beforeAll(async () => {
    server = await startTestServer();
    await repos(server, [
      [ALICE, "active"],
      [BOB, "active"],
      [P, "active"],
      [Q, "active"],
      [R, "active"],
      [U, "active"],
      [V, "active"],
    ]);
    await ensureMutes(server);

    for (const id of ["S", "G_multi", "G_single", "H_pop", "H_rare"]) {
      await gallery(server, { id, did: BOB, ageHours: 2 });
    }
    for (let i = 1; i <= 8; i++) await gallery(server, { id: `A${i}`, did: ALICE, ageHours: 2 });

    await favorite(server, ALICE, BOB, "S", 10);
    for (const who of [P, Q, R, U, V]) await favorite(server, who, BOB, "S", 11);

    await favorite(server, P, BOB, "G_multi", 3);
    await favorite(server, Q, BOB, "G_multi", 3);
    await favorite(server, R, BOB, "G_single", 3);
    await favorite(server, U, BOB, "H_pop", 3);
    await favorite(server, V, BOB, "H_rare", 3);

    // Filler likes on Alice's own galleries, which can never be recommended to
    // her — they set each co-liker's total like count without adding candidates.
    for (const [who, ids] of [
      [P, ["A1", "A2", "A3"]],
      [Q, ["A4", "A5", "A6"]],
      [V, ["A7", "A8"]],
    ] as [string, string[]][]) {
      for (const id of ids) await favorite(server, who, ALICE, id, 3);
    }

    // Nineteen accounts who favorited H_pop and nothing else. They never
    // touched the seed, so they are not co-likers and add no paths — they
    // exist only to make H_pop popular.
    for (let i = 0; i < 19; i++) {
      await favorite(server, `did:plc:pop${i}`, BOB, "H_pop", 3);
    }
    // One non-co-liker on G_single so both G galleries are equally popular and
    // the popularity penalty cancels between them.
    await favorite(server, "did:plc:zz", BOB, "G_single", 3);
  });

  afterAll(async () => await server?.close());

  test("boosts agreement between co-likers above a single stronger signal", async () => {
    const { ids } = await feed(server, `actor=${ALICE}&limit=50`);
    expect(ids.indexOf("G_multi")).toBeLessThan(ids.indexOf("G_single"));
  });

  test("penalises a gallery everyone already favorited", async () => {
    const { ids } = await feed(server, `actor=${ALICE}&limit=50`);
    expect(ids.indexOf("H_rare")).toBeLessThan(ids.indexOf("H_pop"));
  });

  test("ranks the four together as the combined score dictates", async () => {
    const { ids } = await feed(server, `actor=${ALICE}&limit=50`);
    expect(ids).toEqual(["G_multi", "G_single", "H_rare", "H_pop"]);
  });
});

describe("for you feed, cold start", () => {
  let server: any;

  // Zoe has favorited nothing, so the feed can only rank by raw popularity
  // over the last thirty days.
  beforeAll(async () => {
    server = await startTestServer();
    await repos(server, [
      [ZOE, "active"],
      [BOB, "active"],
      [DAN, "active"],
      [ERIN, "active"],
      [FRANK, "active"],
      [MALLORY, "active"],
      [TAKEN, "takendown"],
    ]);
    await mute(server, ZOE, MALLORY);

    await gallery(server, { id: "P3", did: BOB, ageHours: 2 });
    await gallery(server, { id: "P2", did: BOB, ageHours: 3 });
    await gallery(server, { id: "P1", did: BOB, ageHours: 4 });
    await gallery(server, { id: "P0", did: BOB, ageHours: 5 });
    await gallery(server, { id: "OLD", did: BOB, ageHours: 24 * 40 });
    await gallery(server, { id: "ZOWN", did: ZOE, ageHours: 2 });
    await gallery(server, { id: "DOWN", did: TAKEN, ageHours: 2 });
    await gallery(server, { id: "HID", did: BOB, ageHours: 2, hidden: true });
    await gallery(server, { id: "MT", did: BOB, ageHours: 2, empty: true });
    await gallery(server, { id: "MUTED", did: MALLORY, ageHours: 2 });

    const likers = [DAN, ERIN, FRANK];
    for (const [id, owner, n] of [
      ["P3", BOB, 3],
      ["P2", BOB, 2],
      ["P1", BOB, 1],
      ["OLD", BOB, 3],
      ["ZOWN", ZOE, 3],
      ["DOWN", TAKEN, 3],
      ["HID", BOB, 3],
      ["MT", BOB, 3],
      ["MUTED", MALLORY, 3],
    ] as [string, string, number][]) {
      for (const who of likers.slice(0, n)) await favorite(server, who, owner, id, 3);
    }
  });

  afterAll(async () => await server?.close());

  test("ranks recent galleries by how many favorites they have", async () => {
    const { ids } = await feed(server, `actor=${ZOE}&limit=50`);
    expect(ids).toEqual(["P3", "P2", "P1", "P0"]);
  });

  test("ignores galleries older than thirty days however popular", async () => {
    const { ids } = await feed(server, `actor=${ZOE}&limit=50`);
    expect(ids).not.toContain("OLD");
  });

  test("never recommends the actor's own galleries", async () => {
    const { ids } = await feed(server, `actor=${ZOE}&limit=50`);
    expect(ids).not.toContain("ZOWN");
  });

  test("drops taken-down, labelled, empty and muted galleries", async () => {
    const { ids } = await feed(server, `actor=${ZOE}&limit=50`);
    expect(ids).not.toContain("DOWN");
    expect(ids).not.toContain("HID");
    expect(ids).not.toContain("MT");
    expect(ids).not.toContain("MUTED");
  });

  test("pages by offset, and offers a cursor whenever it filled the page", async () => {
    const first = await feed(server, `actor=${ZOE}&limit=2`);
    expect(first.ids).toEqual(["P3", "P2"]);
    expect(first.cursor).toBe("2");

    // A full second page still hands back a cursor even though nothing
    // follows it — the cold start infers "more" from a full page rather than
    // counting. The empty third page is how a client finds the end.
    const second = await feed(server, `actor=${ZOE}&limit=2&cursor=2`);
    expect(second.ids).toEqual(["P1", "P0"]);
    expect(second.cursor).toBe("4");

    const third = await feed(server, `actor=${ZOE}&limit=2&cursor=4`);
    expect(third.ids).toEqual([]);
    expect(third.cursor).toBeUndefined();
  });
});
