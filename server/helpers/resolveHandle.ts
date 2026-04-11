/**
 * Resolve a handle to a DID using _repos.
 * Returns the DID if already a DID, or looks up the handle.
 */
export async function resolveHandle(
  db: { query: (sql: string, params?: unknown[]) => Promise<unknown[]> },
  actor: string,
): Promise<string | null> {
  if (actor.startsWith("did:")) return actor;
  const rows = (await db.query(`SELECT did FROM _repos WHERE handle = $1`, [actor])) as {
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
