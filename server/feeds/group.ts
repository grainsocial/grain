import { defineFeed } from "$hatk";
import { hydrateGalleries } from "../hydrate/galleries.ts";
import { hideLabelsFilter } from "../labels/_hidden.ts";

/** One group's pool, most recently pooled first. */
export default defineFeed({
  collection: "social.grain.gallery",
  label: "Group Pool",

  hydrate: hydrateGalleries,

  async generate(ctx) {
    const group = ctx.params.group;
    if (!group) return ctx.ok({ uris: [], cursor: undefined });

    const { rows, cursor } = await ctx.paginate<{ uri: string }>(
      `SELECT g.uri, gi.cid, gi.created_at
       FROM "social.grain.group.item" gi
       JOIN "social.grain.gallery" g ON g.uri = gi.gallery
       LEFT JOIN _repos r ON g.did = r.did
       WHERE gi.did = $1
         AND (r.status IS NULL OR r.status != 'takendown')
         AND ${hideLabelsFilter("g.uri")}
         AND (SELECT count(*) FROM "social.grain.gallery.item" x WHERE x.gallery = g.uri) > 0`,
      { params: [group], orderBy: "gi.created_at" },
    );

    return ctx.ok({ uris: rows.map((r) => r.uri), cursor });
  },
});
