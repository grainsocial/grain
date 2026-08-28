import { defineFeed } from "$hatk";
import { hydrateGalleries } from "../hydrate/galleries.ts";
import { hideLabelsFilter } from "../labels/_hidden.ts";
import { blockMuteFilter } from "../filters/blockMute.ts";

/** Everything in any group's pool, most recently pooled first. */
export default defineFeed({
  collection: "social.grain.gallery",
  label: "Groups",

  hydrate: hydrateGalleries,

  async generate(ctx) {
    const viewer = ctx.viewer?.did;
    const bmFilter = viewer ? `AND ${blockMuteFilter("g.did", "$1")}` : "";
    const bmParams = viewer ? [viewer] : [];

    const { rows, cursor } = await ctx.paginate<{ uri: string }>(
      `SELECT g.uri, gi.cid, gi.created_at
       FROM "social.grain.group.item" gi
       JOIN "social.grain.gallery" g ON g.uri = gi.gallery
       LEFT JOIN _repos r ON g.did = r.did
       WHERE (r.status IS NULL OR r.status != 'takendown')
         AND ${hideLabelsFilter("g.uri")}
         AND (SELECT count(*) FROM "social.grain.gallery.item" x WHERE x.gallery = g.uri) > 0
         ${bmFilter}`,
      { orderBy: "gi.created_at", ...(bmParams.length ? { params: bmParams } : {}) },
    );

    return ctx.ok({ uris: rows.map((r) => r.uri), cursor });
  },
});
