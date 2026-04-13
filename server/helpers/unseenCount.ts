/**
 * Query the unseen notification count for a DID.
 * Used to set the badge number on push notifications.
 */

function blockMuteFilter(didCol = "did"): string {
  return `
    AND ${didCol} NOT IN (SELECT subject FROM "social.grain.graph.block" WHERE did = $1)
    AND ${didCol} NOT IN (SELECT did FROM "social.grain.graph.block" WHERE subject = $1)
    AND ${didCol} NOT IN (SELECT subject FROM _mutes WHERE did = $1)
  `;
}

export async function getUnseenCount(
  db: { query: (sql: string, params?: unknown[]) => Promise<unknown[]> },
  did: string,
): Promise<number> {
  const prefRows = (await db.query(
    `SELECT value FROM _preferences WHERE did = $1 AND key = 'lastSeenNotifications'`,
    [did],
  )) as { value: string }[];

  let lastSeen: string | null = null;
  if (prefRows[0]) {
    try {
      lastSeen = typeof prefRows[0].value === "string" ? JSON.parse(prefRows[0].value) : prefRows[0].value;
    } catch {}
  }

  const timeFilter = lastSeen ? `AND created_at > $2` : "";
  const params = lastSeen ? [did, lastSeen] : [did];

  const rows = (await db.query(
    `SELECT count(*) as cnt FROM (
      SELECT uri FROM "social.grain.favorite"
      WHERE subject IN (SELECT uri FROM "social.grain.gallery" WHERE did = $1)
        AND did != $1 ${blockMuteFilter()} ${timeFilter}
      UNION ALL
      SELECT uri FROM "social.grain.comment"
      WHERE subject IN (SELECT uri FROM "social.grain.gallery" WHERE did = $1)
        AND did != $1 AND reply_to IS NULL ${blockMuteFilter()} ${timeFilter}
      UNION ALL
      SELECT c.uri FROM "social.grain.comment" c
      WHERE c.reply_to IN (SELECT uri FROM "social.grain.comment" WHERE did = $1)
        AND c.did != $1 ${blockMuteFilter("c.did")} ${timeFilter}
      UNION ALL
      SELECT uri FROM "social.grain.graph.follow"
      WHERE subject = $1 AND did != $1 ${blockMuteFilter()} ${timeFilter}
      UNION ALL
      SELECT uri FROM "social.grain.favorite"
      WHERE subject IN (SELECT uri FROM "social.grain.story" WHERE did = $1)
        AND did != $1 ${blockMuteFilter()} ${timeFilter}
      UNION ALL
      SELECT uri FROM "social.grain.comment"
      WHERE subject IN (SELECT uri FROM "social.grain.story" WHERE did = $1)
        AND did != $1 AND reply_to IS NULL ${blockMuteFilter()} ${timeFilter}
    )`,
    params,
  )) as { cnt: number }[];

  return rows[0]?.cnt ?? 0;
}
