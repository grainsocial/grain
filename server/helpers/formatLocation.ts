/**
 * Build a display label for a stored location + address pair.
 *
 * `location.name` may be either a POI name ("Blue Bottle Coffee") or a
 * Nominatim-formatted fallback that already contains locality/region/country
 * ("New York, New York, United States"). It may also contain a county baked
 * in by older clients ("Kansas City, Jackson County, Missouri, United States").
 *
 * We take the first comma-separated chunk of the name as the primary label,
 * then append locality/region/country while dropping case-insensitive adjacent
 * duplicates. This preserves POI context ("Blue Bottle Coffee, Oakland,
 * California, US") and collapses redundancy in city fallbacks ("New York, US").
 *
 * Legacy records (community.lexicon.location.hthree) without structured
 * address use the stored name as-is so we don't strip useful commas.
 */
export function formatStoredLocation(
  location: { name?: string | null } | null | undefined,
  address:
    | { locality?: string | null; region?: string | null; country?: string | null }
    | null
    | undefined,
): string {
  const name = location?.name?.trim() ?? "";
  const hasAddressContext = !!(address?.locality || address?.region || address?.country);
  if (!hasAddressContext) return name;

  const primaryLabel = name.split(",")[0].trim() || name;
  const parts: string[] = [];
  const appendIfDistinct = (value?: string | null) => {
    const v = value?.trim();
    if (!v) return;
    if (parts[parts.length - 1]?.toLowerCase() === v.toLowerCase()) return;
    parts.push(v);
  };
  appendIfDistinct(primaryLabel);
  appendIfDistinct(address?.locality);
  appendIfDistinct(address?.region);
  appendIfDistinct(address?.country);
  return parts.join(", ");
}
