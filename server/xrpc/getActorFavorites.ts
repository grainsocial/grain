import { defineQuery } from "$hatk";
import type { Gallery } from "$hatk";
import { hydrateGalleries } from "../hydrate/galleries.ts";
import { hideLabelsFilter } from "../labels/_hidden.ts";

export default defineQuery("social.grain.unspecced.getActorFavorites", async (ctx) => {
  const { db, ok, getRecords } = ctx;
  const actor = ctx.params.actor;
  if (!actor) return ok({ items: [] });

  // Only the actor themselves can view their favorites
  if (ctx.viewer?.did !== actor) return ok({ items: [] });

  const limit = Math.min(Number(ctx.params.limit) || 30, 100);
  const cursor = ctx.params.cursor as string | undefined;

  const queryParams: (string | number)[] = [actor, limit + 1];
  let cursorClause = "";
  if (cursor) {
    cursorClause = ` AND f.created_at < $3`;
    queryParams.push(cursor);
  }

  const rows = (await db.query(
    `SELECT f.subject, f.created_at
     FROM "social.grain.favorite" f
     JOIN "social.grain.gallery" t ON t.uri = f.subject
     LEFT JOIN _repos r ON t.did = r.did
     WHERE f.did = $1
       AND (r.status IS NULL OR r.status != 'takendown')
       AND ${hideLabelsFilter("t.uri")}
       AND (SELECT count(*) FROM "social.grain.gallery.item" gi WHERE gi.gallery = t.uri) > 0
     ${cursorClause}
     ORDER BY f.created_at DESC
     LIMIT $2`,
    queryParams,
  )) as { subject: string; created_at: string }[];

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  const recordsMap = await getRecords<Gallery>(
    "social.grain.gallery",
    pageRows.map((r) => r.subject),
  );

  // Preserve favorite ordering
  const galleryRows = pageRows
    .map((r) => recordsMap.get(r.subject))
    .filter((r) => r != null);

  const items = await hydrateGalleries(ctx, galleryRows);

  const nextCursor = hasMore ? pageRows[pageRows.length - 1].created_at : undefined;

  return ok({ items, ...(nextCursor ? { cursor: nextCursor } : {}) });
});
