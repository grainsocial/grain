import { defineQuery, type GrainActorProfile } from "$hatk";
import { lookupHandles } from "../helpers/lookupHandles.ts";
import { blockFilter } from "../filters/blockMute.ts";

export default defineQuery("social.grain.unspecced.getFollowing", async (ctx) => {
  const { ok, params, lookup, blobUrl, packCursor, unpackCursor } = ctx;
  const { actor, limit = 50, cursor } = params;
  const viewer = params.viewer ?? ctx.viewer?.did;

  const offset = cursor ? Number(unpackCursor(cursor)?.primary ?? 0) : 0;

  // Taken-down accounts are hidden from everyone, matching every feed.
  // Blocked accounts (either direction) are hidden from the list and count.
  // Mutes are not applied — a mute hides someone's content, not the fact
  // that they follow someone.
  const takedowns = `AND (r.status IS NULL OR r.status != 'takendown')`;
  const blocks = viewer ? `AND ${blockFilter("f.subject", "$2")}` : "";
  const blockParams = viewer ? [viewer] : [];

  const [rows, countRows] = await Promise.all([
    ctx.db.query(
      `SELECT f.subject AS subject, f.cid AS cid FROM "social.grain.graph.follow" f
       LEFT JOIN _repos r ON r.did = f.subject
       WHERE f.did = $1 ${takedowns} ${blocks}
       ORDER BY f.created_at DESC LIMIT $${blockParams.length + 2} OFFSET $${blockParams.length + 3}`,
      [actor, ...blockParams, Number(limit) + 1, offset],
    ) as Promise<{ subject: string; cid: string }[]>,
    // DISTINCT: duplicate follow records for the same subject would otherwise
    // inflate the following count past the number of accounts actually listed.
    ctx.db.query(
      `SELECT COUNT(DISTINCT f.subject) as count FROM "social.grain.graph.follow" f
       LEFT JOIN _repos r ON r.did = f.subject
       WHERE f.did = $1 ${takedowns} ${blocks}`,
      [actor, ...blockParams],
    ) as Promise<{ count: number }[]>,
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
