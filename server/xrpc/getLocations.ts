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

/** What a map needs and nothing else — see the `pins` parameter. */
type LocationPin = { name: string; h3Index: string; galleryCount: number };

let cache: { top: LocationItem[]; pins: LocationPin[]; expires: number } | null = null;
const TTL = 5 * 60 * 1000;

type Row = {
  uri: string;
  created_at: string;
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
           created_at,
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
    /** Newest few galleries, kept with their dates so a merge can re-rank. */
    galleries: { uri: string; createdAt: string }[];
    country: string;
    region: string;
    locality: string;
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
      g = {
        nameCounts: new Map(),
        h3Counts: new Map(),
        galleries: [],
        country: normalizeCountry(row.country) ?? "",
        region: row.region?.trim().toLowerCase() ?? "",
        locality: row.locality?.trim().toLowerCase() ?? "",
        count: 0,
      };
      groups.set(key, g);
    }
    g.count++;
    if (g.galleries.length < THUMBS_PER_LOCATION) {
      g.galleries.push({ uri: row.uri, createdAt: row.created_at });
    }
    g.nameCounts.set(displayName, (g.nameCounts.get(displayName) ?? 0) + 1);
    if (row.h3_index) {
      g.h3Counts.set(row.h3_index, (g.h3Counts.get(row.h3_index) ?? 0) + 1);
    }
  }

  // A geocoder gives some galleries "Lisbon, PT" and others "Lisbon, Lisbon, PT",
  // and keyed verbatim those are two places that each fall short of the cut.
  // Fold a region-less group into its region-bearing twin — but only when there
  // is exactly one candidate: "Portland, US" alongside both an Oregon and a
  // Maine group is genuinely ambiguous, and merging it would be a lie.
  const byCountryLocality = new Map<string, string[]>();
  for (const [key, g] of groups) {
    if (!g.region || !g.locality) continue;
    const id = `${g.country}|${g.locality}`;
    byCountryLocality.set(id, [...(byCountryLocality.get(id) ?? []), key]);
  }
  for (const [key, g] of [...groups]) {
    if (g.region || !g.locality) continue;
    const candidates = byCountryLocality.get(`${g.country}|${g.locality}`) ?? [];
    if (candidates.length !== 1) continue;
    const into = groups.get(candidates[0]);
    if (!into) continue;

    into.count += g.count;
    for (const [n, c] of g.nameCounts) into.nameCounts.set(n, (into.nameCounts.get(n) ?? 0) + c);
    for (const [h, c] of g.h3Counts) into.h3Counts.set(h, (into.h3Counts.get(h) ?? 0) + c);
    into.galleries = [...into.galleries, ...g.galleries]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
      .slice(0, THUMBS_PER_LOCATION);
    groups.delete(key);
  }

  type Ranked = LocationItem & { galleryUris?: string[] };
  const data: Ranked[] = [];
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
        galleryUris: g.galleries.map((x) => x.uri),
      });
    }
  }

  data.sort((a, b) => b.galleryCount - a.galleryCount || a.name.localeCompare(b.name));

  // Every place, carrying only what a map plots. Free to build — the ranking
  // above already walked all of them — and the reason `pins` does not need its
  // own query or its own cache.
  const pins: LocationPin[] = data.map((l) => ({
    name: l.name,
    h3Index: l.h3Index,
    galleryCount: l.galleryCount,
  }));

  // Thumbnails are the expensive part, so only the slice that renders tiles
  // pays for them.
  const top = data.slice(0, 30);
  const thumbs = await thumbsByGallery(ctx, top.flatMap((l) => l.galleryUris ?? []));
  for (const l of top) {
    l.thumbs = (l.galleryUris ?? []).map((uri) => thumbs.get(uri)).filter((u): u is string => !!u);
    delete l.galleryUris;
  }

  cache = { top, pins, expires: Date.now() + TTL };
  return cache;
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
  const { ok, params } = ctx;
  const pins = params?.pins === true || params?.pins === "true";

  // Stale-while-revalidate, as before: serve what is cached and refresh behind
  // the request. Both shapes come out of the same entry, so asking for pins
  // never triggers a second pass over the galleries.
  if (cache) {
    if (Date.now() >= cache.expires) refresh(ctx);
    return ok({ locations: pins ? cache.pins : cache.top });
  }

  const fresh = await refresh(ctx);
  return ok({ locations: pins ? fresh.pins : fresh.top });
});
