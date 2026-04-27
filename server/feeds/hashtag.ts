import { defineFeed } from "$hatk";
import { hydrateGalleries } from "../hydrate/galleries.ts";
import { hideLabelsFilter } from "../labels/_hidden.ts";
import { blockMuteFilter } from "../filters/blockMute.ts";
import { galleryFeedTable } from "./_galleryTable.ts";

export default defineFeed({
  collection: "social.grain.gallery",
  label: "Hashtag",

  hydrate: hydrateGalleries,

  async generate(ctx) {
    const tag = ctx.params.tag;
    if (!tag) return ctx.ok({ uris: [] });

    const pattern = `%#${tag}%`;
    const viewer = ctx.viewer?.did;
    const bmFilter = viewer ? `AND ${blockMuteFilter("t.did", "$2")}` : "";
    const bmParams = viewer ? [viewer] : [];

    const { rows, cursor } = await ctx.paginate<{ uri: string }>(
      `SELECT t.uri, t.cid, t.sort_at FROM ${galleryFeedTable}
       LEFT JOIN _repos r ON t.did = r.did
       WHERE (r.status IS NULL OR r.status != 'takendown')
         AND (
           t.description LIKE $1
           OR EXISTS (SELECT 1 FROM "social.grain.comment" c WHERE c.subject = t.uri AND c.text LIKE $1)
         )
         AND ${hideLabelsFilter("t.uri")}
         AND (SELECT count(*) FROM "social.grain.gallery.item" gi WHERE gi.gallery = t.uri) > 0
         ${bmFilter}`,
      { orderBy: "t.sort_at", params: [pattern, ...bmParams] },
    );

    return ctx.ok({ uris: rows.map((r) => r.uri), cursor });
  },
});
