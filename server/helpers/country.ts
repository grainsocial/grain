// Country code normalization for place-grouping in the AppView index.
//
// Third-party clients writing to the grain lexicon can put any string in
// address.country, so we normalize at query/aggregation time. Variants are
// upper-cased on match, so spelling case doesn't matter.

// Known spelling variants not covered by Intl (e.g. "USA" → "US").
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

// Build a name → ISO-2 reverse map from Intl so "Greece" resolves to "GR",
// "United States" to "US", etc. Keys are upper-cased for case-insensitive match.
const regionNames = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    return null;
  }
})();

// Brute-force enumerate 2-letter ISO codes and build a reverse map.
// Iterates A–Z so when two codes share a display name (e.g. "United Kingdom"
// → GB and UK), the earlier alphabetical code wins. For GB/UK this lands on
// GB, which is what grain-web/grain-native store (Nominatim returns "gb").
const NAME_TO_CODE: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  if (!regionNames) return map;
  for (let i = 65; i <= 90; i++) {
    for (let j = 65; j <= 90; j++) {
      const code = String.fromCharCode(i, j);
      let name: string | undefined;
      try {
        name = regionNames.of(code);
      } catch {
        continue;
      }
      if (!name || name === code) continue;
      const key = name.toUpperCase();
      if (!map[key]) map[key] = code;
    }
  }
  return map;
})();

/** Return the canonical ISO-2 code for a country string, or null if unrecognized/empty. */
export function normalizeCountry(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().toUpperCase();
  if (!s) return null;
  if (COUNTRY_ALIASES[s]) return COUNTRY_ALIASES[s];
  if (NAME_TO_CODE[s]) return NAME_TO_CODE[s];
  return s;
}

/**
 * Return all raw country strings that normalize to the same canonical code,
 * upper-cased. Includes ISO-2, known aliases, and the full English name so
 * clicking a sidebar entry like "Greece" still matches records stored as "GR".
 */
export function expandCountryAliases(raw: string): string[] {
  const canon = normalizeCountry(raw);
  if (!canon) return [];
  const set = new Set<string>([canon]);
  for (const [alias, c] of Object.entries(COUNTRY_ALIASES)) {
    if (c === canon) set.add(alias);
  }
  const fullName = regionNames?.of(canon);
  if (fullName) set.add(fullName.toUpperCase());
  return [...set];
}
