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

type Camera = { camera: string; photoCount: number };
let cache: { data: Camera[]; expires: number } | null = null;
const TTL = 5 * 60 * 1000;

async function refresh(db: any) {
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

  const data: Camera[] = [...merged.entries()]
    .map(([camera, photoCount]) => ({ camera, photoCount }))
    .sort((a, b) => b.photoCount - a.photoCount || a.camera.localeCompare(b.camera))
    .slice(0, 30);

  cache = { data, expires: Date.now() + TTL };
  return data;
}

export default defineQuery("social.grain.unspecced.getCameras", async (ctx) => {
  const { db, ok } = ctx;

  if (cache) {
    if (Date.now() >= cache.expires) refresh(db);
    return ok({ cameras: cache.data });
  }

  return ok({ cameras: await refresh(db) });
});
