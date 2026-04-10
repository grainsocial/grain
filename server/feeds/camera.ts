// Parameterized camera feed. Usage:
//   GET /xrpc/dev.hatk.getFeed?feed=camera&camera=Sony+A7III&limit=50

import { defineFeed } from "$hatk";
import { hydrateGalleries } from "../hydrate/galleries.ts";
import { hideLabelsFilter } from "../labels/_hidden.ts";
import { blockMuteFilter } from "../filters/blockMute.ts";

export default defineFeed({
  collection: "social.grain.gallery",
  label: "Camera",

  hydrate: hydrateGalleries,

  async generate(ctx) {
    const camera = ctx.params.camera;
    if (!camera) return ctx.ok({ uris: [] });

    const viewer = ctx.viewer?.did;
    const bmFilter = viewer ? `AND ${blockMuteFilter("t.did", "$2")}` : "";
    const bmParams = viewer ? [viewer] : [];

    const { rows, cursor } = await ctx.paginate<{ uri: string }>(
      `SELECT t.uri, t.cid, t.created_at FROM "social.grain.gallery" t
       LEFT JOIN _repos r ON t.did = r.did
       WHERE (r.status IS NULL OR r.status != 'takendown')
         AND EXISTS (
           SELECT 1 FROM "social.grain.gallery.item" gi
           JOIN "social.grain.photo.exif" e ON e.photo = gi.item
           WHERE gi.gallery = t.uri AND (e.make || ' ' || e.model) = $1
         )
         AND ${hideLabelsFilter("t.uri")}
         AND (SELECT count(*) FROM "social.grain.gallery.item" gi WHERE gi.gallery = t.uri) > 0
         ${bmFilter}`,
      { orderBy: "t.created_at", params: [camera, ...bmParams] },
    );

    return ctx.ok({ uris: rows.map((r) => r.uri), cursor });
  },
});
