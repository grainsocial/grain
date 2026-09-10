/**
 * Resolve a handle to a DID using _repos.
 * Returns the DID if already a DID, or looks up the handle.
 *
 * Handles are stored lowercase, and a URL typed or pasted by hand may carry
 * capitals or a leading `@`, so both are normalised away before the lookup.
 */
export async function resolveHandle(
  db: { query: (sql: string, params?: unknown[]) => Promise<unknown[]> },
  actor: string,
): Promise<string | null> {
  if (actor.startsWith("did:")) return actor;
  const handle = actor.replace(/^@/, "").toLowerCase();
  const rows = (await db.query(`SELECT did FROM _repos WHERE handle = $1`, [handle])) as {
    did: string;
  }[];
  return rows[0]?.did ?? null;
}

/**
 * Resolve a handle inside an AT URI (at://handle/...) to a DID-based URI.
 * Returns the URI unchanged if it already uses a DID.
 */
export async function resolveAtUri(
  db: { query: (sql: string, params?: unknown[]) => Promise<unknown[]> },
  uri: string,
): Promise<string | null> {
  const match = uri.match(/^at:\/\/([^/]+)\/(.+)$/);
  if (!match) return null;
  const [, authority, path] = match;
  const did = await resolveHandle(db, authority);
  if (!did) return null;
  return `at://${did}/${path}`;
}

/**
 * The segment that names an account in a grain URL: the handle when it has a
 * usable one, the DID otherwise. Mirrors `actorSegment` in the app, so links
 * the server hands out match the ones the app draws.
 */
export function actorSegment(did: string, handle?: string | null): string {
  if (handle && handle !== "handle.invalid" && !handle.startsWith("did:")) return handle;
  return did;
}
