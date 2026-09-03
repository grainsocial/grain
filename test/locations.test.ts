import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startTestServer } from "@hatk/hatk/test";

const ALICE = "did:plc:alice";

let server: Awaited<ReturnType<typeof startTestServer>>;

async function gallery(
  db: any,
  opts: {
    id: string;
    createdAt: string;
    h3: string;
    locality?: string;
    region?: string;
    country?: string;
    /** photo id -> position, to prove the cover is position 0, not insert order */
    items?: Record<string, number>;
  },
) {
  const uri = `at://${ALICE}/social.grain.gallery/${opts.id}`;
  await db.run(
    `INSERT INTO "social.grain.gallery" (uri, cid, did, indexed_at, title, location, address, created_at)
     VALUES ($1, $2, $3, 'i', $4, $5, $6, $7)`,
    [
      uri,
      `cid-${opts.id}`,
      ALICE,
      opts.id,
      JSON.stringify({ name: opts.locality ?? "Somewhere", value: opts.h3 }),
      JSON.stringify({
        locality: opts.locality ?? null,
        region: opts.region ?? null,
        country: opts.country ?? null,
      }),
      opts.createdAt,
    ],
  );

  for (const [photoId, position] of Object.entries(opts.items ?? {})) {
    const photoUri = `at://${ALICE}/social.grain.photo/${photoId}`;
    await db.run(
      `INSERT INTO "social.grain.photo" (uri, cid, did, indexed_at, photo, aspect_ratio, created_at)
       VALUES ($1, $2, $3, 'i', $4, '{"width":3,"height":2}', $5)`,
      [
        photoUri,
        `cid-${photoId}`,
        ALICE,
        JSON.stringify({
          $type: "blob",
          ref: { $link: `bafy-${photoId}` },
          mimeType: "image/jpeg",
          size: 1,
        }),
        opts.createdAt,
      ],
    );
    await db.run(
      `INSERT INTO "social.grain.gallery.item" (uri, cid, did, indexed_at, created_at, gallery, item, position)
       VALUES ($1, $2, $3, 'i', $4, $5, $6, $7)`,
      [
        `at://${ALICE}/social.grain.gallery.item/${opts.id}-${photoId}`,
        `cid-i-${photoId}`,
        ALICE,
        opts.createdAt,
        uri,
        photoUri,
        position,
      ],
    );
  }
  return uri;
}

beforeAll(async () => {
  server = await startTestServer();
  const { db } = server;

  await db.run(`INSERT INTO _repos (did, status, handle) VALUES ($1, 'active', 'alice.test')`, [
    ALICE,
  ]);

  // Five Portland galleries across two cells, so only the newest four can
  // supply thumbnails and the densest cell has to win as the canonical one.
  await gallery(db, { id: "p1", createdAt: "2026-05-01", h3: "8a28f002358ffff", locality: "Portland", region: "Oregon", country: "US", items: { p1b: 1, p1a: 0 } });
  await gallery(db, { id: "p2", createdAt: "2026-05-02", h3: "8a28f002358ffff", locality: "Portland", region: "Oregon", country: "US", items: { p2a: 0 } });
  await gallery(db, { id: "p3", createdAt: "2026-05-03", h3: "8a28f002358ffff", locality: "Portland", region: "Oregon", country: "US", items: { p3b: 1, p3a: 0 } });
  await gallery(db, { id: "p4", createdAt: "2026-05-04", h3: "8a28f00d8227fff", locality: "Portland", region: "Oregon", country: "US", items: { p4a: 0 } });
  // Newest, but empty: it takes a thumbnail slot and yields nothing.
  await gallery(db, { id: "p5", createdAt: "2026-05-05", h3: "8a28f002358ffff", locality: "Portland", region: "Oregon", country: "US" });

  // A second place, to prove grouping splits on the address key.
  await gallery(db, { id: "n1", createdAt: "2026-05-06", h3: "8a2a1072b59ffff", locality: "New York", region: "New York", country: "US", items: { n1a: 0 } });
});

afterAll(async () => {
  await server?.close();
});

const getLocations = async () =>
  (await (await server.fetch("/xrpc/social.grain.unspecced.getLocations")).json()).locations;

const byName = (locations: any[], name: string) =>
  locations.find((l: any) => l.name === name);

const cid = (url: string) => url.match(/bafy-(\w+)/)![1];

describe("getLocations", () => {
  test("groups galleries by address, not by H3 cell", async () => {
    const portland = byName(await getLocations(), "Portland, Oregon, US");
    expect(portland).toBeTruthy();
    // Five galleries across two different cells, still one place.
    expect(portland.galleryCount).toBe(5);
    expect(portland.h3Cells).toHaveLength(2);
  });

  test("picks the densest cell as canonical", async () => {
    const portland = byName(await getLocations(), "Portland, Oregon, US");
    expect(portland.h3Index).toBe("8a28f002358ffff");
    expect(portland.h3Cells[0]).toBe("8a28f002358ffff");
  });

  test("takes each thumbnail from its gallery's position-0 photo", async () => {
    const portland = byName(await getLocations(), "Portland, Oregon, US");
    // p3 has two photos; p3a sits at position 0 while p3b was inserted first.
    expect(portland.thumbs.map(cid)).toContain("p3a");
    expect(portland.thumbs.map(cid)).not.toContain("p3b");
  });

  test("draws thumbnails from the newest galleries, skipping empty ones", async () => {
    const portland = byName(await getLocations(), "Portland, Oregon, US");
    // Newest four are p5, p4, p3, p2 — p5 has no photos, so three thumbs.
    expect(portland.thumbs.map(cid)).toEqual(["p4a", "p3a", "p2a"]);
    // p1 is the fifth-newest and never gets a slot, photos or not.
    expect(portland.thumbs.map(cid)).not.toContain("p1a");
  });

  test("separates places with different addresses", async () => {
    const locations = await getLocations();
    const ny = byName(locations, "New York, New York, US");
    expect(ny.galleryCount).toBe(1);
    expect(ny.thumbs.map(cid)).toEqual(["n1a"]);
  });

  test("orders places by gallery count", async () => {
    const counts = (await getLocations()).map((l: any) => l.galleryCount);
    expect(counts).toEqual([...counts].sort((a: number, b: number) => b - a));
  });

  test("does not leak the internal gallery list into the response", async () => {
    const portland = byName(await getLocations(), "Portland, Oregon, US");
    expect(portland.galleryUris).toBeUndefined();
  });
});
