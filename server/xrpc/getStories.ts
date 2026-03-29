import { defineQuery } from "$hatk";
import { hydrateStories, type StoryRow } from "../hydrate/stories.ts";

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export default defineQuery("social.grain.unspecced.getStories", async (ctx) => {
  const { db, ok } = ctx;
  const actor = ctx.params.actor;
  if (!actor) return ok({ stories: [] });

  const cutoff = new Date(Date.now() - TWENTY_FOUR_HOURS).toISOString();

  const rows = (await db.query(
    `SELECT s.uri, s.cid, s.did, s.media, s.aspect_ratio, s.location, s.address, s.created_at
       FROM "social.grain.story" s
       LEFT JOIN _repos r ON s.did = r.did
       WHERE s.did = $1 AND s.created_at > $2
         AND (r.status IS NULL OR r.status != 'takendown')
       ORDER BY s.created_at ASC`,
    [actor, cutoff],
  )) as StoryRow[];

  const stories = await hydrateStories(ctx, actor, rows);

  return ok({ stories });
});
