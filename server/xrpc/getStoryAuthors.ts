import { defineQuery } from "$hatk";
import { views } from "$hatk";
import type { GrainActorProfile } from "$hatk";

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export default defineQuery("social.grain.unspecced.getStoryAuthors", async (ctx) => {
  const { db, ok } = ctx;
  const cutoff = new Date(Date.now() - TWENTY_FOUR_HOURS).toISOString();

  // Get authors with active stories, ordered by most recent
  const rows = (await db.query(
    `SELECT did, COUNT(*) AS story_count, MAX(created_at) AS latest_at
       FROM "social.grain.story"
       WHERE created_at > $1
       GROUP BY did
       ORDER BY latest_at DESC`,
    [cutoff],
  )) as { did: string; story_count: number; latest_at: string }[];

  const dids = rows.map((r) => r.did);
  const profiles = await ctx.lookup<GrainActorProfile>("social.grain.actor.profile", "did", dids);

  const authors = rows.map((row) => {
    const author = profiles.get(row.did);
    return {
      profile: author
        ? views.grainActorDefsProfileView({
            cid: author.cid,
            did: author.did,
            handle: author.handle ?? author.did,
            displayName: author.value.displayName,
            avatar: ctx.blobUrl(author.did, author.value.avatar) ?? undefined,
          })
        : views.grainActorDefsProfileView({
            cid: "",
            did: row.did,
            handle: row.did,
          }),
      storyCount: row.story_count,
      latestAt: row.latest_at,
    };
  });

  return ok({ authors });
});
