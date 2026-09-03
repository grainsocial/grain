// Returns top locations by gallery count (stale-while-revalidate, 5min TTL).
//   GET /xrpc/social.grain.unspecced.getLocations
//
// Places are identified by their structured address fields when available
// (normalized country + region + locality), falling back to location.name and
// finally to an H3 res-5 cell for records missing address data. This
// eliminates the old H3-cell-first grouping, which could produce duplicate
// entries when a city's photos spanned multiple res-5 parent cells.
//
// FOLLOW-UPS:
//   - Results are capped at top 30. The `/locations` index page uses this
//     same endpoint. If the index needs to show more, add an optional
//     `limit` param (bounded) rather than lifting the cap unconditionally.
//   - At time of writing, only 4 records in prod have `location` but no
//     `address` — they fall to the `location.name` / H3 res-5 fallback
//     paths below. If that number grows, revisit the ladder.

import { defineQuery } from "$hatk";
import { getResolution, cellToParent } from "h3-js";
import { normalizeCountry } from "../helpers/country.ts";

/** Thumbnails carried per place, enough for the index tile's 2x2 mosaic. */
const THUMBS_PER_LOCATION = 4;

type LocationItem = {
  name: string;
  h3Index: string;
  galleryCount: number;
  h3Cells: string[];
  thumbs: string[];
};
let cache: { data: LocationItem[]; expires: number } | null = null;
const TTL = 5 * 60 * 1000;

type Row = {
  uri: string;
  name: string | null;
  h3_index: string | null;
  locality: string | null;
  region: string | null;
  country: string | null;
};

function computeKey(r: Row): string | null {
  const locality = r.locality?.trim() || null;
  const region = r.region?.trim() || null;
  const country = normalizeCountry(r.country);

  if (locality || region || country) {
    // Address-based key — lowercased for case-insensitive grouping;
    // country already canonicalized via normalizeCountry.
    return `A:${country ?? ""}|${region?.toLowerCase() ?? ""}|${locality?.toLowerCase() ?? ""}`;
  }
  if (r.name?.trim()) {
    return `N:${r.name.trim().toLowerCase()}`;
  }
  if (r.h3_index) {
    try {
      const res = getResolution(r.h3_index);
      const parent = res <= 5 ? r.h3_index : cellToParent(r.h3_index, 5);
      return `H:${parent}`;
    } catch {
      return null;
    }
  }
  return null;
}

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    return null;
  }
})();

function computeDisplayName(r: Row): string | null {
  const locality = r.locality?.trim() || null;
  const region = r.region?.trim() || null;
  const country = normalizeCountry(r.country);

  if (locality || region) {
    // Multi-part: keep ISO-2 for the country so all rows in a group share
    // the same display (prevents "Portland, Oregon, USA" vs "...US" split).
    const parts = [locality, region, country].filter(Boolean);
    return parts.length ? parts.join(", ") : null;
  }
  if (country) {
    // Country-only: expand to full name since "GR" alone means nothing to users.
    return regionNames?.of(country) ?? country;
  }
  return r.name?.trim() || null;
}

async function refresh(ctx: any) {
  const { db } = ctx;

  // Ordered newest first so the first galleries kept per group are also the
  // ones the index tile shows.
  const rows = (await db.query(`
    SELECT uri,
           json_extract(location, '$.name') AS name,
           json_extract(location, '$.value') AS h3_index,
           json_extract(address, '$.locality') AS locality,
           json_extract(address, '$.region') AS region,
           json_extract(address, '$.country') AS country
    FROM "social.grain.gallery"
    WHERE location IS NOT NULL
    ORDER BY created_at DESC
  `)) as Row[];

  type Group = {
    nameCounts: Map<string, number>;
    h3Counts: Map<string, number>;
    galleryUris: string[];
    count: number;
  };
  const groups = new Map<string, Group>();

  for (const row of rows) {
    const key = computeKey(row);
    if (!key) continue;
    const displayName = computeDisplayName(row);
    if (!displayName) continue;

    let g = groups.get(key);
    if (!g) {
      g = { nameCounts: new Map(), h3Counts: new Map(), galleryUris: [], count: 0 };
      groups.set(key, g);
    }
    g.count++;
    if (g.galleryUris.length < THUMBS_PER_LOCATION) g.galleryUris.push(row.uri);
    g.nameCounts.set(displayName, (g.nameCounts.get(displayName) ?? 0) + 1);
    if (row.h3_index) {
      g.h3Counts.set(row.h3_index, (g.h3Counts.get(row.h3_index) ?? 0) + 1);
    }
  }

  const data: LocationItem[] = [];
  for (const g of groups.values()) {
    let bestName = "";
    let bestNameCount = 0;
    for (const [n, c] of g.nameCounts) {
      if (c > bestNameCount) {
        bestNameCount = c;
        bestName = n;
      }
    }
    // Sort cells by count desc — canonical is the densest, full list used for map bbox.
    const sortedCells = [...g.h3Counts.entries()].sort((a, b) => b[1] - a[1]).map(([h]) => h);
    const bestH3 = sortedCells[0] ?? "";
    if (bestName && bestH3) {
      data.push({
        name: bestName,
        h3Index: bestH3,
        galleryCount: g.count,
        h3Cells: sortedCells,
        thumbs: [],
        galleryUris: g.galleryUris,
      } as LocationItem & { galleryUris: string[] });
    }
  }

  data.sort((a, b) => b.galleryCount - a.galleryCount || a.name.localeCompare(b.name));
  const top = data.slice(0, 30) as (LocationItem & { galleryUris?: string[] })[];

  const thumbs = await thumbsByGallery(
    ctx,
    top.flatMap((l) => l.galleryUris ?? []),
  );
  for (const l of top) {
    l.thumbs = (l.galleryUris ?? []).map((uri) => thumbs.get(uri)).filter((u): u is string => !!u);
    delete l.galleryUris;
  }

  cache = { data: top, expires: Date.now() + TTL };
  return top;
}

/**
 * Cover thumbnail per gallery — the photo in position 0, the same one the
 * gallery card leads with. Keyed by gallery URI so a place can pick its own.
 */
async function thumbsByGallery(ctx: any, galleryUris: string[]): Promise<Map<string, string>> {
  const { db, blobUrl, getRecords } = ctx;
  if (galleryUris.length === 0) return new Map();

  const items = (await db.query(
    `SELECT gallery, item
     FROM "social.grain.gallery.item"
     WHERE gallery IN (${galleryUris.map((_: string, i: number) => `$${i + 1}`).join(",")})
     ORDER BY position ASC`,
    galleryUris,
  )) as { gallery: string; item: string }[];

  const cover = new Map<string, string>();
  for (const row of items) {
    if (!cover.has(row.gallery)) cover.set(row.gallery, row.item);
  }

  const photoUris = [...new Set(cover.values())];
  if (photoUris.length === 0) return new Map();
  const photos = await getRecords("social.grain.photo", photoUris);

  const out = new Map<string, string>();
  for (const [gallery, photoUri] of cover) {
    const rec = photos.get(photoUri);
    const url = rec ? blobUrl(rec.did, rec.value.photo, "feed_thumbnail") : null;
    if (url) out.set(gallery, url);
  }
  return out;
}

export default defineQuery("social.grain.unspecced.getLocations", async (ctx) => {
  const { ok } = ctx;

  if (cache) {
    if (Date.now() >= cache.expires) refresh(ctx);
    return ok({ locations: cache.data });
  }

  return ok({ locations: await refresh(ctx) });
});
