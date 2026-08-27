/**
 * Self-hosted Protomaps basemap.
 *
 * The archive is a single PMTiles file on Cloudflare R2 that the browser reads
 * with HTTP range requests — no tile server, no API key, and no third-party
 * terms that can change underneath us. CARTO's keyless basemaps, which this
 * replaced, began serving tiles watermarked "API KEY REQUIRED".
 */
export const BASEMAP_URL =
  "https://pub-7f23adbee2034af39a148047268ea83c.r2.dev/planet.pmtiles";

/** Required by ODbL wherever the basemap is shown. */
export const BASEMAP_ATTRIBUTION =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>';

/**
 * Fonts and icons for the label layers. Static, keyless assets published by
 * Protomaps alongside the basemap; the archive itself carries no glyphs.
 * Mirror these into R2 if we ever want zero third-party fetches on this page.
 */
export const BASEMAP_GLYPHS =
  "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf";

export const BASEMAP_SPRITE = "https://protomaps.github.io/basemaps-assets/sprites/v4";
