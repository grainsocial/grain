// Deletes a gallery and all associated records (items, photos, EXIF, favorites, comments).
//   POST /xrpc/social.grain.unspecced.deleteGallery { rkey }

import { defineProcedure } from "$hatk";

export default defineProcedure("social.grain.unspecced.deleteGallery", async (ctx) => {
  const { db, ok, viewer, deleteRecord } = ctx;
  const { rkey } = ctx.input;

  if (!viewer) throw new Error("Authentication required");

  const galleryUri = `at://${viewer.did}/social.grain.gallery/${rkey}`;

  // Verify the gallery exists and belongs to the viewer
  const [gallery] = (await db.query(
    `SELECT uri FROM "social.grain.gallery" WHERE uri = $1 AND did = $2`,
    [galleryUri, viewer.did],
  )) as { uri: string }[];
  if (!gallery) throw new Error("Gallery not found");

  // Find gallery items (join records linking gallery → photo)
  const items = (await db.query(
    `SELECT uri, item FROM "social.grain.gallery.item" WHERE gallery = $1`,
    [galleryUri],
  )) as { uri: string; item: string }[];

  const photoUris = items.map((i) => i.item);

  // Delete EXIF records for these photos
  if (photoUris.length > 0) {
    const exifRows = (await db.query(
      `SELECT uri FROM "social.grain.photo.exif" WHERE photo IN (${photoUris.map((_, i) => `$${i + 1}`).join(",")})`,
      photoUris,
    )) as { uri: string }[];
    for (const row of exifRows) {
      const exifRkey = row.uri.split("/").pop()!;
      await deleteRecord("social.grain.photo.exif", exifRkey);
    }
  }

  // Delete gallery items
  for (const item of items) {
    const itemRkey = item.uri.split("/").pop()!;
    await deleteRecord("social.grain.gallery.item", itemRkey);
  }

  // Delete photos
  for (const photoUri of photoUris) {
    const photoRkey = photoUri.split("/").pop()!;
    await deleteRecord("social.grain.photo", photoRkey);
  }

  // Delete favorites on this gallery
  const favs = (await db.query(`SELECT uri FROM "social.grain.favorite" WHERE subject = $1`, [
    galleryUri,
  ])) as { uri: string }[];
  for (const fav of favs) {
    const favRkey = fav.uri.split("/").pop()!;
    try {
      await deleteRecord("social.grain.favorite", favRkey);
    } catch {
      // Favorite may belong to another user, skip
    }
  }

  // Delete comments on this gallery
  const comments = (await db.query(`SELECT uri FROM "social.grain.comment" WHERE subject = $1`, [
    galleryUri,
  ])) as { uri: string }[];
  for (const comment of comments) {
    const commentRkey = comment.uri.split("/").pop()!;
    try {
      await deleteRecord("social.grain.comment", commentRkey);
    } catch {
      // Comment may belong to another user, skip
    }
  }

  // Delete the gallery itself
  await deleteRecord("social.grain.gallery", rkey);

  return ok({});
});
