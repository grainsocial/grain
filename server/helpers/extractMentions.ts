/**
 * Extract distinct mentioned DIDs from an AT Protocol facets array.
 * Accepts either the parsed array or its JSON string form.
 */
export function extractMentionDids(facets: unknown): string[] {
  let parsed: unknown = facets;
  if (typeof facets === "string") {
    try {
      parsed = JSON.parse(facets);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];

  const dids = new Set<string>();
  for (const facet of parsed) {
    const features = (facet as any)?.features;
    if (!Array.isArray(features)) continue;
    for (const feat of features) {
      if (
        feat?.$type === "app.bsky.richtext.facet#mention" &&
        typeof feat.did === "string" &&
        feat.did.startsWith("did:")
      ) {
        dids.add(feat.did);
      }
    }
  }
  return [...dids];
}
