// The location feed, which is really three lookups behind one endpoint:
//
//   1. a display-name query that guesses how "A, B, C" splits into
//      locality/region/country and unions every reading that could match,
//   2. a city-level H3 query (resolution <= 5) filtered in JS and paginated by
//      hand, because SQLite has no H3 functions,
//   3. a venue-level H3 query (resolution > 5) that matches the cell exactly.
//
// The name path is the interesting one — its comments describe several real
// places that motivated each interpretation, so those are the cases here.

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startTestServer } from "@hatk/hatk/test";

const ALICE = "did:plc:alice";
const BOB = "did:plc:bob";
const CAROL = "did:plc:carol"; // taken down

// Real H3 indices. SEA_A and SEA_B are distinct venues inside one city cell.
const SEA_5 = "8528d543fffffff";
const SEA_A = "8a28d542d527fff";
const SEA_B = "8a28d542d51ffff";
const DC_10 = "8a2aa845ad17fff";
const NYC_10 = "8a2a10728907fff";
const TOKYO_10 = "8a2f5aad80cffff";
const PDX_10 = "8a28f002358ffff";
const ATHENS_10 = "8a1eda743a8ffff";

let server: Awaited<ReturnType<typeof startTestServer>>;

async function gallery(opts: {
  id: string;
  did?: string;
  createdAt: string;
  /** `location.value` — the H3 cell. */
  cell: string;
  /** `location.name` — the raw label, which may be all a gallery has. */
  label?: string;
  locality?: string | null;
  region?: string | null;
  country?: string | null;
  /** Omit the structured address entirely. */
  noAddress?: boolean;
}) {
  const { db } = server;
  const did = opts.did ?? ALICE;
  const uri = `at://${did}/social.grain.gallery/${opts.id}`;
  await db.run(
    `INSERT INTO "social.grain.gallery" (uri, cid, did, indexed_at, title, location, address, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      uri,
      `cid-${opts.id}`,
      did,
      opts.createdAt,
      opts.id,
      JSON.stringify({ name: opts.label ?? opts.locality ?? "Somewhere", value: opts.cell }),
      opts.noAddress
        ? null
        : JSON.stringify({
            locality: opts.locality ?? null,
            region: opts.region ?? null,
            country: opts.country ?? null,
          }),
      opts.createdAt,
    ],
  );

  const photoId = `${opts.id}-p`;
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
  return uri;
}

async function feed(query: string, as?: string) {
  const path = `/xrpc/dev.hatk.getFeed?feed=location&${query}`;
  const res = as ? await server.fetchAs(as, path) : await server.fetch(path);
  expect(res.status).toBe(200);
  const body = await res.json();
  return {
    ids: (body.items ?? []).map((i: any) => i.uri.split("/").pop()),
    cursor: body.cursor as string | undefined,
  };
}

const byName = (name: string, extra = "") => feed(`name=${encodeURIComponent(name)}${extra}`);

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
  ]) {
    await db.run(`INSERT INTO _repos (did, status, handle) VALUES ($1, $2, $3)`, [
      did,
      status,
      handle,
    ]);
  }

  // Two Seattle venues in one city cell — newest first is sea-b, then sea-a.
  await gallery({
    id: "sea-a",
    createdAt: "2026-05-01",
    cell: SEA_A,
    locality: "Seattle",
    region: "Washington",
    country: "US",
  });
  await gallery({
    id: "sea-b",
    createdAt: "2026-05-02",
    cell: SEA_B,
    locality: "Seattle",
    region: "Washington",
    country: "US",
  });
  // Washington DC: locality "Washington" collides with Seattle's region.
  await gallery({
    id: "dc",
    createdAt: "2026-04-01",
    cell: DC_10,
    locality: "Washington",
    region: "District of Columbia",
    country: "US",
  });
  // New York, where locality and region are the same word.
  await gallery({
    id: "nyc",
    createdAt: "2026-03-01",
    cell: NYC_10,
    locality: "New York",
    region: "New York",
    country: "US",
  });
  // Minato, which has no region at all.
  await gallery({
    id: "tokyo",
    createdAt: "2026-02-01",
    cell: TOKYO_10,
    locality: "Minato",
    region: null,
    country: "JP",
  });
  // Stored as ISO-2; the sidebar offers the English name.
  await gallery({
    id: "athens",
    createdAt: "2026-01-01",
    cell: ATHENS_10,
    locality: "Athens",
    region: "Attica",
    country: "GR",
  });
  // A single-word locality that is not a country — the case that makes the
  // one-part name ambiguous.
  await gallery({
    id: "waldport",
    createdAt: "2026-06-01",
    cell: PDX_10,
    locality: "Waldport",
    region: "Oregon",
    country: "US",
  });
  // Only a custom label, no structured address.
  await gallery({
    id: "backyard",
    createdAt: "2026-06-02",
    cell: PDX_10,
    label: "My Backyard",
    noAddress: true,
  });
  // Seattle again, but taken down, and Seattle again from a blockable account.
  await gallery({
    id: "sea-down",
    did: CAROL,
    createdAt: "2026-05-03",
    cell: SEA_A,
    locality: "Seattle",
    region: "Washington",
    country: "US",
  });
  await gallery({
    id: "sea-bob",
    did: BOB,
    createdAt: "2026-04-15",
    cell: SEA_A,
    locality: "Seattle",
    region: "Washington",
    country: "US",
  });

  await db.run(`INSERT INTO _mutes (did, subject, created_at) VALUES ($1, $2, 'i')`, [ALICE, BOB]);
});

afterAll(async () => {
  await server?.close();
});

describe("location feed, by display name", () => {
  test("reads a three-part name as locality, region, country", async () => {
    const { ids } = await byName("Seattle, Washington, US");
    expect(ids).toEqual(["sea-b", "sea-a", "sea-bob"]);
  });

  test("does not let Seattle's region pull in Washington DC", async () => {
    // The second interpretation reads "Washington, US" as a locality, which DC
    // matches on. Only the region guard keeps it out.
    const { ids } = await byName("Seattle, Washington, US");
    expect(ids).not.toContain("dc");
  });

  test("ignores a POI prefix and uses the last three parts", async () => {
    const { ids } = await byName("The Space Needle, Seattle, Washington, US");
    expect(ids).toEqual(["sea-b", "sea-a", "sea-bob"]);
  });

  test("reads a three-part name as POI, locality, country when that is what it is", async () => {
    // "India Street, New York, US" is a POI inside New York, not a locality
    // called "India Street" in a region called "New York".
    const { ids } = await byName("India Street, New York, US");
    expect(ids).toEqual(["nyc"]);
  });

  test("matches a POI in a locality that has no region", async () => {
    const { ids } = await byName("Tokyo Midtown, Minato, JP");
    expect(ids).toEqual(["tokyo"]);
  });

  test("tries a two-part name as both locality and region", async () => {
    expect((await byName("Athens, GR")).ids).toEqual(["athens"]);
    expect((await byName("Oregon, US")).ids).toEqual(["waldport"]);
  });

  test("resolves an English country name to the stored ISO-2 code", async () => {
    // The record says "GR"; the sidebar offers "Greece".
    const { ids } = await byName("Greece");
    expect(ids).toEqual(["athens"]);
  });

  test("falls back to locality when a one-part name is not a country", async () => {
    // "Waldport" is tried as a country first and expands to nothing useful;
    // the locality reading is what matches.
    const { ids } = await byName("Waldport");
    expect(ids).toEqual(["waldport"]);
  });

  test("matches a gallery that has only a custom location label", async () => {
    const { ids } = await byName("My Backyard");
    expect(ids).toEqual(["backyard"]);
  });

  test("excludes taken-down repos and, for a viewer, muted accounts", async () => {
    const anon = await byName("Seattle, Washington, US");
    expect(anon).not.toBeNull();
    expect(anon.ids).not.toContain("sea-down");

    const viewer = await feed(`name=${encodeURIComponent("Seattle, Washington, US")}`, ALICE);
    expect(viewer.ids).toEqual(["sea-b", "sea-a"]);
  });

  test("falls through to the H3 cell when the name matches nothing", async () => {
    // A name that resolves to no gallery still shows the clicked cell rather
    // than an empty page.
    const { ids } = await byName("Nowhere At All", `&location=${SEA_A}`);
    expect(ids).toEqual(["sea-a", "sea-bob"]);
  });

  test("returns nothing when the name matches nothing and there is no cell", async () => {
    const { ids } = await byName("Nowhere At All");
    expect(ids).toEqual([]);
  });
});

describe("location feed, by H3 cell", () => {
  test("a city cell collects every venue inside it", async () => {
    const { ids } = await feed(`location=${SEA_5}&limit=50`);
    expect(ids).toEqual(["sea-b", "sea-a", "sea-bob"]);
  });

  test("a city cell excludes taken-down repos", async () => {
    const { ids } = await feed(`location=${SEA_5}&limit=50`);
    expect(ids).not.toContain("sea-down");
  });

  test("a city cell excludes muted accounts for a viewer", async () => {
    const { ids } = await feed(`location=${SEA_5}&limit=50`, ALICE);
    expect(ids).toEqual(["sea-b", "sea-a"]);
  });

  test("a city cell does not reach venues in other cities", async () => {
    const { ids } = await feed(`location=${SEA_5}&limit=50`);
    expect(ids).not.toContain("dc");
    expect(ids).not.toContain("nyc");
  });

  test("a venue cell matches only that exact venue", async () => {
    expect((await feed(`location=${SEA_B}&limit=50`)).ids).toEqual(["sea-b"]);
    expect((await feed(`location=${SEA_A}&limit=50`)).ids).toEqual(["sea-a", "sea-bob"]);
  });

  test("pages a city cell through its hand-rolled cursor", async () => {
    // City-level results are filtered in JS, so pagination is a base64 uri
    // cursor rather than the shared paginate() helper.
    const first = await feed(`location=${SEA_5}&limit=2`);
    expect(first.ids).toEqual(["sea-b", "sea-a"]);
    expect(first.cursor).toBeTruthy();

    const second = await feed(
      `location=${SEA_5}&limit=2&cursor=${encodeURIComponent(first.cursor!)}`,
    );
    expect(second.ids).toEqual(["sea-bob"]);
    expect(second.cursor).toBeUndefined();
  });

  test("returns nothing with neither a name nor a cell", async () => {
    const { ids } = await feed("limit=50");
    expect(ids).toEqual([]);
  });
});
