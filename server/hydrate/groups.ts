import { views } from "$hatk";
import type { BaseContext, GrainActorProfile, GroupView } from "$hatk";
import { lookupHandles } from "../helpers/lookupHandles.ts";

/**
 * Build group views for a set of community DIDs.
 *
 * A group is just an account that (a) declared itself a community and (b) is
 * read like any other author: its Grain profile is its identity, and its
 * `social.grain.group.item` records are its pool. Nothing here talks to the
 * community host — the pool, the queue and the viewer's standing all fall out
 * of public records already indexed.
 */
export async function hydrateGroups(
  ctx: BaseContext,
  dids: string[],
  opts: { gallery?: string } = {},
): Promise<GroupView[]> {
  if (dids.length === 0) return [];
  const placeholders = dids.map((_, i) => `$${i + 1}`).join(",");
  const viewer = ctx.viewer?.did;

  const [profiles, handleMap, poolRows, pendingRows, submissionRows, itemRows] = await Promise.all([
    ctx.lookup<GrainActorProfile>("social.grain.actor.profile", "did", dids),
    lookupHandles(ctx.db, dids),
    ctx.db.query(
      `SELECT did, COUNT(*) AS count, MAX(created_at) AS last
       FROM "social.grain.group.item" WHERE did IN (${placeholders}) GROUP BY did`,
      dids,
    ) as Promise<{ did: string; count: number; last: string }[]>,
    // The queue only matters to whoever is acting as the group, and that is
    // the one viewer whose DID is the group's.
    viewer && dids.includes(viewer)
      ? (ctx.db.query(
          `SELECT COUNT(*) AS count FROM "social.grain.group.submission" s
           WHERE s."group" = $1
             AND NOT EXISTS (SELECT 1 FROM "social.grain.group.item" i
                             WHERE i.did = s."group" AND i.gallery = s.gallery)`,
          [viewer],
        ) as Promise<{ count: number }[]>)
      : Promise.resolve([]),
    viewer && opts.gallery
      ? (ctx.db.query(
          `SELECT s.uri, s."group" AS grp FROM "social.grain.group.submission" s
           WHERE s.did = $1 AND s.gallery = $2 AND s."group" IN (${dids.map((_, i) => `$${i + 3}`).join(",")})`,
          [viewer, opts.gallery, ...dids],
        ) as Promise<{ uri: string; grp: string }[]>)
      : Promise.resolve([]),
    opts.gallery
      ? (ctx.db.query(
          `SELECT uri, did FROM "social.grain.group.item"
           WHERE gallery = $1 AND did IN (${dids.map((_, i) => `$${i + 2}`).join(",")})`,
          [opts.gallery, ...dids],
        ) as Promise<{ uri: string; did: string }[]>)
      : Promise.resolve([]),
  ]);

  const pool = new Map(poolRows.map((r) => [r.did, r]));
  const submissionByGroup = new Map(submissionRows.map((r) => [r.grp, r.uri]));
  const itemByGroup = new Map(itemRows.map((r) => [r.did, r.uri]));
  const pending = Number(pendingRows[0]?.count ?? 0);

  return dids.map((did) => {
    const p = profiles.get(did);
    const acting = viewer === did;
    const submission = submissionByGroup.get(did);
    const item = itemByGroup.get(did);
    const standing = submission
      ? { uri: submission, status: item ? "accepted" : "pending", ...(item ? { item } : {}) }
      : item
        ? { uri: item, status: "accepted", item }
        : undefined;
    return views.groupView({
      did,
      handle: p?.handle ?? handleMap.get(did) ?? did,
      displayName: p?.value.displayName,
      description: p?.value.description,
      avatar: p ? (ctx.blobUrl(did, p.value.avatar, "avatar") ?? undefined) : undefined,
      poolCount: Number(pool.get(did)?.count ?? 0),
      ...(pool.get(did)?.last ? { lastActivityAt: pool.get(did)!.last } : {}),
      ...(acting ? { pendingCount: pending } : {}),
      ...(acting || standing
        ? {
            viewer: {
              ...(acting ? { acting } : {}),
              ...(standing ? { submission: standing } : {}),
            },
          }
        : {}),
    });
  });
}

/** DID or handle → DID, or null when unknown. */
export async function resolveGroupActor(ctx: BaseContext, actor: string): Promise<string | null> {
  let did = actor;
  if (!did.startsWith("did:")) {
    const rows = (await ctx.db.query(`SELECT did FROM _repos WHERE handle = $1`, [actor])) as {
      did: string;
    }[];
    if (!rows[0]?.did) return null;
    did = rows[0].did;
  }
  const declared = (await ctx.db.query(
    `SELECT 1 AS v FROM "community.opensocial.declaration" WHERE did = $1 LIMIT 1`,
    [did],
  )) as { v: number }[];
  return declared.length ? did : null;
}
