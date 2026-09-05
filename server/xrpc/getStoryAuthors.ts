import { defineQuery } from "$hatk";
import { views } from "$hatk";
import type { GrainActorProfile } from "$hatk";
import { hideLabelsFilter, hideSelfLabelsFilter } from "../labels/_hidden.ts";
import { blockMuteFilter } from "../filters/blockMute.ts";
import { lookupHandles } from "../helpers/lookupHandles.ts";

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export default defineQuery("social.grain.unspecced.getStoryAuthors", async (ctx) => {
  const { db, ok } = ctx;
  const viewer = ctx.viewer?.did;
  const cutoff = new Date(Date.now() - TWENTY_FOUR_HOURS).toISOString();

  const bmFilter = viewer ? `AND ${blockMuteFilter("s.did", "$2")}` : "";
  const params = viewer ? [cutoff, viewer] : [cutoff];

  // What the viewer has watched rides along on the same aggregate: the newest
  // watched story's createdAt is the high-water mark a client compares against
  // latestAt, and the unwatched count is what it draws on the ring.
  const viewJoin = viewer ? `LEFT JOIN _story_views v ON v.subject = s.uri AND v.did = $2` : "";
  const viewCols = viewer
    ? `, MAX(CASE WHEN v.subject IS NOT NULL THEN s.created_at END) AS last_viewed_at,
         SUM(CASE WHEN v.subject IS NULL THEN 1 ELSE 0 END) AS unviewed_count`
    : "";

  // Aggregate in SQL, excluding stories with hide-severity labels, whether
  // from a labeler or the author. getStories drops both before serving, so
  // counting them here would leave a ring that never greys out.
  const rows = (await db.query(
    `SELECT s.did, COUNT(*) AS story_count, MAX(s.created_at) AS latest_at ${viewCols}
       FROM "social.grain.story" s
       LEFT JOIN _repos r ON s.did = r.did
       ${viewJoin}
       WHERE s.created_at > $1
         AND (r.status IS NULL OR r.status != 'takendown')
         AND ${hideLabelsFilter("s.uri")}
         AND ${hideSelfLabelsFilter("social.grain.story__labels_self_labels", "s.uri")}
         ${bmFilter}
       GROUP BY s.did
       ORDER BY latest_at DESC`,
    params,
  )) as {
    did: string;
    story_count: number;
    latest_at: string;
    last_viewed_at?: string | null;
    unviewed_count?: number | null;
  }[];

  const dids = rows.map((r) => r.did);
  const [profiles, handleMap] = await Promise.all([
    ctx.lookup<GrainActorProfile>("social.grain.actor.profile", "did", dids),
    lookupHandles(db, dids),
  ]);

  const authors = rows.map((row) => {
    const author = profiles.get(row.did);
    return {
      profile: author
        ? views.grainActorDefsProfileView({
            cid: author.cid,
            did: author.did,
            handle: author.handle ?? handleMap.get(author.did) ?? author.did,
            displayName: author.value.displayName,
            avatar: ctx.blobUrl(author.did, author.value.avatar) ?? undefined,
          })
        : views.grainActorDefsProfileView({
            cid: "",
            did: row.did,
            handle: handleMap.get(row.did) ?? row.did,
          }),
      storyCount: row.story_count,
      latestAt: row.latest_at,
      ...(viewer
        ? {
            unviewedCount: Number(row.unviewed_count ?? row.story_count),
            ...(row.last_viewed_at ? { lastViewedAt: row.last_viewed_at } : {}),
          }
        : {}),
    };
  });

  return ok({ authors });
});
