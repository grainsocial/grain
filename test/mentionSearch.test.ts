// parts.page.mention.search — the picker that parts.page embeds use to mention
// a grain user or link one of their galleries. One endpoint, two modes: with a
// `scope` it searches that account's galleries, without one it searches users.
//
// This file covers the browse mode — a scope with no query — which is pure SQL
// over rows inserted with `db.run`. The search-backed modes need records in the
// FTS index, which only `insertRecord` maintains, so they live in
// `test/search.test.ts` with its YAML fixtures.

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startTestServer } from "@hatk/hatk/test";

const ALICE = "did:plc:alice";
const CAROL = "did:plc:carol"; // taken down
const SERVICE = "at://did:plc:service/parts.page.mention.service/self";

let server: any;

const search = (query: string) =>
  `/xrpc/parts.page.mention.search?service=${encodeURIComponent(SERVICE)}&${query}`;

async function get(query: string) {
  const res = await server.fetch(search(query));
  expect(res.status).toBe(200);
  return (await res.json()).results;
}

async function gallery(opts: {
  id: string;
  did: string;
  title: string;
  description?: string | null;
  createdAt: string;
  photos?: string[];
  hidden?: boolean;
}) {
  const { db } = server;
  const uri = `at://${opts.did}/social.grain.gallery/${opts.id}`;
  await db.run(
    `INSERT INTO "social.grain.gallery" (uri, cid, did, indexed_at, title, description, created_at)
     VALUES ($1, $2, $3, 'i', $4, $5, $6)`,
    [uri, `cid-${opts.id}`, opts.did, opts.title, opts.description ?? null, opts.createdAt],
  );
  // Photos are listed with their position, and inserted in the reverse of it,
  // so the icon has to come from position 0 rather than from insert order.
  const photos = opts.photos ?? [`${opts.id}-p`];
  for (let i = photos.length - 1; i >= 0; i--) {
    const photoUri = `at://${opts.did}/social.grain.photo/${photos[i]}`;
    await db.run(
      `INSERT INTO "social.grain.photo" (uri, cid, did, indexed_at, photo, aspect_ratio, created_at)
       VALUES ($1, $2, $3, 'i', $4, '{"width":3,"height":2}', $5)`,
      [
        photoUri,
        `cid-${photos[i]}`,
        opts.did,
        JSON.stringify({
          $type: "blob",
          ref: { $link: `bafy-${photos[i]}` },
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
        `at://${opts.did}/social.grain.gallery.item/${photos[i]}`,
        `cid-i-${photos[i]}`,
        opts.did,
        opts.createdAt,
        uri,
        photoUri,
        i,
      ],
    );
  }
  if (opts.hidden) {
    await db.run(
      `INSERT INTO _labels (src, uri, val, neg, cts) VALUES ('did:plc:mod', $1, 'spam', 0, '2026-01-01')`,
      [uri],
    );
  }
  return uri;
}

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

  await gallery({
    id: "g1",
    did: ALICE,
    title: "Sunset",
    description: "orange",
    createdAt: "2026-03-01",
    photos: ["g1-cover", "g1-second"],
  });
  await gallery({ id: "g2", did: ALICE, title: "Harbour", createdAt: "2026-03-02" });
  await gallery({
    id: "g-empty",
    did: ALICE,
    title: "Nothing",
    createdAt: "2026-03-03",
    photos: [],
  });
  await gallery({
    id: "g-hidden",
    did: ALICE,
    title: "Hidden",
    createdAt: "2026-03-04",
    hidden: true,
  });
  await gallery({ id: "gc", did: CAROL, title: "Taken down", createdAt: "2026-03-05" });
});

afterAll(async () => await server?.close());

describe("browsing an account's galleries", () => {
  test("lists them newest first with a link and an embed for each", async () => {
    const results = await get(`scope=${encodeURIComponent(ALICE)}&search=`);
    expect(results.map((r: any) => r.name)).toEqual(["Harbour", "Sunset"]);

    const sunset = results.find((r: any) => r.name === "Sunset");
    expect(sunset).toMatchObject({
      uri: `at://${ALICE}/social.grain.gallery/g1`,
      description: "orange",
      href: `http://127.0.0.1:3000/profile/${ALICE}/gallery/g1`,
      embed: {
        src: `http://127.0.0.1:3000/embed/gallery/${ALICE}/g1`,
        aspectRatio: { width: 16, height: 9 },
      },
    });
  });

  test("takes the icon from the gallery's first photo by position", async () => {
    const results = await get(`scope=${encodeURIComponent(ALICE)}&search=`);
    const sunset = results.find((r: any) => r.name === "Sunset");
    expect(sunset.icon).toContain("bafy-g1-cover");
  });

  test("leaves out the description when there is none", async () => {
    const results = await get(`scope=${encodeURIComponent(ALICE)}&search=`);
    const harbour = results.find((r: any) => r.name === "Harbour");
    expect(harbour).not.toHaveProperty("description");
  });

  test("skips empty and hidden galleries", async () => {
    const names = (await get(`scope=${encodeURIComponent(ALICE)}&search=`)).map((r: any) => r.name);
    expect(names).not.toContain("Nothing");
    expect(names).not.toContain("Hidden");
  });

  test("skips a taken-down account entirely", async () => {
    expect(await get(`scope=${encodeURIComponent(CAROL)}&search=`)).toEqual([]);
  });

  test("is empty for an account with nothing to show", async () => {
    expect(await get("scope=did%3Aplc%3Anobody&search=")).toEqual([]);
  });

  test("honours the limit", async () => {
    const results = await get(`scope=${encodeURIComponent(ALICE)}&search=&limit=1`);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Harbour"); // the newest
  });
});

describe("searching users", () => {
  test("short-circuits a blank query without touching the index", async () => {
    expect(await get("search=")).toEqual([]);
    expect(await get("search=%20%20")).toEqual([]);
  });
});
