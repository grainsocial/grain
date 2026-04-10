import { defineQuery } from "$hatk";
import { views } from "$hatk";
import type { GrainActorProfile } from "$hatk";
import { hideLabelsFilter } from "../labels/_hidden.ts";
import { blockMuteFilter } from "../filters/blockMute.ts";

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export default defineQuery("social.grain.unspecced.getStoryAuthors", async (ctx) => {
  const { db, ok } = ctx;
  const viewer = ctx.viewer?.did;
  const cutoff = new Date(Date.now() - TWENTY_FOUR_HOURS).toISOString();

  const bmFilter = viewer ? `AND ${blockMuteFilter("s.did", "$2")}` : "";
  const params = viewer ? [cutoff, viewer] : [cutoff];

  // Aggregate in SQL, excluding stories with hide-severity labels
  const rows = (await db.query(
    `SELECT s.did, COUNT(*) AS story_count, MAX(s.created_at) AS latest_at
       FROM "social.grain.story" s
       LEFT JOIN _repos r ON s.did = r.did
       WHERE s.created_at > $1
         AND (r.status IS NULL OR r.status != 'takendown')
         AND ${hideLabelsFilter("s.uri")}
         ${bmFilter}
       GROUP BY s.did
       ORDER BY latest_at DESC`,
    params,
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
