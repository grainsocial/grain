// Parameterized location feed. Usage:
//   GET /xrpc/dev.hatk.getFeed?feed=location&location=8a28a98a4c67fff&limit=50
//
// Accepts both resolution-10 (venue) and resolution-5 (city) H3 indices.
// For city-level queries, matches galleries whose venue H3 is a child of the city cell.
//
// FOLLOW-UPS (see commit ca49c1b for context):
//
//   1. Replace the `name` display-string param with a `/place/[slug]` URL
//      scheme. The current encoding serialises structured address fields into
//      a display string, then parses them back out below — this works today
//      but will break if a locality contains a comma ("Washington, D.C."),
//      if display names get localised, or if the format evolves. Cleaner
//      alternative: add `locality`/`region`/`country` to LocationItem in the
//      lexicon, carry them through the URL + feed param as structured data,
//      keep `name` purely for display.
//
//   2. grain-native still calls this feed with only `location=<h3>` and no
//      `name` — it falls through to the legacy single-cell path below, so
//      native users don't benefit from the multi-cell union. Fix lives in
//      grain-native's FeedEndpoints.swift + LocationFeedView.swift + pinned
//      feed paths. Additive, non-breaking.

import { defineFeed } from "$hatk";
import { hydrateGalleries } from "../hydrate/galleries.ts";
import { getResolution, cellToParent } from "h3-js";
import { hideLabelsFilter } from "../labels/_hidden.ts";
import { blockMuteFilter } from "../filters/blockMute.ts";
import { expandCountryAliases } from "../helpers/country.ts";

export default defineFeed({
  collection: "social.grain.gallery",
  label: "Location",

  hydrate: hydrateGalleries,

  async generate(ctx) {
    const name = typeof ctx.params.name === "string" ? ctx.params.name.trim() : "";
    const location = ctx.params.location;

    // Name-based query: unions all H3 cells sharing the same display label.
    // Preferred over H3 when provided, since multiple res-5 cells can carry the
    // same label (e.g. two res-5 cells both labeled "New York, New York, US").
    if (name) {
      // Parse the display name into plausible address interpretations. The
      // sidebar's display format is `[locality, region, country].filter(Boolean).join(", ")`,
      // so the last part is always country (when any address is present) and
      // the position of earlier parts depends on which fields were populated.
      // A 2-part name like "Paris, FR" is locality+country, while "Oregon, US"
      // is region+country — so we try both and union the matches.
      const parts = name
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      type Interp = {
        locality?: string;
        region?: string;
        country?: string;
        // When true, require the matched record to have region IS NULL.
        // Used for the [POI, locality, country] 3-part fallback so that
        // "Seattle, Washington, US" doesn't pull in Washington DC records
        // (locality=Washington, region=District of Columbia) while still
        // catching records with no region like "Tokyo Midtown, Minato, JP".
        regionMustBeNull?: boolean;
      };
      const interps: Interp[] = [];
      if (parts.length >= 3) {
        // Take the LAST three parts as [locality, region, country] so displays
        // with a POI prefix ("The Space Needle, Seattle, Washington, US" or
        // "Northeast 33rd Drive, Portland, Oregon, US") parse correctly.
        const [locality, region, country] = parts.slice(-3);
        interps.push({ locality, region, country });
        // Also try [POI, locality, country] for records that legitimately
        // have no region (common for non-US places and POIs).
        interps.push({
          locality: parts[parts.length - 2],
          country: parts[parts.length - 1],
          regionMustBeNull: true,
        });
      } else if (parts.length === 2) {
        // Ambiguous: could be [locality, country] ("Paris, FR") or
        // [region, country] ("Oregon, US"). Try both; only the right one
        // matches records.
        interps.push({ locality: parts[0], country: parts[1] });
        interps.push({ region: parts[0], country: parts[1] });
      } else if (parts.length === 1) {
        // Ambiguous: could be a country ("Greece") or a locality
        // ("Seattle"). Try both.
        interps.push({ country: parts[0] });
        interps.push({ locality: parts[0] });
      }

      const viewer = ctx.viewer?.did;
      const params: any[] = [];
      let p = 1;

      const interpClauses: string[] = [];
      for (const interp of interps) {
        const matches: string[] = [];
        if (interp.locality) {
          matches.push(`UPPER(json_extract(t.address, '$.locality')) = UPPER($${p++})`);
          params.push(interp.locality);
        }
        if (interp.region) {
          matches.push(`UPPER(json_extract(t.address, '$.region')) = UPPER($${p++})`);
          params.push(interp.region);
        }
        if (interp.country) {
          // Expand "US"/"USA"/etc. all together.
          const aliases = expandCountryAliases(interp.country);
          const placeholders = aliases.map(() => `$${p++}`).join(",");
          matches.push(`UPPER(json_extract(t.address, '$.country')) IN (${placeholders})`);
          params.push(...aliases);
        }
        if (interp.regionMustBeNull) {
          matches.push(`json_extract(t.address, '$.region') IS NULL`);
        }
        if (matches.length) interpClauses.push(`(${matches.join(" AND ")})`);
      }

      // Also match records whose raw location.name equals the requested name —
      // covers galleries with only a custom location label (no structured address).
      interpClauses.push(`json_extract(t.location, '$.name') = $${p++}`);
      params.push(name);

      const bmFilter = viewer ? `AND ${blockMuteFilter("t.did", `$${p++}`)}` : "";
      if (viewer) params.push(viewer);

      const { rows, cursor } = await ctx.paginate<{ uri: string }>(
        `SELECT t.uri, t.cid, t.created_at FROM "social.grain.gallery" t
         LEFT JOIN _repos r ON t.did = r.did
         WHERE (r.status IS NULL OR r.status != 'takendown')
           AND (${interpClauses.join(" OR ")})
           AND ${hideLabelsFilter("t.uri")}
           AND (SELECT count(*) FROM "social.grain.gallery.item" gi WHERE gi.gallery = t.uri) > 0
           ${bmFilter}`,
        { orderBy: "t.created_at", params },
      );

      // If the name-based query found matches, or we have no H3 to fall back to,
      // return. Otherwise fall through to the legacy H3 path — at minimum the
      // user sees the clicked gallery's own cell instead of an empty page.
      if (rows.length > 0 || !location) {
        return ctx.ok({ uris: rows.map((r) => r.uri), cursor });
      }
    }

    if (!location) return ctx.ok({ uris: [] });

    const res = getResolution(location);
    const isCityLevel = res <= 5;

    // For city-level queries, we need to check if the gallery's H3 cell
    // is a child of the requested city cell. We do this in application code
    // since SQLite doesn't have H3 functions.
    const viewer = ctx.viewer?.did;

    if (isCityLevel) {
      // Fetch all galleries with locations, filter by H3 parent in JS, then paginate
      const limit = ctx.params.limit ? Number(ctx.params.limit) : 30;
      const bmFilter = viewer ? `AND ${blockMuteFilter("t.did", "$1")}` : "";
      const bmParams = viewer ? [viewer] : [];
      const allRows = (await ctx.db.query(
        `SELECT t.uri, t.created_at, json_extract(t.location, '$.value') AS location
         FROM "social.grain.gallery" t
         LEFT JOIN _repos r ON t.did = r.did
         WHERE (r.status IS NULL OR r.status != 'takendown')
           AND t.location IS NOT NULL
           AND ${hideLabelsFilter("t.uri")}
           AND (SELECT count(*) FROM "social.grain.gallery.item" gi WHERE gi.gallery = t.uri) > 0
           ${bmFilter}
         ORDER BY t.created_at DESC`,
        bmParams,
      )) as { uri: string; created_at: string; location: string }[];

      const filtered = allRows.filter((r) => {
        if (!r.location) return false;
        try {
          const cellRes = getResolution(r.location);
          if (cellRes <= 5) return r.location === location;
          return cellToParent(r.location, 5) === location;
        } catch {
          return false;
        }
      });

      // Manual cursor pagination over filtered results
      let startIdx = 0;
      if (ctx.params.cursor) {
        const cursorUri = atob(ctx.params.cursor);
        const idx = filtered.findIndex((r) => r.uri === cursorUri);
        if (idx >= 0) startIdx = idx + 1;
      }
      const page = filtered.slice(startIdx, startIdx + limit);
      const cursor =
        page.length > 0 && startIdx + limit < filtered.length
          ? btoa(page[page.length - 1].uri)
          : undefined;

      return ctx.ok({ uris: page.map((r) => r.uri), cursor });
    }

    // Venue-level: exact match
    const bmFilterVenue = viewer ? `AND ${blockMuteFilter("t.did", "$2")}` : "";
    const bmParamsVenue = viewer ? [viewer] : [];
    const { rows, cursor } = await ctx.paginate<{ uri: string }>(
      `SELECT t.uri, t.cid, t.created_at FROM "social.grain.gallery" t
       LEFT JOIN _repos r ON t.did = r.did
       WHERE (r.status IS NULL OR r.status != 'takendown')
         AND json_extract(t.location, '$.value') = $1
         AND ${hideLabelsFilter("t.uri")}
         AND (SELECT count(*) FROM "social.grain.gallery.item" gi WHERE gi.gallery = t.uri) > 0
         ${bmFilterVenue}`,
      { orderBy: "t.created_at", params: [location, ...bmParamsVenue] },
    );

    return ctx.ok({ uris: rows.map((r) => r.uri), cursor });
  },
});
