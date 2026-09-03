// deleteGallery and deleteAccount. Both work by asking the user's PDS to delete
// records; the appview only follows along. That makes them untestable through
// `server.fetch` — a real PDS write needs OAuth config the harness has none of,
// and the request 500s before reaching anything interesting.
//
// `defineProcedure` returns its handler untouched, the same as `defineHook`, so
// these call it directly with a real database and a `deleteRecord` that records
// what would have been asked for. What is being checked is *which* records each
// one decides to delete, and in what order — which is the whole of the logic.

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startTestServer } from "@hatk/hatk/test";
import deleteAccount from "../server/xrpc/deleteAccount.ts";
import deleteGallery from "../server/xrpc/deleteGallery.ts";

const ALICE = "did:plc:alice";
const BOB = "did:plc:bob";

const GA = `at://${ALICE}/social.grain.gallery/ga`; // Alice's, with everything hanging off it
const GB = `at://${ALICE}/social.grain.gallery/gb`; // Alice's, untouched by the tests
const GBOB = `at://${BOB}/social.grain.gallery/gbob`; // not Alice's

let server: any;

/** Runs a procedure and reports the deleteRecord calls it made. */
async function run(
  proc: { handler: (ctx: any) => Promise<unknown> },
  input: unknown,
  opts: { viewer?: string; failOn?: (collection: string, rkey: string) => boolean } = {},
) {
  const deleted: Array<{ collection: string; rkey: string }> = [];
  const ctx = {
    db: server.db,
    input,
    viewer: opts.viewer === undefined ? { did: ALICE } : { did: opts.viewer },
    deleteRecord: async (collection: string, rkey: string) => {
      if (opts.failOn?.(collection, rkey)) throw new Error("PDS refused");
      deleted.push({ collection, rkey });
    },
    ok: (v: unknown) => v,
  };
  await proc.handler(ctx);
  return deleted;
}

const rkeysFor = (deleted: Array<{ collection: string; rkey: string }>, collection: string) =>
  deleted.filter((d) => d.collection === collection).map((d) => d.rkey);

beforeAll(async () => {
  server = await startTestServer();
  const { db } = server;

  await db.run(
    `CREATE TABLE IF NOT EXISTS _mutes (
       did TEXT NOT NULL, subject TEXT NOT NULL, created_at TEXT NOT NULL,
       PRIMARY KEY (did, subject)
     )`,
  );

  for (const [did, handle] of [
    [ALICE, "alice.test"],
    [BOB, "bob.test"],
  ]) {
    await db.run(`INSERT INTO _repos (did, status, handle) VALUES ($1, 'active', $2)`, [
      did,
      handle,
    ]);
  }

  for (const [uri, did, id] of [
    [GA, ALICE, "ga"],
    [GB, ALICE, "gb"],
    [GBOB, BOB, "gbob"],
  ] as [string, string, string][]) {
    await db.run(
      `INSERT INTO "social.grain.gallery" (uri, cid, did, indexed_at, title, created_at)
       VALUES ($1, $2, $3, 'i', $4, '2026-01-01')`,
      [uri, `cid-${id}`, did, id],
    );
  }

  // Two photos in GA, one of them with an EXIF record.
  for (const [id, withExif] of [
    ["p1", true],
    ["p2", false],
  ] as [string, boolean][]) {
    const photoUri = `at://${ALICE}/social.grain.photo/${id}`;
    await db.run(
      `INSERT INTO "social.grain.photo" (uri, cid, did, indexed_at, photo, aspect_ratio, created_at)
       VALUES ($1, $2, $3, 'i', $4, '{"width":3,"height":2}', '2026-01-01')`,
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
       VALUES ($1, $2, $3, 'i', '2026-01-01', $4, $5, 0)`,
      [`at://${ALICE}/social.grain.gallery.item/i-${id}`, `cid-i-${id}`, ALICE, GA, photoUri],
    );
    if (withExif) {
      await db.run(
        `INSERT INTO "social.grain.photo.exif" (uri, cid, did, indexed_at, photo, created_at, make, model)
         VALUES ($1, $2, $3, 'i', $4, '2026-01-01', 'Ricoh', 'GR III')`,
        [`at://${ALICE}/social.grain.photo.exif/e-${id}`, `cid-e-${id}`, ALICE, photoUri],
      );
    }
  }

  // Bob favorited and commented on Alice's gallery, and Alice favorited her own.
  await db.run(
    `INSERT INTO "social.grain.favorite" (uri, cid, did, indexed_at, created_at, subject)
     VALUES ($1, 'cid-fb', $2, 'i', '2026-01-02', $3)`,
    [`at://${BOB}/social.grain.favorite/fb`, BOB, GA],
  );
  await db.run(
    `INSERT INTO "social.grain.favorite" (uri, cid, did, indexed_at, created_at, subject)
     VALUES ($1, 'cid-fa', $2, 'i', '2026-01-03', $3)`,
    [`at://${ALICE}/social.grain.favorite/fa`, ALICE, GA],
  );
  await db.run(
    `INSERT INTO "social.grain.comment" (uri, cid, did, indexed_at, created_at, subject, text)
     VALUES ($1, 'cid-cb', $2, 'i', '2026-01-04', $3, 'nice')`,
    [`at://${BOB}/social.grain.comment/cb`, BOB, GA],
  );

  // State that deleteAccount is meant to clear, and state it is meant to keep.
  await db.run(`INSERT INTO _mutes (did, subject, created_at) VALUES ($1, $2, 'i')`, [ALICE, BOB]);
  await db.run(`INSERT INTO _preferences (did, key, value) VALUES ($1, 'x', '1')`, [ALICE]);
  await db.run(`INSERT INTO _mutes (did, subject, created_at) VALUES ($1, $2, 'i')`, [BOB, ALICE]);
  await db.run(`INSERT INTO _preferences (did, key, value) VALUES ($1, 'x', '1')`, [BOB]);
  await db.run(
    `INSERT INTO _oauth_sessions (did, pds_endpoint, access_token, dpop_jkt)
     VALUES ($1, 'https://pds.example', 'tok', 'jkt')`,
    [ALICE],
  );
});

afterAll(async () => await server?.close());

describe("deleteGallery", () => {
  test("deletes the gallery and everything hanging off it", async () => {
    const deleted = await run(deleteGallery, { rkey: "ga" });
    expect(rkeysFor(deleted, "social.grain.gallery")).toEqual(["ga"]);
    expect(rkeysFor(deleted, "social.grain.photo").sort()).toEqual(["p1", "p2"]);
    expect(rkeysFor(deleted, "social.grain.gallery.item").sort()).toEqual(["i-p1", "i-p2"]);
    expect(rkeysFor(deleted, "social.grain.photo.exif")).toEqual(["e-p1"]);
  });

  test("deletes other people's favorites and comments on it too", async () => {
    // They live in their authors' repos, so the delete will usually fail — but
    // it is attempted, because leaving them behind orphans them in the index.
    const deleted = await run(deleteGallery, { rkey: "ga" });
    expect(rkeysFor(deleted, "social.grain.favorite").sort()).toEqual(["fa", "fb"]);
    expect(rkeysFor(deleted, "social.grain.comment")).toEqual(["cb"]);
  });

  test("deletes the gallery last, after its contents", async () => {
    // An orphaned item visible in the appview between deletes is worse than a
    // gallery that briefly has nothing in it.
    const deleted = await run(deleteGallery, { rkey: "ga" });
    const galleryAt = deleted.findIndex((d) => d.collection === "social.grain.gallery");
    expect(galleryAt).toBe(deleted.length - 1);
  });

  test("carries on when a favorite or comment cannot be deleted", async () => {
    // Bob's records are in Bob's repo, so his PDS will refuse. Alice's gallery
    // still has to go.
    const deleted = await run(
      deleteGallery,
      { rkey: "ga" },
      { failOn: (c) => c === "social.grain.favorite" || c === "social.grain.comment" },
    );
    expect(rkeysFor(deleted, "social.grain.favorite")).toEqual([]);
    expect(rkeysFor(deleted, "social.grain.gallery")).toEqual(["ga"]);
  });

  test("deletes a gallery that holds nothing", async () => {
    const deleted = await run(deleteGallery, { rkey: "gb" });
    expect(deleted).toEqual([{ collection: "social.grain.gallery", rkey: "gb" }]);
  });

  test("refuses an rkey the viewer does not own", async () => {
    // The handler builds the uri from the viewer's own did, so naming someone
    // else's rkey just addresses a gallery of yours that does not exist. That
    // construction, not the query's `AND did = $2`, is what makes this safe —
    // the extra condition cannot be violated through this interface, and
    // removing it changes nothing.
    await expect(run(deleteGallery, { rkey: "gbob" })).rejects.toThrow("Gallery not found");
    await expect(run(deleteGallery, { rkey: "nope" })).rejects.toThrow("Gallery not found");
  });

  test("requires a session", async () => {
    await expect(
      deleteGallery.handler({
        db: server.db,
        input: { rkey: "ga" },
        viewer: null,
        deleteRecord: async () => {},
        ok: (v: unknown) => v,
      }),
    ).rejects.toThrow("Authentication required");
  });
});

describe("deleteAccount", () => {
  test("deletes every grain record the account owns", async () => {
    const deleted = await run(deleteAccount, {});
    const byCollection = new Set(deleted.map((d) => d.collection));
    expect(byCollection).toContain("social.grain.gallery");
    expect(byCollection).toContain("social.grain.photo");
    expect(byCollection).toContain("social.grain.photo.exif");
    expect(byCollection).toContain("social.grain.gallery.item");
    expect(byCollection).toContain("social.grain.favorite");
    // Alice owns two galleries and one favorite; Bob's records are not hers.
    expect(rkeysFor(deleted, "social.grain.gallery").sort()).toEqual(["ga", "gb"]);
    expect(rkeysFor(deleted, "social.grain.favorite")).toEqual(["fa"]);
    expect(rkeysFor(deleted, "social.grain.comment")).toEqual([]);
  });

  test("deletes children before their parents", async () => {
    const deleted = await run(deleteAccount, {});
    const first = (c: string) => deleted.findIndex((d) => d.collection === c);
    expect(first("social.grain.photo.exif")).toBeLessThan(first("social.grain.photo"));
    expect(first("social.grain.gallery.item")).toBeLessThan(first("social.grain.gallery"));
  });

  test("carries on past a record the PDS will not delete", async () => {
    const deleted = await run(
      deleteAccount,
      {},
      {
        failOn: (c) => c === "social.grain.photo",
      },
    );
    expect(rkeysFor(deleted, "social.grain.photo")).toEqual([]);
    expect(rkeysFor(deleted, "social.grain.gallery").sort()).toEqual(["ga", "gb"]);
  });

  test("clears the account's own server-side state and nobody else's", async () => {
    await run(deleteAccount, {});
    const { db } = server;
    expect(await db.query(`SELECT * FROM _mutes WHERE did = $1`, [ALICE])).toEqual([]);
    expect(await db.query(`SELECT * FROM _preferences WHERE did = $1`, [ALICE])).toEqual([]);
    expect(await db.query(`SELECT * FROM _oauth_sessions WHERE did = $1`, [ALICE])).toEqual([]);

    // Bob's rows are untouched.
    expect(await db.query(`SELECT * FROM _mutes WHERE did = $1`, [BOB])).toHaveLength(1);
    expect(await db.query(`SELECT * FROM _preferences WHERE did = $1`, [BOB])).toHaveLength(1);
  });

  test("requires a session", async () => {
    await expect(
      deleteAccount.handler({ db: server.db, input: {}, viewer: null, ok: (v: unknown) => v }),
    ).rejects.toThrow("Authentication required");
  });
});
