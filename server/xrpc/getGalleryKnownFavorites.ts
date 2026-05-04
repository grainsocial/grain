// Returns people the viewer follows who have favorited a given gallery.
//   GET /xrpc/social.grain.unspecced.getGalleryKnownFavorites?gallery=at://...&viewer=did:...

import { defineQuery, type GrainActorProfile } from "$hatk";
import { lookupHandles } from "../helpers/lookupHandles.ts";

export default defineQuery("social.grain.unspecced.getGalleryKnownFavorites", async (ctx) => {
  const { ok, params, lookup, blobUrl } = ctx;
  const { gallery, viewer, limit = 50 } = params;

  if (!gallery || !viewer) return ok({ items: [] });

  // Start from the viewer's follows (bounded), join to favorites.
  // This avoids a full scan of the gallery's favorites for popular galleries.
  const rows = (await ctx.db.query(
    `SELECT fav.did
     FROM "social.grain.graph.follow" follows
     JOIN "social.grain.favorite" fav
       ON fav.did = follows.subject AND fav.subject = $1
     WHERE follows.did = $2
     ORDER BY fav.created_at DESC
     LIMIT $3`,
    [gallery, viewer, Number(limit)],
  )) as { did: string }[];

  const dids = [...new Set(rows.map((r) => r.did))];

  const profiles = await lookup<GrainActorProfile>("social.grain.actor.profile", "did", dids);

  const handleMap = await lookupHandles(ctx.db, dids);

  const items = dids.map((did) => {
    const p = profiles.get(did);
    return {
      did,
      handle: p?.handle ?? handleMap.get(did) ?? did,
      displayName: p?.value.displayName,
      description: p?.value.description,
      avatar: p ? blobUrl(did, p.value.avatar, "avatar") : undefined,
    };
  });

  return ok({ items });
});
