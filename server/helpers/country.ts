// Country code normalization for place-grouping in the AppView index.
//
// Third-party clients writing to the grain lexicon can put any string in
// address.country, so we normalize at query/aggregation time. Variants are
// upper-cased on match, so spelling case doesn't matter.

// Only the variants actually observed in the data. Add more as they appear.
//
// The single observed non-canonical value ("USA") comes from one external
// DID (timtrautmann.com) posting to the grain lexicon via a third-party tool
// — grain-web and grain-native both uppercase `country_code` from Nominatim
// and produce ISO-2. If a second source starts writing other variants, add
// them here. If the table balloons, consider instead the alternatives noted
// in server/feeds/location.ts: a server-side indexer enrichment step that
// calls Nominatim on ingest and canonicalises the country field into the
// AppView index.
export const COUNTRY_ALIASES: Record<string, string> = {
  USA: "US",
};

/** Return the canonical ISO-2 code for a country string, or null if unrecognized/empty. */
export function normalizeCountry(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().toUpperCase();
  if (!s) return null;
  return COUNTRY_ALIASES[s] ?? s;
}

/** Return all raw country strings that normalize to the same canonical code, upper-cased. */
export function expandCountryAliases(raw: string): string[] {
  const canon = normalizeCountry(raw);
  if (!canon) return [];
  const set = new Set<string>([canon]);
  for (const [alias, c] of Object.entries(COUNTRY_ALIASES)) {
    if (c === canon) set.add(alias);
  }
  return [...set];
}
