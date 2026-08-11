import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startTestServer } from "@hatk/hatk/test";

const GALLERY = "at://did:plc:alice/social.grain.gallery/g1";
const ALICE = "did:plc:alice";
const BOB = "did:plc:bob";
const CAROL = "did:plc:carol";
const DAVE = "did:plc:dave";

let server: Awaited<ReturnType<typeof startTestServer>>;

beforeAll(async () => {
  server = await startTestServer();
  const { db } = server;

  for (const [did, handle] of [
    [ALICE, "alice.test"],
    [BOB, "bob.test"],
    [CAROL, "carol.test"],
    [DAVE, "dave.test"],
  ]) {
    await db.run(`INSERT INTO _repos (did, status, handle) VALUES ($1, 'active', $2)`, [
      did,
      handle,
    ]);
  }

  // Dave deliberately has no grain profile — exercises the handle fallback.
  for (const [did, name] of [
    [ALICE, "Alice A"],
    [BOB, "Bob Ross"],
    [CAROL, "Carol Danvers"],
  ]) {
    await db.run(
      `INSERT INTO "social.grain.actor.profile" (uri, cid, did, indexed_at, display_name, created_at)
       VALUES ($1, $2, $3, '2026-01-01', $4, '2026-01-01')`,
      [`at://${did}/social.grain.actor.profile/self`, `cid-${did}`, did, name],
    );
  }

  await db.run(
    `INSERT INTO "social.grain.gallery" (uri, cid, did, indexed_at, title, created_at)
     VALUES ($1, 'cid-g1', $2, '2026-05-01', 'City Lights', '2026-05-01')`,
    [GALLERY, ALICE],
  );

  // Alice follows Bob and Carol, but not Dave.
  for (const subject of [BOB, CAROL]) {
    await db.run(
      `INSERT INTO "social.grain.graph.follow" (uri, cid, did, indexed_at, subject, created_at)
       VALUES ($1, 'cid-f', $2, 'i', $3, '2026-01-01')`,
      [`at://${ALICE}/social.grain.graph.follow/${subject}`, ALICE, subject],
    );
  }

  // Bob, Carol, Dave and Alice herself favorited the gallery.
  for (const [did, createdAt] of [
    [BOB, "2026-05-01"],
    [CAROL, "2026-05-02"],
    [DAVE, "2026-05-03"],
    [ALICE, "2026-05-04"],
  ]) {
    await db.run(
      `INSERT INTO "social.grain.favorite" (uri, cid, did, indexed_at, created_at, subject)
       VALUES ($1, $2, $3, 'i', $4, $5)`,
      [`at://${did}/social.grain.favorite/1`, `cid-fav-${did}`, did, createdAt, GALLERY],
    );
  }
});

afterAll(async () => {
  await server?.close();
});

const favoritesPath = (query = "") =>
  `/xrpc/social.grain.unspecced.getGalleryFavorites?gallery=${encodeURIComponent(GALLERY)}${query}`;

describe("getGalleryFavorites", () => {
  test("lists every account that favorited, most recent first", async () => {
    const res = await server.fetchAs(ALICE, favoritesPath());
    const body = await res.json();

    expect(body.totalCount).toBe(4);
    expect(body.items.map((i: any) => i.did)).toEqual([ALICE, DAVE, CAROL, BOB]);
  });

  test("falls back to the repo handle when there is no grain profile", async () => {
    const res = await server.fetchAs(ALICE, favoritesPath());
    const dave = (await res.json()).items.find((i: any) => i.did === DAVE);

    expect(dave.handle).toBe("dave.test");
    expect(dave.displayName).toBeFalsy();
  });

  test("reports the viewer's follow state for each account", async () => {
    const res = await server.fetchAs(ALICE, favoritesPath());
    const items = (await res.json()).items;

    expect(items.find((i: any) => i.did === BOB).viewer.following).toBeTruthy();
    expect(items.find((i: any) => i.did === DAVE).viewer.following).toBeFalsy();
  });

  test("paginates", async () => {
    const first = await (await server.fetchAs(ALICE, favoritesPath("&limit=2"))).json();
    expect(first.items.map((i: any) => i.did)).toEqual([ALICE, DAVE]);
    expect(first.cursor).toBeTruthy();

    const second = await (
      await server.fetchAs(ALICE, favoritesPath(`&limit=2&cursor=${first.cursor}`))
    ).json();
    expect(second.items.map((i: any) => i.did)).toEqual([CAROL, BOB]);
    expect(second.cursor).toBeFalsy();
  });

  test("works unauthenticated", async () => {
    const body = await (await server.fetch(favoritesPath())).json();
    expect(body.totalCount).toBe(4);
  });

  test("hides taken-down accounts from everyone, authed or not", async () => {
    await server.db.run(`UPDATE _repos SET status = 'takendown' WHERE did = $1`, [DAVE]);

    try {
      const authed = await (await server.fetchAs(ALICE, favoritesPath())).json();
      expect(authed.items.map((i: any) => i.did)).not.toContain(DAVE);
      expect(authed.totalCount).toBe(3);

      const anon = await (await server.fetch(favoritesPath())).json();
      expect(anon.items.map((i: any) => i.did)).not.toContain(DAVE);
      expect(anon.totalCount).toBe(3);
    } finally {
      await server.db.run(`UPDATE _repos SET status = 'active' WHERE did = $1`, [DAVE]);
    }
  });

  test("hides blocked accounts from the list and the count", async () => {
    await server.db.run(
      `INSERT INTO "social.grain.graph.block" (uri, cid, did, indexed_at, subject, created_at)
       VALUES ($1, 'cid-b', $2, 'i', $3, '2026-01-01')`,
      [`at://${ALICE}/social.grain.graph.block/1`, ALICE, DAVE],
    );

    try {
      const body = await (await server.fetchAs(ALICE, favoritesPath())).json();
      expect(body.items.map((i: any) => i.did)).not.toContain(DAVE);
      expect(body.totalCount).toBe(3);
    } finally {
      await server.db.run(`DELETE FROM "social.grain.graph.block" WHERE did = $1`, [ALICE]);
    }
  });
});

describe("gallery facepile", () => {
  const galleryPath = `/xrpc/social.grain.unspecced.getGallery?gallery=${encodeURIComponent(GALLERY)}`;

  test("returns only accounts the viewer follows, excluding the viewer", async () => {
    const res = await server.fetchAs(ALICE, galleryPath);
    const gallery = (await res.json()).gallery;

    expect(gallery.favCount).toBe(4);
    // Carol favorited after Bob, so she sorts first. Dave isn't followed and
    // Alice is the viewer — neither belongs in the facepile.
    expect(gallery.favedByFollowing.map((p: any) => p.did)).toEqual([CAROL, BOB]);
    expect(gallery.favedByFollowing[0].displayName).toBe("Carol Danvers");
  });

  test("omits taken-down and blocked accounts", async () => {
    await server.db.run(`UPDATE _repos SET status = 'takendown' WHERE did = $1`, [CAROL]);
    await server.db.run(
      `INSERT INTO "social.grain.graph.block" (uri, cid, did, indexed_at, subject, created_at)
       VALUES ($1, 'cid-b', $2, 'i', $3, '2026-01-01')`,
      [`at://${BOB}/social.grain.graph.block/1`, BOB, ALICE],
    );

    try {
      const gallery = (await (await server.fetchAs(ALICE, galleryPath)).json()).gallery;
      // Carol is taken down; Bob blocks Alice. Nobody eligible is left.
      expect(gallery.favedByFollowing).toBeUndefined();
    } finally {
      await server.db.run(`UPDATE _repos SET status = 'active' WHERE did = $1`, [CAROL]);
      await server.db.run(`DELETE FROM "social.grain.graph.block" WHERE did = $1`, [BOB]);
    }
  });

  test("is omitted for viewers who follow none of the favoriters", async () => {
    const res = await server.fetchAs(DAVE, galleryPath);
    expect((await res.json()).gallery.favedByFollowing).toBeUndefined();
  });

  test("is omitted for unauthenticated requests", async () => {
    const res = await server.fetch(galleryPath);
    expect((await res.json()).gallery.favedByFollowing).toBeUndefined();
  });
});
