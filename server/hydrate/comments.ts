import type { BaseContext } from "$hatk";

/** SQL condition that excludes orphaned replies (parent comment was deleted). */
export const NOT_ORPHANED = `(c.reply_to IS NULL OR EXISTS (
  SELECT 1 FROM "social.grain.comment" p WHERE p.uri = c.reply_to
))`;

/** Count non-orphaned comments grouped by subject URI. */
export async function countComments(
  db: BaseContext["db"],
  subjectUris: string[],
): Promise<Map<string, number>> {
  if (subjectUris.length === 0) return new Map();
  const placeholders = subjectUris.map((_, i) => `$${i + 1}`).join(",");
  const rows = (await db.query(
    `SELECT c.subject, COUNT(*) as count FROM "social.grain.comment" c
     WHERE c.subject IN (${placeholders}) AND ${NOT_ORPHANED}
     GROUP BY c.subject`,
    subjectUris,
  )) as { subject: string; count: number }[];
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.subject, Number(r.count));
  return m;
}
