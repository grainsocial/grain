import { defineFeed } from "$hatk";
import { hydrateGalleries } from "../hydrate/galleries.ts";
import { hideLabelsFilter } from "../labels/_hidden.ts";
import { blockMuteFilter } from "../filters/blockMute.ts";
import { galleryFeedTable } from "./_galleryTable.ts";

export default defineFeed({
  collection: "social.grain.gallery",
  label: "Following",

  hydrate: hydrateGalleries,

  async generate(ctx) {
    const actor = ctx.params.actor;
    if (!actor) return ctx.ok({ uris: [] });

    const { rows, cursor } = await ctx.paginate<{ uri: string }>(
      `SELECT t.uri, t.cid, t.sort_at FROM ${galleryFeedTable}
       LEFT JOIN _repos r ON t.did = r.did
       WHERE (r.status IS NULL OR r.status != 'takendown')
         AND t.did IN (SELECT subject FROM "social.grain.graph.follow" WHERE did = $1)
         AND ${hideLabelsFilter("t.uri")}
         AND (SELECT count(*) FROM "social.grain.gallery.item" gi WHERE gi.gallery = t.uri) > 0
         AND ${blockMuteFilter("t.did", "$1")}`,
      { orderBy: "t.sort_at", params: [actor] },
    );

    return ctx.ok({ uris: rows.map((r) => r.uri), cursor });
  },
});
