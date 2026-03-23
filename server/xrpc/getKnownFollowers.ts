// Returns followers of `actor` that `viewer` also follows.
//   GET /xrpc/social.grain.unspecced.getKnownFollowers?actor=did:...&viewer=did:...

import { defineQuery, type GrainActorProfile } from "$hatk";

export default defineQuery("social.grain.unspecced.getKnownFollowers", async (ctx) => {
  const { ok, params, lookup, blobUrl } = ctx;
  const { actor, viewer, limit = 50 } = params;

  if (!actor || !viewer || actor === viewer) return ok({ items: [] });

  // Find DIDs that follow `actor` AND are followed by `viewer`
  const rows = (await ctx.db.query(
    `SELECT f1.did
     FROM "social.grain.graph.follow" f1
     JOIN "social.grain.graph.follow" f2 ON f2.did = $2 AND f2.subject = f1.did
     WHERE f1.subject = $1
     ORDER BY f1.created_at DESC
     LIMIT $3`,
    [actor, viewer, Number(limit)],
  )) as { did: string }[];

  const dids = [...new Set(rows.map((r) => r.did))];

  const profiles = await lookup<GrainActorProfile>("social.grain.actor.profile", "did", dids);

  const items = dids.map((did) => {
    const p = profiles.get(did);
    return {
      did,
      handle: p?.handle ?? did,
      displayName: p?.value.displayName,
      description: p?.value.description,
      avatar: p ? blobUrl(did, p.value.avatar, "avatar") : undefined,
    };
  });

  return ok({ items });
});
