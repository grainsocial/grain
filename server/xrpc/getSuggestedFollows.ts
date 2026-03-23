import { defineQuery, type GrainActorProfile } from "$hatk";

export default defineQuery("social.grain.unspecced.getSuggestedFollows", async (ctx) => {
  const { ok, params, lookup, blobUrl, db } = ctx;
  const { actor, limit = 10 } = params;

  if (!actor) return ok({ items: [] });

  // 1. Bsky follows who have grain profiles but viewer doesn't grain-follow
  const bskyRows = (await db.query(
    `SELECT bf.subject FROM "app.bsky.graph.follow" bf
     INNER JOIN "social.grain.actor.profile" gp ON gp.did = bf.subject
     LEFT JOIN _repos r ON bf.subject = r.did
     WHERE bf.did = $1
       AND bf.subject != $1
       AND (r.status IS NULL OR r.status != 'takendown')
       AND bf.subject NOT IN (
         SELECT gf.subject FROM "social.grain.graph.follow" gf WHERE gf.did = $1
       )
     LIMIT $2`,
    [actor, Number(limit)],
  )) as { subject: string }[];

  const dids = bskyRows.map((r) => r.subject);

  // 2. Backfill with popular grain profiles if not enough results
  if (dids.length < Number(limit)) {
    const remaining = Number(limit) - dids.length;
    const exclude = [actor, ...dids];
    const placeholders = exclude.map((_, i) => `$${i + 1}`).join(",");

    const backfillRows = (await db.query(
      `SELECT gp.did,
              (SELECT count(*) FROM "social.grain.graph.follow" f WHERE f.subject = gp.did) as follower_count
       FROM "social.grain.actor.profile" gp
       LEFT JOIN _repos r ON gp.did = r.did
       WHERE gp.did NOT IN (${placeholders})
         AND (r.status IS NULL OR r.status != 'takendown')
         AND gp.did NOT IN (
           SELECT gf.subject FROM "social.grain.graph.follow" gf WHERE gf.did = $1
         )
       ORDER BY follower_count DESC
       LIMIT $${exclude.length + 1}`,
      [...exclude, remaining],
    )) as { did: string }[];

    for (const row of backfillRows) {
      dids.push(row.did);
    }
  }

  if (dids.length === 0) return ok({ items: [] });

  const profiles = await lookup<GrainActorProfile>("social.grain.actor.profile", "did", dids);

  // Count followers for each
  const followerCounts = new Map<string, number>();
  if (dids.length > 0) {
    const ph = dids.map((_, i) => `$${i + 1}`).join(",");
    const countRows = (await db.query(
      `SELECT subject, count(*) as cnt FROM "social.grain.graph.follow"
       WHERE subject IN (${ph}) GROUP BY subject`,
      dids,
    )) as { subject: string; cnt: number }[];
    for (const r of countRows) {
      followerCounts.set(r.subject, Number(r.cnt));
    }
  }

  const items = dids.map((did) => {
    const p = profiles.get(did);
    return {
      did,
      handle: p?.handle ?? did,
      displayName: p?.value.displayName,
      description: p?.value.description,
      avatar: p ? blobUrl(did, p.value.avatar, "avatar") : undefined,
      followersCount: followerCounts.get(did) ?? 0,
    };
  });

  return ok({ items });
});
