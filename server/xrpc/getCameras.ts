// Returns top cameras by photo count (stale-while-revalidate, 5min TTL).
//   GET /xrpc/social.grain.unspecced.getCameras
//
// Normalizes raw EXIF make/model strings before returning them so every
// client gets consistent, human-readable names. Rows that collide after
// normalization are merged (e.g. "RICOH IMAGING COMPANY, LTD. GR III" and
// a hypothetical "Ricoh GR III" fold into one entry with summed counts).
//
// FOLLOW-UPS:
//   - Results are capped at top 30. The `/cameras` index page uses this
//     endpoint — if more is ever needed, add an optional `limit` param.
//   - ~50 records in prod have make="CAMERA" model="CAMERA", likely test
//     data; they normalize to a single "Camera" row. Harmless, but it's
//     the one row you might want to filter out if the sidebar ever feels
//     cluttered.

import { defineQuery } from "$hatk";
import { cleanCameraName } from "../helpers/cameraName.ts";

/** Thumbnails carried per camera, enough for the index tile's 2x2 mosaic. */
const THUMBS_PER_CAMERA = 4;

type Camera = { camera: string; photoCount: number; thumbs: string[] };
let cache: { data: Camera[]; expires: number } | null = null;
const TTL = 5 * 60 * 1000;

async function refresh(ctx: any) {
  const { db } = ctx;

  const rows = (await db.query(`
    SELECT make || ' ' || model AS camera, CAST(COUNT(*) AS INTEGER) AS photo_count
    FROM "social.grain.photo.exif"
    WHERE make IS NOT NULL AND model IS NOT NULL
    GROUP BY make, model
    ORDER BY photo_count DESC, camera ASC
  `)) as { camera: string; photo_count: number }[];

  // Merge rows that collide after normalization.
  const merged = new Map<string, number>();
  for (const r of rows) {
    const clean = cleanCameraName(r.camera);
    if (!clean) continue;
    merged.set(clean, (merged.get(clean) ?? 0) + r.photo_count);
  }

  const ranked = [...merged.entries()]
    .map(([camera, photoCount]) => ({ camera, photoCount }))
    .sort((a, b) => b.photoCount - a.photoCount || a.camera.localeCompare(b.camera))
    .slice(0, 30);

  const thumbs = await thumbsByCamera(ctx, new Set(ranked.map((c) => c.camera)));

  const data: Camera[] = ranked.map((c) => ({ ...c, thumbs: thumbs.get(c.camera) ?? [] }));

  cache = { data, expires: Date.now() + TTL };
  return data;
}

/**
 * Newest photos per camera, for the index tiles.
 *
 * Normalization happens in JS, after the query — two raw make/model pairs can
 * fold into one camera — so the window function partitions on the raw pair and
 * takes a few extra rows, and the merge below trims each camera back down.
 */
async function thumbsByCamera(ctx: any, wanted: Set<string>): Promise<Map<string, string[]>> {
  const { db, blobUrl, getRecords } = ctx;
  const perPartition = THUMBS_PER_CAMERA * 2;

  const rows = (await db.query(
    `SELECT camera, photo_uri, created_at FROM (
       SELECT e.make || ' ' || e.model AS camera,
              p.uri AS photo_uri,
              p.created_at AS created_at,
              ROW_NUMBER() OVER (
                PARTITION BY e.make, e.model ORDER BY p.created_at DESC
              ) AS rn
       FROM "social.grain.photo.exif" e
       JOIN "social.grain.photo" p ON p.uri = e.photo
       WHERE e.make IS NOT NULL AND e.model IS NOT NULL
     ) ranked
     WHERE rn <= $1`,
    [perPartition],
  )) as { camera: string; photo_uri: string; created_at: string }[];

  // Sorted here rather than in SQL: two raw make/model partitions can merge
  // into one camera, and "newest first" has to hold across the merge, not
  // within each partition. The outer query has no ORDER BY of its own.
  const candidates = new Map<string, { uri: string; createdAt: string }[]>();
  for (const row of rows) {
    const clean = cleanCameraName(row.camera);
    if (!clean || !wanted.has(clean)) continue;
    const list = candidates.get(clean) ?? [];
    list.push({ uri: row.photo_uri, createdAt: row.created_at });
    candidates.set(clean, list);
  }

  const uris = new Map<string, string[]>();
  for (const [camera, list] of candidates) {
    list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    uris.set(
      camera,
      list.slice(0, THUMBS_PER_CAMERA).map((c) => c.uri),
    );
  }

  const photoUris = [...new Set([...uris.values()].flat())];
  if (photoUris.length === 0) return new Map();
  const photos = await getRecords("social.grain.photo", photoUris);

  const out = new Map<string, string[]>();
  for (const [camera, list] of uris) {
    const urls = list
      .map((uri) => {
        const rec = photos.get(uri);
        return rec ? blobUrl(rec.did, rec.value.photo, "feed_thumbnail") : null;
      })
      .filter((u: string | null): u is string => !!u);
    if (urls.length) out.set(camera, urls);
  }
  return out;
}

export default defineQuery("social.grain.unspecced.getCameras", async (ctx) => {
  const { ok } = ctx;

  if (cache) {
    if (Date.now() >= cache.expires) refresh(ctx);
    return ok({ cameras: cache.data });
  }

  return ok({ cameras: await refresh(ctx) });
});
