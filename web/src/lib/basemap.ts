/**
 * Self-hosted Protomaps basemap.
 *
 * The archive is a single PMTiles file on Cloudflare R2. The browser does not
 * read it directly any more: a Worker on tiles.grain.social walks the archive's
 * directory against the bucket and serves ordinary z/x/y tiles the edge can
 * cache. Read over r2.dev, every tile was an uncached range request at ~650ms,
 * with two or three directory reads before the first one — and a 136GB object
 * is past what the edge will cache ranges of. See stacks/edge in the infra repo.
 *
 * No tile server of our own, no API key, and no third-party terms that can
 * change underneath us. CARTO's keyless basemaps, which this replaced, began
 * serving tiles watermarked "API KEY REQUIRED".
 */
export const BASEMAP_ORIGIN = "https://tiles.grain.social";
export const BASEMAP_TILES = `${BASEMAP_ORIGIN}/planet/{z}/{x}/{y}.mvt`;

/** From the archive header. Hardcoded so the map needs no TileJSON round trip. */
export const BASEMAP_MINZOOM = 0;
export const BASEMAP_MAXZOOM = 15;

/** Required by ODbL wherever the basemap is shown. */
export const BASEMAP_ATTRIBUTION =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>';

/** The vector source every map here shares; protomaps-themes-base styles it. */
export const BASEMAP_SOURCE = {
  type: "vector" as const,
  tiles: [BASEMAP_TILES],
  minzoom: BASEMAP_MINZOOM,
  maxzoom: BASEMAP_MAXZOOM,
  attribution: BASEMAP_ATTRIBUTION,
};
