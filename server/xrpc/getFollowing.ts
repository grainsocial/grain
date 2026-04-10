import { defineQuery, type GrainActorProfile } from "$hatk";
import { lookupHandles } from "../helpers/lookupHandles.ts";

export default defineQuery("social.grain.unspecced.getFollowing", async (ctx) => {
  const { ok, params, lookup, blobUrl, packCursor, unpackCursor } = ctx;
  const { actor, viewer, limit = 50, cursor } = params;

  const offset = cursor ? Number(unpackCursor(cursor)?.primary ?? 0) : 0;

  const [rows, countRows] = await Promise.all([
    ctx.db.query(
      `SELECT subject, cid FROM "social.grain.graph.follow" WHERE did = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [actor, Number(limit) + 1, offset],
    ) as Promise<{ subject: string; cid: string }[]>,
    ctx.db.query(`SELECT COUNT(*) as count FROM "social.grain.graph.follow" WHERE did = $1`, [
      actor,
    ]) as Promise<{ count: number }[]>,
  ]);
  const totalCount = Number(countRows[0]?.count ?? 0);

  const hasMore = rows.length > Number(limit);
  const page = hasMore ? rows.slice(0, Number(limit)) : rows;
  const dids = [...new Set(page.map((r) => r.subject))];

  const [profiles, viewerFollows] = await Promise.all([
    lookup<GrainActorProfile>("social.grain.actor.profile", "did", dids),
    viewer && dids.length > 0
      ? (ctx.db.query(
          `SELECT subject, uri FROM "social.grain.graph.follow" WHERE did = $1 AND subject IN (${dids.map((_, i) => `$${i + 2}`).join(", ")})`,
          [viewer, ...dids],
        ) as Promise<{ subject: string; uri: string }[]>)
      : Promise.resolve([] as { subject: string; uri: string }[]),
  ]);

  const viewerFollowMap = new Map(viewerFollows.map((r) => [r.subject, r.uri]));

  const handleMap = await lookupHandles(ctx.db, dids);

  const items = dids.map((did) => {
    const p = profiles.get(did);
    return {
      did,
      handle: p?.handle ?? handleMap.get(did) ?? did,
      displayName: p?.value.displayName,
      description: p?.value.description,
      avatar: p ? blobUrl(did, p.value.avatar, "avatar") : undefined,
      ...(viewer ? { viewer: { following: viewerFollowMap.get(did) } } : {}),
    };
  });

  const nextOffset = offset + Number(limit);
  const lastRow = page[page.length - 1];

  return ok({
    totalCount,
    items,
    ...(hasMore && lastRow ? { cursor: packCursor(nextOffset, lastRow.cid) } : {}),
  });
});
