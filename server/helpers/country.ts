// Country code normalization for place-grouping in the AppView index.
//
// Third-party clients writing to the grain lexicon can put any string in
// address.country, so we normalize at query/aggregation time. Variants are
// upper-cased on match, so spelling case doesn't matter.

// Only the variants actually observed in the data. Add more as they appear.
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
