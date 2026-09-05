/**
 * Which of these stories the viewer has watched, from _story_views.
 *
 * Shared by every handler that hydrates a storyView so that the story on a
 * profile, in the strip and in the archive all agree about what has been seen.
 */
export async function lookupViewedStories(
  db: { query: (sql: string, params?: unknown[]) => Promise<unknown[]> },
  viewerDid: string | undefined,
  uris: string[],
): Promise<Set<string>> {
  if (!viewerDid || uris.length === 0) return new Set();
  const rows = (await db.query(
    `SELECT subject FROM _story_views
     WHERE did = $1 AND subject IN (${uris.map((_, i) => `$${i + 2}`).join(",")})`,
    [viewerDid, ...uris],
  )) as { subject: string }[];
  return new Set(rows.map((r) => r.subject));
}

/** The `viewer` block of a storyView, or nothing when there is nothing to say. */
export function storyViewerState(
  fav: string | undefined,
  viewed: boolean,
): { viewer: { fav?: string; viewed?: boolean } } | Record<string, never> {
  if (!fav && !viewed) return {};
  return { viewer: { ...(fav ? { fav } : {}), ...(viewed ? { viewed: true } : {}) } };
}
