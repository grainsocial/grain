/**
 * Check if push notifications are enabled for a given category and actor.
 * Returns true if push should be sent (default behavior if no prefs set).
 */
export async function shouldPush(
  db: { query: (sql: string, params?: unknown[]) => Promise<unknown[]> },
  recipientDid: string,
  actorDid: string,
  category: "favorites" | "follows" | "comments" | "mentions",
): Promise<boolean> {
  const rows = (await db.query(
    `SELECT value FROM _preferences WHERE did = $1 AND key = 'notificationPrefs'`,
    [recipientDid],
  )) as { value: string }[];

  if (!rows[0]) return true;

  let prefs: Record<string, { push: boolean; inApp: boolean; from: string }>;
  try {
    prefs = typeof rows[0].value === "string" ? JSON.parse(rows[0].value) : rows[0].value;
  } catch {
    return true;
  }

  const pref = prefs[category];
  if (!pref) return true;
  if (pref.push === false) return false;

  // Check "from" filter
  if (pref.from === "follows") {
    const followRows = (await db.query(
      `SELECT 1 FROM "social.grain.graph.follow" WHERE did = $1 AND subject = $2 LIMIT 1`,
      [recipientDid, actorDid],
    )) as unknown[];
    return followRows.length > 0;
  }

  return true;
}
