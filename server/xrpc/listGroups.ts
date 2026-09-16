import { defineQuery } from "$hatk";
import { hydrateGroups } from "../hydrate/groups.ts";

export default defineQuery("social.grain.unspecced.listGroups", async (ctx) => {
  const { params, ok, db } = ctx;
  const limit = params.limit ?? 50;
  // Every declared community, the ones whose pool moved most recently first;
  // a group with an empty pool still lists, or nobody could ever submit to it.
  const rows = (await db.query(
    `SELECT d.did FROM "fyi.opensocial.declaration" d
     LEFT JOIN _repos r ON r.did = d.did
     LEFT JOIN (SELECT did, MAX(created_at) AS last FROM "social.grain.group.item" GROUP BY did) p ON p.did = d.did
     WHERE (r.status IS NULL OR r.status != 'takendown')
     ORDER BY p.last DESC NULLS LAST, d.created_at DESC
     LIMIT $1`,
    [limit],
  )) as { did: string }[];
  const groups = await hydrateGroups(
    ctx,
    rows.map((r) => r.did),
    { gallery: params.gallery },
  );
  return ok({ groups });
});
