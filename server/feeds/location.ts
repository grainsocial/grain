// Parameterized location feed. Usage:
//   GET /xrpc/dev.hatk.getFeed?feed=location&location=8a28a98a4c67fff&limit=50
//
// Accepts both resolution-10 (venue) and resolution-5 (city) H3 indices.
// For city-level queries, matches galleries whose venue H3 is a child of the city cell.

import { defineFeed } from "$hatk";
import { hydrateGalleries } from "./_hydrate.ts";
import { getResolution, cellToParent } from "h3-js";

export default defineFeed({
  collection: "social.grain.gallery",
  label: "Location",

  hydrate: hydrateGalleries,

  async generate(ctx) {
    const location = ctx.params.location;
    if (!location) return ctx.ok({ uris: [] });

    const res = getResolution(location);
    const isCityLevel = res <= 5;

    // For city-level queries, we need to check if the gallery's H3 cell
    // is a child of the requested city cell. We do this in application code
    // since SQLite doesn't have H3 functions.
    if (isCityLevel) {
      // Fetch all galleries with locations, then filter
      const { rows, cursor } = await ctx.paginate<{ uri: string; location: string }>(
        `SELECT t.uri, t.cid, t.created_at, json_extract(t.location, '$.value') AS location
         FROM "social.grain.gallery" t
         LEFT JOIN _repos r ON t.did = r.did
         WHERE (r.status IS NULL OR r.status != 'takendown')
           AND t.location IS NOT NULL
           AND (SELECT count(*) FROM "social.grain.gallery.item" gi WHERE gi.gallery = t.uri) > 0`,
        { orderBy: "t.created_at" },
      );

      const filtered = rows.filter((r) => {
        if (!r.location) return false;
        try {
          const cellRes = getResolution(r.location);
          // Legacy res-5 cells: exact match
          if (cellRes <= 5) return r.location === location;
          // Res-10 cells: check if parent at res 5 matches
          return cellToParent(r.location, 5) === location;
        } catch {
          return false;
        }
      });

      return ctx.ok({ uris: filtered.map((r) => r.uri), cursor });
    }

    // Venue-level: exact match
    const { rows, cursor } = await ctx.paginate<{ uri: string }>(
      `SELECT t.uri, t.cid, t.created_at FROM "social.grain.gallery" t
       LEFT JOIN _repos r ON t.did = r.did
       WHERE (r.status IS NULL OR r.status != 'takendown')
         AND json_extract(t.location, '$.value') = $1
         AND (SELECT count(*) FROM "social.grain.gallery.item" gi WHERE gi.gallery = t.uri) > 0`,
      { orderBy: "t.created_at", params: [location] },
    );

    return ctx.ok({ uris: rows.map((r) => r.uri), cursor });
  },
});
