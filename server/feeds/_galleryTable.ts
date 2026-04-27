// Use in place of `"social.grain.gallery" t` in chronological feed queries.
// Exposes `t.sort_at = min(created_at, indexed_at)` so that future-dated
// `createdAt` values (client clock skew) don't pin galleries to the top of
// `/recent` and friends. Backdated values (e.g. /settings/import sets
// createdAt to the original Bluesky post date) are preserved, so historical
// imports still slot into history rather than the top of the feed.
//
// Pair with `orderBy: "t.sort_at"` and select `t.sort_at` for the cursor.
export const galleryFeedTable = `(
  SELECT *, min(created_at, indexed_at) AS sort_at FROM "social.grain.gallery"
) t`;
