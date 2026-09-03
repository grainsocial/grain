// getGallery — the deep link to a single gallery — and the EXIF that the
// shared gallery hydrator attaches to each photo.
//
// EXIF numbers are stored scaled by a million, because atproto lexicons have no
// decimal type — the client multiplies on the way in (app/lib/utils/image-resize.ts)
// and the hydrator divides on the way out. ISO is scaled too, despite being a
// whole number already. What a reader wants is "1/250s" and "f/2.8", so the
// formatting is where the meaning is.

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startTestServer } from "@hatk/hatk/test";

const ALICE = "did:plc:alice";
const CAROL = "did:plc:carol"; // taken down

const SCALE = 1_000_000;

let server: any;

async function get(path: string) {
  return server.fetch(path);
}

async function getOk(path: string) {
  const res = await get(path);
  expect(res.status).toBe(200);
  return res.json();
}

const galleryPath = (uri: string) =>
  `/xrpc/social.grain.unspecced.getGallery?gallery=${encodeURIComponent(uri)}`;

beforeAll(async () => {
  server = await startTestServer();
  const { db } = server;

  for (const [did, handle, status] of [
    [ALICE, "alice.test", "active"],
    [CAROL, "carol.test", "takendown"],
  ]) {
    await db.run(`INSERT INTO _repos (did, status, handle) VALUES ($1, $2, $3)`, [
      did,
      status,
      handle,
    ]);
  }

  const gallery = async (did: string, id: string) => {
    await db.run(
      `INSERT INTO "social.grain.gallery" (uri, cid, did, indexed_at, title, created_at)
       VALUES ($1, $2, $3, 'i', $4, '2026-03-01')`,
      [`at://${did}/social.grain.gallery/${id}`, `cid-${id}`, did, id],
    );
  };
  const photo = async (did: string, galleryId: string, id: string, exif?: Record<string, any>) => {
    const photoUri = `at://${did}/social.grain.photo/${id}`;
    await db.run(
      `INSERT INTO "social.grain.photo" (uri, cid, did, indexed_at, photo, aspect_ratio, created_at)
       VALUES ($1, $2, $3, 'i', $4, '{"width":3,"height":2}', '2026-03-01')`,
      [
        photoUri,
        `cid-${id}`,
        did,
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
       VALUES ($1, $2, $3, 'i', '2026-03-01', $4, $5, 0)`,
      [
        `at://${did}/social.grain.gallery.item/${id}`,
        `cid-i-${id}`,
        did,
        `at://${did}/social.grain.gallery/${galleryId}`,
        photoUri,
      ],
    );
    if (exif) {
      const cols = Object.keys(exif);
      await db.run(
        `INSERT INTO "social.grain.photo.exif" (uri, cid, did, indexed_at, photo, created_at${cols.map((c) => `, ${c}`).join("")})
         VALUES ($1, $2, $3, 'i', $4, '2026-03-01'${cols.map((_, i) => `, $${i + 5}`).join("")})`,
        [
          `at://${did}/social.grain.photo.exif/${id}`,
          `cid-e-${id}`,
          did,
          photoUri,
          ...cols.map((c) => exif[c]),
        ],
      );
    }
  };

  await gallery(ALICE, "g1");
  await photo(ALICE, "g1", "p-full", {
    make: "RICOH IMAGING COMPANY, LTD.",
    model: "GR III",
    lens_make: "Ricoh",
    lens_model: "18.3mm f/2.8",
    // A fast shutter, a wide aperture and a 28mm-equivalent lens.
    exposure_time: Math.round(SCALE / 250),
    f_number: 2.8 * SCALE,
    focal_length_in35mm_format: 28 * SCALE,
    // ISO is scaled on the way in too, like the rest — see image-resize.ts.
    i_s_o: 400 * SCALE,
    flash: "No flash",
    date_time_original: "2026-02-14T10:00:00Z",
  });

  await gallery(ALICE, "g2");
  // A long exposure, where the shutter speed is a whole number of seconds.
  await photo(ALICE, "g2", "p-long", {
    make: "Sony",
    model: "ILCE-7M3",
    exposure_time: 4 * SCALE,
    f_number: 11 * SCALE,
    focal_length_in35mm_format: 35 * SCALE,
  });

  await gallery(ALICE, "g3");
  await photo(ALICE, "g3", "p-bare"); // no EXIF record at all

  await gallery(CAROL, "gc");
  await photo(CAROL, "gc", "p-c");
});

afterAll(async () => await server?.close());

describe("getGallery", () => {
  test("returns a gallery by its at:// uri", async () => {
    const { gallery } = await getOk(galleryPath(`at://${ALICE}/social.grain.gallery/g1`));
    expect(gallery.uri).toBe(`at://${ALICE}/social.grain.gallery/g1`);
    expect(gallery.creator.did).toBe(ALICE);
    expect(gallery.items).toHaveLength(1);
  });

  test("accepts a handle in the uri's authority position", async () => {
    const { gallery } = await getOk(galleryPath("at://alice.test/social.grain.gallery/g1"));
    expect(gallery.uri).toBe(`at://${ALICE}/social.grain.gallery/g1`);
  });

  test("refuses a gallery that does not exist", async () => {
    const res = await get(galleryPath(`at://${ALICE}/social.grain.gallery/nope`));
    expect(res.status).toBe(400);
  });

  test("refuses a gallery from a taken-down account", async () => {
    // A deep link must not bypass what every feed already hides. In practice
    // hatk's `getRecords` already excludes taken-down repos, so the row never
    // arrives and the "not found" above fires first — the handler's own
    // takedown check is unreachable today and removing it fails nothing. It is
    // defence in depth against `getRecords` changing, not the thing doing the
    // work here.
    const res = await get(galleryPath(`at://${CAROL}/social.grain.gallery/gc`));
    expect(res.status).toBe(400);
  });
});

describe("EXIF hydration", () => {
  const exifOf = async (id: string) =>
    (await getOk(galleryPath(`at://${ALICE}/social.grain.gallery/${id}`))).gallery.items[0].exif;

  test("renders a fast shutter as a fraction of a second", async () => {
    expect((await exifOf("g1")).exposureTime).toBe("1/250s");
  });

  test("renders a long exposure in whole seconds", async () => {
    expect((await exifOf("g2")).exposureTime).toBe("4s");
  });

  test("renders the aperture as an f-number to one decimal", async () => {
    expect((await exifOf("g1")).fNumber).toBe("f/2.8");
    expect((await exifOf("g2")).fNumber).toBe("f/11.0");
  });

  test("renders the focal length in millimetres", async () => {
    expect((await exifOf("g1")).focalLengthIn35mmFormat).toBe("28mm");
    expect((await exifOf("g2")).focalLengthIn35mmFormat).toBe("35mm");
  });

  test("passes through the fields that need no conversion", async () => {
    expect(await exifOf("g1")).toMatchObject({
      make: "RICOH IMAGING COMPANY, LTD.",
      model: "GR III",
      lensMake: "Ricoh",
      lensModel: "18.3mm f/2.8",
      iSO: 400,
      flash: "No flash",
    });
  });

  test("leaves out the fields a photo did not record", async () => {
    const exif = await exifOf("g2");
    expect(exif.iSO).toBeUndefined();
    expect(exif.lensMake).toBeUndefined();
    expect(exif.flash).toBeUndefined();
  });

  test("attaches no exif at all to a photo that has none", async () => {
    const { gallery } = await getOk(galleryPath(`at://${ALICE}/social.grain.gallery/g3`));
    expect(gallery.items[0].exif).toBeUndefined();
  });
});
