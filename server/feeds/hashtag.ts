import { defineFeed } from "$hatk";
import { hydrateGalleries } from "./_hydrate.ts";

export default defineFeed({
  collection: "social.grain.gallery",
  label: "Hashtag",

  hydrate: hydrateGalleries,

  async generate(ctx) {
    const tag = ctx.params.tag;
    if (!tag) return ctx.ok({ uris: [] });

    const pattern = `%#${tag}%`;

    const { rows, cursor } = await ctx.paginate<{ uri: string }>(
      `SELECT t.uri, t.cid, t.created_at FROM "social.grain.gallery" t
       LEFT JOIN _repos r ON t.did = r.did
       WHERE (r.status IS NULL OR r.status != 'takendown')
         AND (
           t.description LIKE $1
           OR EXISTS (SELECT 1 FROM "social.grain.comment" c WHERE c.subject = t.uri AND c.text LIKE $1)
         )
         AND (SELECT count(*) FROM "social.grain.gallery.item" gi WHERE gi.gallery = t.uri) > 0`,
      { orderBy: "t.created_at", params: [pattern] },
    );

    return ctx.ok({ uris: rows.map((r) => r.uri), cursor });
  },
});
