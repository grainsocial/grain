// Returns top cameras by photo count (stale-while-revalidate, 5min TTL).
//   GET /xrpc/social.grain.unspecced.getCameras

import { defineQuery } from "$hatk";

type Camera = { camera: string; photoCount: number };
let cache: { data: Camera[]; expires: number } | null = null;
const TTL = 5 * 60 * 1000;

async function refresh(db: any) {
  const rows = await db.query(`
    SELECT make || ' ' || model AS camera, CAST(COUNT(*) AS INTEGER) AS photo_count
    FROM "social.grain.photo.exif"
    WHERE make IS NOT NULL AND model IS NOT NULL
    GROUP BY make, model
    ORDER BY photo_count DESC, camera ASC
    LIMIT 30
  `);
  const data = rows.map((r: any) => ({ camera: r.camera, photoCount: r.photo_count }));
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
