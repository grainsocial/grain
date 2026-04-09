import { defineQuery, type GrainActorProfile, type Photo, type Gallery } from "$hatk";
import { hideLabelsFilter } from "../labels/_hidden.ts";

const isProd = process.env.NODE_ENV === "production";
const prodDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
const baseUrl = isProd && prodDomain ? `https://${prodDomain}` : "http://127.0.0.1:3000";

export default defineQuery("parts.page.mention.search", async (ctx) => {
  const { params, search, db, blobUrl, ok } = ctx;
  const { search: query, scope, limit = 20 } = params;

  // Scoped to a user DID → search their galleries
  if (scope) {
    return searchGalleries(ctx, query, scope, limit);
  }

  // Default → search users
  return searchUsers(ctx, query, limit);
});

async function searchUsers(ctx: any, query: string, limit: number) {
  const { search, blobUrl, ok } = ctx;

  if (!query.trim()) return ok({ results: [] });

  const result = await search("social.grain.actor.profile", query, { limit, fuzzy: true });
  const items = await ctx.resolve(result.records.map((r: any) => r.uri));

  const results = items.map((item: any) => ({
    uri: `at://${item.did}/social.grain.actor.profile/self`,
    name: item.value.displayName || item.handle || item.did,
    description: item.value.description || undefined,
    href: `${baseUrl}/profile/${item.did}`,
    icon: blobUrl(item.did, item.value.avatar, "avatar") || undefined,
    subscope: {
      scope: item.did,
      label: "Galleries",
    },
  }));

  return ok({ results });
}

async function searchGalleries(ctx: any, query: string, did: string, limit: number) {
  const { db, blobUrl, ok } = ctx;

  // If query is empty, show all galleries by this user
  let galleryRows: { uri: string; cid: string; did: string; title: string; description: string; created_at: string }[];

  if (!query.trim()) {
    galleryRows = (await db.query(
      `SELECT t.uri, t.cid, t.did, t.title, t.description, t.created_at
       FROM "social.grain.gallery" t
       LEFT JOIN _repos r ON t.did = r.did
       WHERE t.did = $1
         AND (r.status IS NULL OR r.status != 'takendown')
         AND ${hideLabelsFilter("t.uri")}
         AND (SELECT count(*) FROM "social.grain.gallery.item" gi WHERE gi.gallery = t.uri) > 0
       ORDER BY t.created_at DESC
       LIMIT $2`,
      [did, limit],
    )) as typeof galleryRows;
  } else {
    const result = await ctx.search("social.grain.gallery", query, { limit, fuzzy: true });
    // Filter to only this user's galleries
    galleryRows = result.records
      .filter((r: any) => r.did === did)
      .map((r: any) => ({
        uri: r.uri,
        cid: r.cid,
        did: r.did,
        title: r.value.title,
        description: r.value.description,
        created_at: r.value.createdAt,
      }));
  }

  if (galleryRows.length === 0) return ok({ results: [] });

  // Get first photo for each gallery (for icon/thumbnail)
  const galleryUris = galleryRows.map((r) => r.uri);
  const itemRows = (await db.query(
    `SELECT gi.gallery, gi.item
     FROM "social.grain.gallery.item" gi
     WHERE gi.gallery IN (${galleryUris.map((_: any, i: number) => `$${i + 1}`).join(",")})
     ORDER BY gi.position ASC`,
    galleryUris,
  )) as { gallery: string; item: string }[];

  const firstPhotoUri = new Map<string, string>();
  for (const row of itemRows) {
    if (!firstPhotoUri.has(row.gallery)) firstPhotoUri.set(row.gallery, row.item);
  }

  const photoUris = [...new Set(firstPhotoUri.values())];
  const photos =
    photoUris.length > 0
      ? await ctx.getRecords("social.grain.photo", photoUris)
      : new Map();

  const results = galleryRows.map((gallery) => {
    const photoUri = firstPhotoUri.get(gallery.uri);
    const photo = photoUri ? photos.get(photoUri) : null;
    const thumb = photo ? blobUrl(photo.did, photo.value.photo, "feed_thumbnail") : undefined;
    const rkey = gallery.uri.split("/").pop();
    const galleryUrl = `${baseUrl}/profile/${gallery.did}/gallery/${rkey}`;
    const embedUrl = `${baseUrl}/embed/gallery/${gallery.did}/${rkey}`;

    return {
      uri: gallery.uri,
      name: gallery.title,
      description: gallery.description || undefined,
      href: galleryUrl,
      icon: thumb || undefined,
      embed: {
        src: embedUrl,
        aspectRatio: { width: 16, height: 9 },
      },
    };
  });

  return ok({ results });
}
