/**
 * Fediverse accounts bridged in by Bridgy Fed. It writes their image posts as
 * grain galleries: news feeds and toots that carry a picture, mirrored here
 * without anyone choosing to post on grain. Every post from one is labelled
 * `spam`, by the label rule in `labels/spam.ts` as a post is indexed live and
 * by the `bridged` classifier for posts a backfill wrote.
 */

/** The collections whose records are hidden when a bridged account writes them. */
export const BRIDGED_HIDDEN_COLLECTIONS = [
  "social.grain.gallery",
  "social.grain.story",
  "social.grain.comment",
];

export function isBridgedHandle(handle: string | null | undefined): boolean {
  return !!handle?.toLowerCase().endsWith(".ap.brid.gy");
}
