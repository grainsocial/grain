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
  await gallery(db, {
    id: "p1",
    createdAt: "2026-05-01",
    h3: "8a28f002358ffff",
    locality: "Portland",
    region: "Oregon",
    country: "US",
    items: { p1b: 1, p1a: 0 },
  });
  await gallery(db, {
    id: "p2",
    createdAt: "2026-05-02",
    h3: "8a28f002358ffff",
    locality: "Portland",
    region: "Oregon",
    country: "US",
    items: { p2a: 0 },
  });
  await gallery(db, {
    id: "p3",
    createdAt: "2026-05-03",
    h3: "8a28f002358ffff",
    locality: "Portland",
    region: "Oregon",
    country: "US",
    items: { p3b: 1, p3a: 0 },
  });
  await gallery(db, {
    id: "p4",
    createdAt: "2026-05-04",
    h3: "8a28f00d8227fff",
    locality: "Portland",
    region: "Oregon",
    country: "US",
    items: { p4a: 0 },
  });
  // Newest, but empty: it takes a thumbnail slot and yields nothing.
  await gallery(db, {
    id: "p5",
    createdAt: "2026-05-05",
    h3: "8a28f002358ffff",
    locality: "Portland",
    region: "Oregon",
    country: "US",
  });

  // A second place, to prove grouping splits on the address key.
  await gallery(db, {
    id: "n1",
    createdAt: "2026-05-06",
    h3: "8a2a1072b59ffff",
    locality: "New York",
    region: "New York",
    country: "US",
    items: { n1a: 0 },
  });

  // Lisbon, as the geocoder actually returns it: some galleries carry a region
  // and some do not. Keyed verbatim these are two places.
  await gallery(db, {
    id: "l1",
    createdAt: "2026-05-07",
    h3: "8a3969a40a47fff",
    locality: "Lisbon",
    country: "PT",
    items: { l1a: 0 },
  });
  await gallery(db, {
    id: "l2",
    createdAt: "2026-05-08",
    h3: "8a3969a40a47fff",
    locality: "Lisbon",
    country: "PT",
    items: { l2a: 0 },
  });
  await gallery(db, {
    id: "l3",
    createdAt: "2026-05-09",
    h3: "8a3969a41b0ffff",
    locality: "Lisbon",
    region: "Lisbon",
    country: "PT",
    items: { l3a: 0 },
  });

  // Springfield is the ambiguous case the fold must refuse: a region-less group
  // with two region-bearing candidates in the same country.
  await gallery(db, {
    id: "s1",
    createdAt: "2026-05-10",
    h3: "8a2a1072b59ffff",
    locality: "Springfield",
    region: "Illinois",
    country: "US",
    items: { s1a: 0 },
  });
  await gallery(db, {
    id: "s2",
    createdAt: "2026-05-11",
    h3: "8a2a1072b5bffff",
    locality: "Springfield",
    region: "Missouri",
    country: "US",
    items: { s2a: 0 },
  });
  await gallery(db, {
    id: "s3",
    createdAt: "2026-05-12",
    h3: "8a2a1072b5affff",
    locality: "Springfield",
    country: "US",
    items: { s3a: 0 },
  });
});

afterAll(async () => {
  await server?.close();
});

const getLocations = async () =>
  (await (await server.fetch("/xrpc/social.grain.unspecced.getLocations")).json()).locations;

const byName = (locations: any[], name: string) => locations.find((l: any) => l.name === name);

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

  test("folds a region-less group into its only region-bearing twin", async () => {
    const locations = await getLocations();
    const lisbons = locations.filter((l: any) => l.name.startsWith("Lisbon"));

    expect(lisbons).toHaveLength(1);
    expect(lisbons[0].galleryCount).toBe(3);
    // The commoner spelling wins: two galleries say "Lisbon, PT", one says
    // "Lisbon, Lisbon, PT".
    expect(lisbons[0].name).toBe("Lisbon, PT");
    // Cells from both sides of the merge are kept.
    expect(lisbons[0].h3Cells).toHaveLength(2);
  });

  test("re-ranks thumbnails across a fold rather than concatenating", async () => {
    const lisbon = byName(await getLocations(), "Lisbon, PT");
    // l3 is newest and came from the region-bearing group.
    expect(lisbon.thumbs.map(cid)).toEqual(["l3a", "l2a", "l1a"]);
  });

  test("refuses to fold when the region-less group is ambiguous", async () => {
    const names = (await getLocations()).map((l: any) => l.name);
    // Two Springfields with regions means the bare one cannot be attributed.
    expect(names).toContain("Springfield, Illinois, US");
    expect(names).toContain("Springfield, Missouri, US");
    expect(names).toContain("Springfield, US");
  });

  test("pins returns every place, lean, for the map", async () => {
    const res = await server.fetch("/xrpc/social.grain.unspecced.getLocations?pins=true");
    const pins = (await res.json()).locations;
    const full = await getLocations();

    expect(pins.length).toBe(full.length);
    expect(Object.keys(pins[0]).sort()).toEqual(["galleryCount", "h3Index", "name"]);
    // The expensive fields are exactly what pins drops.
    expect(pins[0].thumbs).toBeUndefined();
    expect(pins[0].h3Cells).toBeUndefined();
  });

  test("does not leak the internal gallery list into the response", async () => {
    const portland = byName(await getLocations(), "Portland, Oregon, US");
    expect(portland.galleryUris).toBeUndefined();
  });
});
