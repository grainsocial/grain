// Where a photo inside a permissioned space is drawn from.
//
// Never the CDN: the space hands a blob only to a holder of a credential bound
// to a key, and the CDN is an unauthenticated cache keyed by a public URL —
// putting a private photo behind one would turn its URL into the capability the
// credential exists to replace. So the bytes come through the appview, on the
// viewer's behalf, with their credential.
//
// The preset names the size it is drawn at, from the same list and the same
// numbers the public path hands imgproxy — one vocabulary for both halves, so a
// size is said once and means the same either side of the line. A permissioned
// blob may not pass through an image CDN, so the appview is what resizes it.

/** The sizes a space blob is served at. */
export type SpaceBlobPreset =
  | "avatar"
  | "avatar_thumbnail"
  | "feed_thumbnail"
  | "feed_fullsize"
  | "banner";

/**
 * The URL a space blob is served at, for the viewer asking.
 *
 * `repo` is the repo holding the blob — the writer's, not the authority's.
 * Left without a preset, the original comes back.
 */
export function spaceBlobUrl(
  space: string,
  repo: string,
  cid: string,
  preset?: SpaceBlobPreset,
): string {
  const params = new URLSearchParams({ space, repo, cid });
  if (preset) params.set("preset", preset);
  return `/space-blob?${params}`;
}

/**
 * A photo in a space, at the two sizes a gallery view draws it.
 *
 * Every grid tile and every lightbox in grain reads `thumb` and `fullsize`, and
 * until presets existed both were the same camera original — a 200-pixel tile
 * and a full-screen view served the same twelve megapixels.
 */
export function spaceBlobViews(
  space: string,
  repo: string,
  cid: string,
): { thumb: string; fullsize: string } {
  return {
    thumb: spaceBlobUrl(space, repo, cid, "feed_thumbnail"),
    fullsize: spaceBlobUrl(space, repo, cid, "feed_fullsize"),
  };
}
