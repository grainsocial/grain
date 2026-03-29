import { defineQuery, InvalidRequestError } from "$hatk";
import type { Gallery } from "$hatk";
import { hydrateGalleries } from "../hydrate/galleries.ts";

export default defineQuery("social.grain.unspecced.getGallery", async (ctx) => {
  const { ok, params, db } = ctx;
  const { gallery: galleryUri } = params;

  const rows = (await db.query(`SELECT * FROM "social.grain.gallery" WHERE uri = $1`, [
    galleryUri,
  ])) as Array<{
    uri: string;
    did: string;
    cid: string;
    handle: string | null;
    indexed_at: string | null;
    title: string;
    description: string | null;
    facets: string | null;
    labels: string | null;
    location: string | null;
    updated_at: string | null;
    created_at: string;
  }>;

  const row = rows[0];
  if (!row) throw new InvalidRequestError("Gallery not found");

  const record = {
    title: row.title,
    description: row.description ?? undefined,
    facets: row.facets ? JSON.parse(row.facets) : undefined,
    labels: row.labels ? JSON.parse(row.labels) : undefined,
    location: row.location ? JSON.parse(row.location) : undefined,
    updatedAt: row.updated_at ?? undefined,
    createdAt: row.created_at,
  };

  const galleryRow = {
    uri: row.uri,
    did: row.did,
    cid: row.cid,
    handle: row.handle ?? undefined,
    indexed_at: row.indexed_at ?? undefined,
    value: record as Gallery,
  };

  const [galleryView] = await hydrateGalleries(ctx, [galleryRow]);

  return ok({ gallery: galleryView });
});
