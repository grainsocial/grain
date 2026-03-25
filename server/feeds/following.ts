import { defineFeed } from "$hatk";
import { hydrateGalleries } from "./_hydrate.ts";
import { hideLabelsFilter } from "../labels/_hidden.ts";

export default defineFeed({
  collection: "social.grain.gallery",
  label: "Following",

  hydrate: hydrateGalleries,

  async generate(ctx) {
    const actor = ctx.params.actor;
    if (!actor) return ctx.ok({ uris: [] });

    const { rows, cursor } = await ctx.paginate<{ uri: string }>(
      `SELECT t.uri, t.cid, t.created_at FROM "social.grain.gallery" t
       LEFT JOIN _repos r ON t.did = r.did
       WHERE (r.status IS NULL OR r.status != 'takendown')
         AND t.did IN (SELECT subject FROM "social.grain.graph.follow" WHERE did = $1)
         AND ${hideLabelsFilter("t.uri")}
         AND (SELECT count(*) FROM "social.grain.gallery.item" gi WHERE gi.gallery = t.uri) > 0`,
      { orderBy: "t.created_at", params: [actor] },
    );

    return ctx.ok({ uris: rows.map((r) => r.uri), cursor });
  },
});
