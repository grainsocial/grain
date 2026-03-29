import { defineQuery } from "$hatk";
import { hydrateStories, type StoryRow } from "../hydrate/stories.ts";

export default defineQuery("social.grain.unspecced.getStoryArchive", async (ctx) => {
  const { db, ok } = ctx;
  const actor = ctx.params.actor;
  if (!actor) return ok({ stories: [] });

  const limit = Math.min(Number(ctx.params.limit) || 50, 100);
  const cursor = ctx.params.cursor as string | undefined;

  const queryParams: (string | number)[] = [actor, limit + 1];
  let cursorClause = "";
  if (cursor) {
    cursorClause = ` AND s.created_at < $3`;
    queryParams.push(cursor);
  }

  const rows = (await db.query(
    `SELECT s.uri, s.cid, s.did, s.media, s.aspect_ratio, s.location, s.address, s.created_at
       FROM "social.grain.story" s
       LEFT JOIN _repos r ON s.did = r.did
       WHERE s.did = $1
         AND (r.status IS NULL OR r.status != 'takendown')
         ${cursorClause}
       ORDER BY s.created_at DESC
       LIMIT $2`,
    queryParams,
  )) as StoryRow[];

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  const stories = await hydrateStories(ctx, actor, pageRows);

  const nextCursor = hasMore ? pageRows[pageRows.length - 1].created_at : undefined;

  return ok({ stories, ...(nextCursor ? { cursor: nextCursor } : {}) });
});
