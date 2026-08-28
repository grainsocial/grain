/**
 * Self-hosted Protomaps basemap.
 *
 * The archive is a single PMTiles file on Cloudflare R2 that the browser reads
 * with HTTP range requests — no tile server, no API key, and no third-party
 * terms that can change underneath us. CARTO's keyless basemaps, which this
 * replaced, began serving tiles watermarked "API KEY REQUIRED".
 */
export const BASEMAP_URL = "https://pub-7f23adbee2034af39a148047268ea83c.r2.dev/planet.pmtiles";

/** Required by ODbL wherever the basemap is shown. */
export const BASEMAP_ATTRIBUTION =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>';
