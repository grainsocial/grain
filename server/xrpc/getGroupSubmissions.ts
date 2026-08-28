import { defineQuery, views } from "$hatk";
import type { Gallery } from "$hatk";
import { hydrateGalleries } from "../hydrate/galleries.ts";
import { memberOf } from "../hydrate/groups.ts";

/** The review queue: members' submissions the group has neither accepted nor declined. */
export default defineQuery("social.grain.unspecced.getGroupSubmissions", async (ctx) => {
  const { params, ok, db } = ctx;
  const limit = params.limit ?? 30;
  const rows = (await db.query(
    `SELECT s.uri, s.cid, s.gallery, s.created_at FROM "social.grain.group.submission" s
     LEFT JOIN _repos r ON r.did = s.did
     WHERE s."group" = $1
       AND (r.status IS NULL OR r.status != 'takendown')
       AND ${memberOf("s.did", 's."group"')}
       AND NOT EXISTS (SELECT 1 FROM "social.grain.group.item" i WHERE i.did = s."group" AND i.gallery = s.gallery)
       AND NOT EXISTS (SELECT 1 FROM "social.grain.group.decline" d WHERE d.did = s."group" AND d.submission = s.uri)
     ORDER BY s.created_at DESC
     LIMIT $2`,
    [params.group, limit],
  )) as { uri: string; cid: string; gallery: string; created_at: string }[];

  const galleries = await ctx.getRecords<Gallery>("social.grain.gallery", [
    ...new Set(rows.map((r) => r.gallery)),
  ]);
  const galleryViews = await hydrateGalleries(ctx, [...galleries.values()]);
  const viewByUri = new Map(galleryViews.map((g) => [g.uri, g]));

  const submissions = rows.flatMap((r) => {
    const gallery = viewByUri.get(r.gallery);
    if (!gallery) return []; // the gallery was deleted; nothing to review
    return [
      views.submissionView({
        uri: r.uri,
        cid: r.cid,
        group: params.group,
        gallery,
        createdAt: r.created_at,
      }),
    ];
  });
  return ok({ submissions });
});
