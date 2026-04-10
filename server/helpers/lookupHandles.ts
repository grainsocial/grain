/**
 * Look up handles from _repos for a list of DIDs.
 * Used as a fallback when users don't have a grain profile.
 */
export async function lookupHandles(
  db: { query: (sql: string, params?: unknown[]) => Promise<unknown[]> },
  dids: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (dids.length === 0) return map;
  const rows = (await db.query(
    `SELECT did, handle FROM _repos WHERE did IN (${dids.map((_, i) => `$${i + 1}`).join(",")})`,
    dids,
  )) as { did: string; handle: string }[];
  for (const row of rows) map.set(row.did, row.handle);
  return map;
}
