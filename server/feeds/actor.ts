import { defineFeed } from "$hatk";
import { hydrateGalleries } from "../hydrate/galleries.ts";
import { hideLabelsFilter } from "../labels/_hidden.ts";

export default defineFeed({
  collection: "social.grain.gallery",
  label: "Actor Galleries",

  hydrate: hydrateGalleries,

  async generate(ctx) {
    const { params, ok, isTakendown } = ctx;

    let actor = params.actor;
    if (!actor) {
      return ok({ uris: [], cursor: undefined });
    }

    // Resolve handle to DID if needed
    if (!actor.startsWith("did:")) {
      const rows = (await ctx.db.query(`SELECT did FROM _repos WHERE handle = $1`, [actor])) as {
        did: string;
      }[];
      if (rows[0]?.did) {
        actor = rows[0].did;
      }
    }

    if (await isTakendown(actor)) {
      return ok({ uris: [], cursor: undefined });
    }

    const { rows, cursor } = await ctx.paginate<{ uri: string }>(
      `SELECT t.uri, t.cid, t.created_at
       FROM "social.grain.gallery" t
       WHERE t.did = $1
         AND ${hideLabelsFilter("t.uri")}
         AND (SELECT count(*) FROM "social.grain.gallery.item" gi WHERE gi.gallery = t.uri) > 0`,
      { params: [actor], orderBy: "t.created_at" },
    );

    return ok({ uris: rows.map((r) => r.uri), cursor });
  },
});
