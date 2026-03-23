import { defineFeed } from "$hatk";
import { hydrateGalleries } from "./_hydrate.ts";

export default defineFeed({
  collection: "social.grain.gallery",
  label: "Actor Galleries",

  hydrate: hydrateGalleries,

  async generate(ctx) {
    const { params, ok, isTakendown } = ctx;

    const actor = params.actor;
    if (!actor) {
      return ok({ uris: [], cursor: undefined });
    }

    if (await isTakendown(actor)) {
      return ok({ uris: [], cursor: undefined });
    }

    const { rows, cursor } = await ctx.paginate<{ uri: string }>(
      `SELECT t.uri, t.cid, t.created_at
       FROM "social.grain.gallery" t
       WHERE t.did = $1
         AND (SELECT count(*) FROM "social.grain.gallery.item" gi WHERE gi.gallery = t.uri) > 0`,
      { params: [actor], orderBy: "t.created_at" },
    );

    return ok({ uris: rows.map((r) => r.uri), cursor });
  },
});
