import type { BaseContext } from "$hatk";

/**
 * Returns true when `actor`'s push notification should be suppressed for
 * `recipient`: the recipient blocked or muted them, or either party blocked
 * the other. Matches the block/mute filter applied to the in-app
 * notification list (getNotifications), so a push can't announce something
 * the list would hide.
 */
export async function isBlockedOrMuted(
  db: BaseContext["db"],
  recipient: string,
  actor: string,
): Promise<boolean> {
  // One LIMIT, after the last UNION ALL. SQLite rejects a LIMIT on a branch of
  // a compound SELECT outright ("LIMIT clause should come after UNION ALL not
  // before"), so a per-branch LIMIT does not merely fail to narrow the query —
  // it fails to parse, and every caller throws.
  const rows = (await db.query(
    `SELECT 1 FROM _mutes WHERE did = $1 AND subject = $2
     UNION ALL
     SELECT 1 FROM "social.grain.graph.block" WHERE did = $1 AND subject = $2
     UNION ALL
     SELECT 1 FROM "social.grain.graph.block" WHERE did = $2 AND subject = $1
     LIMIT 1`,
    [recipient, actor],
  )) as unknown[];
  return rows.length > 0;
}
