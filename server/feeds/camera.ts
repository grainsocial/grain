// Parameterized camera feed. Usage:
//   GET /xrpc/dev.hatk.getFeed?feed=camera&camera=Sony+A7III&limit=50
//
// Matches galleries by *normalized* camera name so the param can be either a
// raw EXIF string ("RICOH IMAGING COMPANY, LTD. RICOH GR III") or the cleaned
// display string ("Ricoh GR III") — both resolve to the same set of galleries.

import { defineFeed } from "$hatk";
import { hydrateGalleries } from "../hydrate/galleries.ts";
import { hideLabelsFilter } from "../labels/_hidden.ts";
import { blockMuteFilter } from "../filters/blockMute.ts";
import { cleanCameraName } from "../helpers/cameraName.ts";
import { galleryFeedTable } from "./_galleryTable.ts";

export default defineFeed({
  collection: "social.grain.gallery",
  label: "Camera",

  hydrate: hydrateGalleries,

  async generate(ctx) {
    const camera = ctx.params.camera;
    if (!camera) return ctx.ok({ uris: [] });

    const target = cleanCameraName(camera);

    // Find every raw make+model string that normalizes to the requested camera.
    const distinctRows = (await ctx.db.query(`
      SELECT DISTINCT make || ' ' || model AS raw
      FROM "social.grain.photo.exif"
      WHERE make IS NOT NULL AND model IS NOT NULL
    `)) as { raw: string }[];

    const matchingRaws = distinctRows
      .filter((r) => cleanCameraName(r.raw) === target)
      .map((r) => r.raw);

    if (!matchingRaws.length) return ctx.ok({ uris: [] });

    const viewer = ctx.viewer?.did;
    const placeholders = matchingRaws.map((_, i) => `$${i + 1}`).join(",");
    let p = matchingRaws.length + 1;
    const bmFilter = viewer ? `AND ${blockMuteFilter("t.did", `$${p++}`)}` : "";
    const bmParams = viewer ? [viewer] : [];

    const { rows, cursor } = await ctx.paginate<{ uri: string }>(
      `SELECT t.uri, t.cid, t.sort_at FROM ${galleryFeedTable}
       LEFT JOIN _repos r ON t.did = r.did
       WHERE (r.status IS NULL OR r.status != 'takendown')
         AND EXISTS (
           SELECT 1 FROM "social.grain.gallery.item" gi
           JOIN "social.grain.photo.exif" e ON e.photo = gi.item
           WHERE gi.gallery = t.uri AND (e.make || ' ' || e.model) IN (${placeholders})
         )
         AND ${hideLabelsFilter("t.uri")}
         AND (SELECT count(*) FROM "social.grain.gallery.item" gi WHERE gi.gallery = t.uri) > 0
         ${bmFilter}`,
      { orderBy: "t.sort_at", params: [...matchingRaws, ...bmParams] },
    );

    return ctx.ok({ uris: rows.map((r) => r.uri), cursor });
  },
});
