import { defineQuery, type GrainActorProfile } from "$hatk";

export default defineQuery("social.grain.unspecced.getFollowers", async (ctx) => {
  const { ok, params, lookup, blobUrl, packCursor, unpackCursor } = ctx;
  const { actor, limit = 50, cursor } = params;

  const offset = cursor ? Number(unpackCursor(cursor)?.primary ?? 0) : 0;

  const rows = (await ctx.db.query(
    `SELECT did, cid FROM "social.grain.graph.follow" WHERE subject = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [actor, Number(limit) + 1, offset],
  )) as { did: string; cid: string }[];

  const hasMore = rows.length > Number(limit);
  const page = hasMore ? rows.slice(0, Number(limit)) : rows;
  const dids = [...new Set(page.map((r) => r.did))];

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

  const nextOffset = offset + Number(limit);
  const lastRow = page[page.length - 1];

  return ok({
    items,
    ...(hasMore && lastRow ? { cursor: packCursor(nextOffset, lastRow.cid) } : {}),
  });
});
