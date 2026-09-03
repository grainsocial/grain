import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startTestServer } from "@hatk/hatk/test";

const ALICE = "did:plc:alice";

let server: Awaited<ReturnType<typeof startTestServer>>;

/** Insert a photo and the exif row that attributes it to a camera. */
async function photo(
  db: any,
  opts: {
    id: string;
    make: string | null;
    model: string | null;
    createdAt: string;
    exif?: boolean;
  },
) {
  const uri = `at://${ALICE}/social.grain.photo/${opts.id}`;
  await db.run(
    `INSERT INTO "social.grain.photo" (uri, cid, did, indexed_at, photo, aspect_ratio, created_at)
     VALUES ($1, $2, $3, 'i', $4, '{"width":3,"height":2}', $5)`,
    [
      uri,
      `cid-${opts.id}`,
      ALICE,
      JSON.stringify({
        $type: "blob",
        ref: { $link: `bafy-${opts.id}` },
        mimeType: "image/jpeg",
        size: 1,
      }),
      opts.createdAt,
    ],
  );

  if (opts.exif === false) return uri;

  await db.run(
    `INSERT INTO "social.grain.photo.exif" (uri, cid, did, indexed_at, photo, created_at, make, model)
     VALUES ($1, $2, $3, 'i', $4, $5, $6, $7)`,
    [
      `at://${ALICE}/social.grain.photo.exif/${opts.id}`,
      `cid-e-${opts.id}`,
      ALICE,
      uri,
      opts.createdAt,
      opts.make,
      opts.model,
    ],
  );
  return uri;
}

beforeAll(async () => {
  server = await startTestServer();
  const { db } = server;

  await db.run(`INSERT INTO _repos (did, status, handle) VALUES ($1, 'active', 'alice.test')`, [
    ALICE,
  ]);

  // Two raw make/model pairs that normalize to the same camera. This is the
  // case the window function cannot see: it partitions on the raw pair.
  await photo(db, {
    id: "r1",
    make: "RICOH IMAGING COMPANY, LTD.",
    model: "GR III",
    createdAt: "2026-05-01",
  });
  await photo(db, {
    id: "r2",
    make: "RICOH IMAGING COMPANY, LTD.",
    model: "GR III",
    createdAt: "2026-05-03",
  });
  await photo(db, { id: "r3", make: "Ricoh", model: "GR III", createdAt: "2026-05-02" });
  await photo(db, { id: "r4", make: "Ricoh", model: "GR III", createdAt: "2026-05-04" });
  await photo(db, { id: "r5", make: "Ricoh", model: "GR III", createdAt: "2026-05-05" });

  // A camera with a single photo — the tile falls back to a one-up mosaic.
  await photo(db, { id: "a1", make: "Apple", model: "iPhone 14 Pro", createdAt: "2026-04-01" });

  // Exif with no photo record behind it: still counted, contributes no thumb.
  await db.run(
    `INSERT INTO "social.grain.photo.exif" (uri, cid, did, indexed_at, photo, created_at, make, model)
     VALUES ($1, 'cid-orphan', $2, 'i', $3, '2026-06-01', 'Nikon', 'FM2')`,
    [
      `at://${ALICE}/social.grain.photo.exif/orphan`,
      ALICE,
      `at://${ALICE}/social.grain.photo/missing`,
    ],
  );

  // Null make is not a camera at all.
  await photo(db, { id: "n1", make: null, model: "Mystery", createdAt: "2026-04-02" });
});

afterAll(async () => {
  await server?.close();
});

const getCameras = async () =>
  (await (await server.fetch("/xrpc/social.grain.unspecced.getCameras")).json()).cameras;

const byName = (cameras: any[], name: string) => cameras.find((c: any) => c.camera === name);

describe("getCameras", () => {
  test("merges raw make/model pairs that normalize to the same camera", async () => {
    const ricoh = byName(await getCameras(), "Ricoh GR III");
    expect(ricoh).toBeTruthy();
    expect(ricoh.photoCount).toBe(5);
  });

  test("excludes photos with no make or model", async () => {
    const cameras = await getCameras();
    expect(cameras.some((c: any) => c.camera.includes("Mystery"))).toBe(false);
  });

  test("carries at most four thumbnails, newest first across merged pairs", async () => {
    const ricoh = byName(await getCameras(), "Ricoh GR III");

    // r5, r4, r2, r3 by created_at desc — r2 comes from the other raw pair, so
    // this only holds if ordering is applied after the merge.
    expect(ricoh.thumbs).toHaveLength(4);
    expect(ricoh.thumbs.map((u: string) => u.match(/bafy-(\w+)/)![1])).toEqual([
      "r5",
      "r4",
      "r2",
      "r3",
    ]);
  });

  test("gives a single-photo camera a single thumbnail", async () => {
    const apple = byName(await getCameras(), "Apple iPhone 14 Pro");
    expect(apple.photoCount).toBe(1);
    expect(apple.thumbs).toHaveLength(1);
    expect(apple.thumbs[0]).toContain("bafy-a1");
  });

  test("counts a camera whose photo record is missing, with no thumbnails", async () => {
    const nikon = byName(await getCameras(), "Nikon FM2");
    expect(nikon.photoCount).toBe(1);
    expect(nikon.thumbs).toEqual([]);
  });

  test("orders cameras by photo count", async () => {
    const cameras = await getCameras();
    const counts = cameras.map((c: any) => c.photoCount);
    expect(counts).toEqual([...counts].sort((a: number, b: number) => b - a));
  });
});
