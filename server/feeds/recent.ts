import { defineFeed } from "$hatk";
import { hydrateGalleries } from "./_hydrate.ts";

export default defineFeed({
  collection: "social.grain.gallery",
  label: "Recent Galleries",

  hydrate: hydrateGalleries,

  async generate(ctx) {
    const { rows, cursor } = await ctx.paginate<{ uri: string }>(
      `SELECT t.uri, t.cid, t.created_at FROM "social.grain.gallery" t
       LEFT JOIN _repos r ON t.did = r.did
       WHERE (r.status IS NULL OR r.status != 'takendown')
         AND (SELECT count(*) FROM "social.grain.gallery.item" gi WHERE gi.gallery = t.uri) > 0`,
      { orderBy: "t.created_at" },
    );

    return ctx.ok({ uris: rows.map((r) => r.uri), cursor });
  },
});
