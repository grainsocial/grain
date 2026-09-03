// The five gallery feeds behind `dev.hatk.getFeed`. They differ only in how
// they select galleries — the exclusions (empty galleries, taken-down repos,
// hide labels, blocks and mutes) are shared SQL fragments, so this file seeds
// one world and checks each feed against it rather than re-seeding per feed.

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startTestServer } from "@hatk/hatk/test";

const ALICE = "did:plc:alice";
const BOB = "did:plc:bob";
const CAROL = "did:plc:carol"; // taken down
const DAVE = "did:plc:dave"; // Alice blocks Dave
const ERIN = "did:plc:erin"; // Erin blocks Alice
const FRANK = "did:plc:frank"; // Alice mutes Frank

const RICOH_A = "RICOH IMAGING COMPANY, LTD. GR III";
const RICOH_B = "RICOH IMAGING COMPANY, LTD RICOH GR III";

let server: Awaited<ReturnType<typeof startTestServer>>;

async function gallery(opts: {
  id: string;
  did?: string;
  createdAt: string;
  /** Defaults to `createdAt`; set it apart to exercise `sort_at`. */
  indexedAt?: string;
  description?: string;
  /** photo id -> raw "make model", or null for a photo with no EXIF row. */
  photos?: Record<string, string | null>;
}) {
  const { db } = server;
  const did = opts.did ?? ALICE;
  const uri = `at://${did}/social.grain.gallery/${opts.id}`;
  await db.run(
    `INSERT INTO "social.grain.gallery" (uri, cid, did, indexed_at, title, description, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      uri,
      `cid-${opts.id}`,
      did,
      opts.indexedAt ?? opts.createdAt,
      opts.id,
      opts.description ?? null,
      opts.createdAt,
    ],
  );

  // `photos: undefined` means one plain photo — a gallery has to hold at least
  // one item to appear in any feed at all. `photos: {}` means deliberately empty.
  const photos = opts.photos ?? { [`${opts.id}-p`]: null };
  for (const [photoId, raw] of Object.entries(photos)) {
    const photoUri = `at://${did}/social.grain.photo/${photoId}`;
    await db.run(
      `INSERT INTO "social.grain.photo" (uri, cid, did, indexed_at, photo, aspect_ratio, created_at)
       VALUES ($1, $2, $3, 'i', $4, '{"width":3,"height":2}', $5)`,
      [
        photoUri,
        `cid-${photoId}`,
        did,
        JSON.stringify({
          $type: "blob",
          ref: { $link: `bafy-${photoId}` },
          mimeType: "image/jpeg",
          size: 1,
        }),
        opts.createdAt,
      ],
    );
    if (raw) {
      const [make, ...model] = raw.split(" ");
      await db.run(
        `INSERT INTO "social.grain.photo.exif" (uri, cid, did, indexed_at, photo, created_at, make, model)
         VALUES ($1, $2, $3, 'i', $4, $5, $6, $7)`,
        [
          `at://${did}/social.grain.photo.exif/${photoId}`,
          `cid-e-${photoId}`,
          did,
          photoUri,
          opts.createdAt,
          make,
          model.join(" "),
        ],
      );
    }
    await db.run(
      `INSERT INTO "social.grain.gallery.item" (uri, cid, did, indexed_at, created_at, gallery, item, position)
       VALUES ($1, $2, $3, 'i', $4, $5, $6, 0)`,
      [
        `at://${did}/social.grain.gallery.item/${photoId}`,
        `cid-i-${photoId}`,
        did,
        opts.createdAt,
        uri,
        photoUri,
      ],
    );
  }
  return uri;
}

/** Feed results as bare gallery ids, which is what each feed actually decides. */
async function feed(query: string, as?: string) {
  const path = `/xrpc/dev.hatk.getFeed?${query}`;
  const res = as ? await server.fetchAs(as, path) : await server.fetch(path);
  expect(res.status).toBe(200);
  const body = await res.json();
  return {
    ids: (body.items ?? []).map((i: any) => i.uri.split("/").pop()),
    cursor: body.cursor as string | undefined,
  };
}

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

  for (const [did, handle, status] of [
    [ALICE, "alice.test", "active"],
    [BOB, "bob.test", "active"],
    [CAROL, "carol.test", "takendown"],
    [DAVE, "dave.test", "active"],
    [ERIN, "erin.test", "active"],
    [FRANK, "frank.test", "active"],
  ]) {
    await db.run(`INSERT INTO _repos (did, status, handle) VALUES ($1, $2, $3)`, [
      did,
      status,
      handle,
    ]);
  }

  // Alice's galleries, spread so that sort_at ordering is unambiguous.
  await gallery({ id: "a-old", createdAt: "2026-01-01" });
  await gallery({
    id: "a-mid",
    createdAt: "2026-05-01",
    description: "sunset over #portland",
    photos: { "a-mid-p": RICOH_A },
  });
  await gallery({
    id: "a-new",
    createdAt: "2026-06-01",
    photos: { "a-new-p": "NIKON CORPORATION NIKON D600" },
  });
  // Client clock skew: created in 2099, indexed when it really arrived.
  await gallery({ id: "a-future", createdAt: "2099-01-01", indexedAt: "2026-03-01" });
  // A /settings/import backfill: created_at is the original Bluesky post date.
  await gallery({ id: "a-import", createdAt: "2020-01-01", indexedAt: "2026-07-01" });
  // No items at all.
  await gallery({ id: "a-empty", createdAt: "2026-06-15", photos: {} });
  await gallery({ id: "a-hidden", createdAt: "2026-06-10", description: "#portland hidden" });
  await gallery({ id: "a-unhidden", createdAt: "2026-06-12" });

  await gallery({ id: "b1", did: BOB, createdAt: "2026-04-01", photos: { "b1-p": RICOH_B } });
  await gallery({
    id: "c1",
    did: CAROL,
    createdAt: "2026-06-20",
    description: "#portland taken down",
    photos: { "c1-p": RICOH_A },
  });
  await gallery({ id: "d1", did: DAVE, createdAt: "2026-02-01" });
  await gallery({ id: "e1", did: ERIN, createdAt: "2026-02-02" });
  await gallery({ id: "f1", did: FRANK, createdAt: "2026-02-03" });

  // A hide-severity label on a-hidden. a-unhidden gets the same label and then
  // a later negation, which is the only thing that should bring it back.
  await db.run(
    `INSERT INTO _labels (src, uri, val, neg, cts) VALUES ($1, $2, 'spam', 0, '2026-06-11')`,
    ["did:plc:mod", `at://${ALICE}/social.grain.gallery/a-hidden`],
  );
  await db.run(
    `INSERT INTO _labels (src, uri, val, neg, cts) VALUES ($1, $2, 'spam', 0, '2026-06-13')`,
    ["did:plc:mod", `at://${ALICE}/social.grain.gallery/a-unhidden`],
  );
  await db.run(
    `INSERT INTO _labels (src, uri, val, neg, cts) VALUES ($1, $2, 'spam', 1, '2026-06-14')`,
    ["did:plc:mod", `at://${ALICE}/social.grain.gallery/a-unhidden`],
  );

  // Alice follows everyone except Carol, so the following feed's own filters
  // are the only thing that can narrow it.
  for (const subject of [BOB, DAVE, ERIN, FRANK]) {
    await db.run(
      `INSERT INTO "social.grain.graph.follow" (uri, cid, did, indexed_at, subject, created_at)
       VALUES ($1, $2, $3, 'i', $4, '2026-01-01')`,
      [`at://${ALICE}/social.grain.graph.follow/${subject}`, `cid-f-${subject}`, ALICE, subject],
    );
  }

  // Blocks run both ways; a mute only runs one.
  await db.run(
    `INSERT INTO "social.grain.graph.block" (uri, cid, did, indexed_at, subject, created_at)
     VALUES ($1, 'cid-bl-d', $2, 'i', $3, '2026-01-01')`,
    [`at://${ALICE}/social.grain.graph.block/dave`, ALICE, DAVE],
  );
  await db.run(
    `INSERT INTO "social.grain.graph.block" (uri, cid, did, indexed_at, subject, created_at)
     VALUES ($1, 'cid-bl-e', $2, 'i', $3, '2026-01-01')`,
    [`at://${ERIN}/social.grain.graph.block/alice`, ERIN, ALICE],
  );
  await db.run(`INSERT INTO _mutes (did, subject, created_at) VALUES ($1, $2, 'i')`, [
    ALICE,
    FRANK,
  ]);

  // A comment carrying the hashtag, on a gallery whose description does not.
  await db.run(
    `INSERT INTO "social.grain.comment" (uri, cid, did, indexed_at, created_at, subject, text)
     VALUES ($1, 'cid-cm', $2, 'i', '2026-04-02', $3, '#portland was great')`,
    [`at://${ALICE}/social.grain.comment/c1`, ALICE, `at://${BOB}/social.grain.gallery/b1`],
  );
});

afterAll(async () => {
  await server?.close();
});

describe("recent feed", () => {
  test("orders every visible gallery newest first", async () => {
    const { ids } = await feed("feed=recent&limit=50");
    expect(ids).toEqual([
      "a-unhidden",
      "a-new",
      "a-mid",
      "b1",
      "a-future",
      "f1",
      "e1",
      "d1",
      "a-old",
      "a-import",
    ]);
  });

  test("ranks a future createdAt by when it was indexed", async () => {
    // a-future claims 2099 but arrived 2026-03-01. If it sorted on created_at
    // it would head the feed forever; the sort_at column is what stops that.
    const { ids } = await feed("feed=recent&limit=50");
    expect(ids[0]).not.toBe("a-future");
    expect(ids.indexOf("a-future")).toBeGreaterThan(ids.indexOf("b1"));
    expect(ids.indexOf("a-future")).toBeLessThan(ids.indexOf("f1"));
  });

  test("leaves a backdated import in history rather than at the top", async () => {
    // a-import was indexed most recently of all (2026-07-01) but carries its
    // original 2020 post date, so it belongs at the bottom.
    const { ids } = await feed("feed=recent&limit=50");
    expect(ids.at(-1)).toBe("a-import");
  });

  test("omits galleries with no items", async () => {
    const { ids } = await feed("feed=recent&limit=50");
    expect(ids).not.toContain("a-empty");
  });

  test("omits galleries from taken-down repos", async () => {
    const { ids } = await feed("feed=recent&limit=50");
    expect(ids).not.toContain("c1");
  });

  test("omits labelled galleries, and restores one whose label was negated", async () => {
    const { ids } = await feed("feed=recent&limit=50");
    expect(ids).not.toContain("a-hidden");
    expect(ids).toContain("a-unhidden");
  });

  test("hides blocks in both directions and mutes in one, for a viewer", async () => {
    const { ids } = await feed("feed=recent&limit=50", ALICE);
    expect(ids).not.toContain("d1"); // Alice blocked Dave
    expect(ids).not.toContain("e1"); // Erin blocked Alice
    expect(ids).not.toContain("f1"); // Alice muted Frank
    expect(ids).toEqual(["a-unhidden", "a-new", "a-mid", "b1", "a-future", "a-old", "a-import"]);
  });

  test("pages through with the cursor", async () => {
    const first = await feed("feed=recent&limit=3");
    expect(first.ids).toEqual(["a-unhidden", "a-new", "a-mid"]);
    expect(first.cursor).toBeTruthy();

    const second = await feed(`feed=recent&limit=3&cursor=${encodeURIComponent(first.cursor!)}`);
    expect(second.ids).toEqual(["b1", "a-future", "f1"]);
  });
});

describe("following feed", () => {
  test("returns only galleries by accounts the actor follows", async () => {
    // Alice follows Bob, Dave, Erin and Frank. Dave and Erin are blocked and
    // Frank is muted, so following her own graph leaves just Bob.
    const { ids } = await feed(`feed=following&actor=${ALICE}&limit=50`);
    expect(ids).toEqual(["b1"]);
  });

  test("is empty without an actor", async () => {
    const { ids } = await feed("feed=following&limit=50");
    expect(ids).toEqual([]);
  });

  test("is empty for an actor who follows nobody", async () => {
    const { ids } = await feed(`feed=following&actor=${BOB}&limit=50`);
    expect(ids).toEqual([]);
  });
});

describe("hashtag feed", () => {
  test("matches the tag in a description or in a comment on the gallery", async () => {
    // a-mid carries #portland in its description; b1 only in a comment.
    const { ids } = await feed("feed=hashtag&tag=portland&limit=50");
    expect(ids).toEqual(["a-mid", "b1"]);
  });

  test("still applies the label and takedown filters", async () => {
    // Both a-hidden and c1 say "#portland" and neither may surface.
    const { ids } = await feed("feed=hashtag&tag=portland&limit=50");
    expect(ids).not.toContain("a-hidden");
    expect(ids).not.toContain("c1");
  });

  test("is empty for a tag nobody used", async () => {
    const { ids } = await feed("feed=hashtag&tag=antarctica&limit=50");
    expect(ids).toEqual([]);
  });

  test("is empty without a tag", async () => {
    const { ids } = await feed("feed=hashtag&limit=50");
    expect(ids).toEqual([]);
  });
});

describe("actor feed", () => {
  // Unlike /recent this orders on created_at, not sort_at, so a-future does
  // lead here. Worth knowing before changing either: a profile grid and the
  // home feed deliberately disagree about a clock-skewed gallery.
  const expected = ["a-future", "a-unhidden", "a-new", "a-mid", "a-old", "a-import"];

  test("returns the actor's own galleries, newest created first", async () => {
    const { ids } = await feed(`feed=actor&actor=${ALICE}&limit=50`);
    expect(ids).toEqual(expected);
  });

  test("accepts a handle in place of a did", async () => {
    const { ids } = await feed("feed=actor&actor=alice.test&limit=50");
    expect(ids).toEqual(expected);
  });

  test("is empty for a taken-down actor", async () => {
    const { ids } = await feed(`feed=actor&actor=${CAROL}&limit=50`);
    expect(ids).toEqual([]);
  });

  test("is empty without an actor", async () => {
    const { ids } = await feed("feed=actor&limit=50");
    expect(ids).toEqual([]);
  });
});

describe("camera feed", () => {
  test("matches raw EXIF strings that normalize to the same camera", async () => {
    // a-mid and b1 were shot on the same body but their EXIF make/model
    // strings differ; only normalizing both reaches the same set.
    const { ids } = await feed(`feed=camera&camera=${encodeURIComponent("Ricoh GR III")}&limit=50`);
    expect(ids).toEqual(["a-mid", "b1"]);
  });

  test("accepts the raw EXIF string as the parameter too", async () => {
    const { ids } = await feed(`feed=camera&camera=${encodeURIComponent(RICOH_B)}&limit=50`);
    expect(ids).toEqual(["a-mid", "b1"]);
  });

  test("still applies the takedown filter", async () => {
    // Carol shot c1 on the same Ricoh.
    const { ids } = await feed(`feed=camera&camera=${encodeURIComponent("Ricoh GR III")}&limit=50`);
    expect(ids).not.toContain("c1");
  });

  test("separates cameras that normalize differently", async () => {
    const { ids } = await feed(`feed=camera&camera=${encodeURIComponent("Nikon D600")}&limit=50`);
    expect(ids).toEqual(["a-new"]);
  });

  test("is empty for a camera nobody shot on", async () => {
    const { ids } = await feed(`feed=camera&camera=${encodeURIComponent("Canon EOS R5")}&limit=50`);
    expect(ids).toEqual([]);
  });

  test("is empty without a camera", async () => {
    const { ids } = await feed("feed=camera&limit=50");
    expect(ids).toEqual([]);
  });
});
