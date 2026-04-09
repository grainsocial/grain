// Returns top locations by gallery count, grouped at region level (stale-while-revalidate, 5min TTL).
//   GET /xrpc/social.grain.unspecced.getLocations

import { defineQuery } from "$hatk";
import { getResolution, cellToParent } from "h3-js";

type LocationItem = { name: string; h3Index: string; galleryCount: number };
let cache: { data: LocationItem[]; expires: number } | null = null;
const TTL = 5 * 60 * 1000;

async function refresh(db: any) {
  // Fetch all galleries with locations, then aggregate by region in application code
  const rows = (await db.query(`
    SELECT json_extract(location, '$.name') AS name,
           json_extract(location, '$.value') AS h3_index,
           json_extract(address, '$.locality') AS locality,
           json_extract(address, '$.region') AS region,
           json_extract(address, '$.country') AS country
    FROM "social.grain.gallery"
    WHERE location IS NOT NULL
  `)) as {
    name: string;
    h3_index: string;
    locality: string | null;
    region: string | null;
    country: string | null;
  }[];

  // Group by region-level H3 cell, picking the most common locality name
  const regionMap = new Map<
    string,
    { nameCounts: Map<string, number>; h3Index: string; count: number }
  >();
  for (const row of rows) {
    if (!row.h3_index) continue;
    let regionH3: string;
    try {
      const res = getResolution(row.h3_index);
      regionH3 = res <= 5 ? row.h3_index : cellToParent(row.h3_index, 5);
    } catch {
      continue;
    }
    const displayName =
      [row.locality, row.region, row.country].filter(Boolean).join(", ") || row.name;
    const existing = regionMap.get(regionH3);
    if (existing) {
      existing.count++;
      existing.nameCounts.set(displayName, (existing.nameCounts.get(displayName) ?? 0) + 1);
    } else {
      regionMap.set(regionH3, {
        nameCounts: new Map([[displayName, 1]]),
        h3Index: regionH3,
        count: 1,
      });
    }
  }

  const data = [...regionMap.values()]
    .map((r) => {
      let bestName = "";
      let bestCount = 0;
      for (const [name, count] of r.nameCounts) {
        if (count > bestCount) {
          bestCount = count;
          bestName = name;
        }
      }
      return { name: bestName, h3Index: r.h3Index, galleryCount: r.count };
    })
    .sort((a, b) => b.galleryCount - a.galleryCount || a.name.localeCompare(b.name))
    .slice(0, 30);

  cache = { data, expires: Date.now() + TTL };
  return data;
}

export default defineQuery("social.grain.unspecced.getLocations", async (ctx) => {
  const { db, ok } = ctx;

  if (cache) {
    if (Date.now() >= cache.expires) refresh(db);
    return ok({ locations: cache.data });
  }

  return ok({ locations: await refresh(db) });
});
