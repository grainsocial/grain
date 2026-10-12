import { defineFeed } from "$hatk";
import { hydrateGalleries } from "../hydrate/galleries.ts";
import { hideLabelsFilter } from "../labels/_hidden.ts";
import { resolveHandle } from "../helpers/resolveHandle.ts";

export default defineFeed({
  collection: "social.grain.gallery",
  label: "Actor Galleries",

  hydrate: hydrateGalleries,

  async generate(ctx) {
    const { params, ok, isTakendown } = ctx;

    const actor = params.actor ? await resolveHandle(ctx.db, params.actor) : null;
    if (!actor) {
      return ok({ uris: [], cursor: undefined });
    }

    if (await isTakendown(actor)) {
      return ok({ uris: [], cursor: undefined });
    }

    // Optional `before` (ISO date): start the feed at an earlier point, e.g. a year.
    const before = params.before && !Number.isNaN(Date.parse(params.before)) ? params.before : null;

    const { rows, cursor } = await ctx.paginate<{ uri: string }>(
      `SELECT t.uri, t.cid, t.created_at
       FROM "social.grain.gallery" t
       WHERE t.did = $1
         ${before ? "AND t.created_at < $2" : ""}
         AND ${hideLabelsFilter("t.uri")}
         AND (SELECT count(*) FROM "social.grain.gallery.item" gi WHERE gi.gallery = t.uri) > 0`,
      { params: before ? [actor, before] : [actor], orderBy: "t.created_at" },
    );

    return ok({ uris: rows.map((r) => r.uri), cursor });
  },
});
