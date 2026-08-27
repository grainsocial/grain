import { defineQuery, InvalidRequestError } from "$hatk";
import type { Gallery } from "$hatk";
import { hydrateGalleries } from "../hydrate/galleries.ts";
import { resolveAtUri } from "../helpers/resolveHandle.ts";

export default defineQuery("social.grain.unspecced.getGallery", async (ctx) => {
  const { ok, params, db, getRecords } = ctx;
  let { gallery: galleryUri } = params;

  // Resolve handle in AT URI if needed
  const resolved = await resolveAtUri(db, galleryUri);
  if (resolved) galleryUri = resolved;

  const recordsMap = await getRecords<Gallery>("social.grain.gallery", [galleryUri]);
  const galleryRow = recordsMap.get(galleryUri);
  if (!galleryRow) throw new InvalidRequestError("Gallery not found");

  const [galleryView] = await hydrateGalleries(ctx, [galleryRow]);

  return ok({ gallery: galleryView });
});
