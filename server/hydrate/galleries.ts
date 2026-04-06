import { views } from "$hatk";
import type { GrainActorProfile, Photo, Gallery, Label } from "$hatk";
import type { PhotoView, GalleryView, ExifView } from "$hatk";
import type { BaseContext, Row } from "$hatk";
import { countComments } from "./comments.ts";

const SCALE = 1_000_000;

interface ExifRow {
  uri: string;
  cid: string;
  photo: string;
  created_at: string;
  date_time_original?: string;
  exposure_time?: number;
  f_number?: number;
  flash?: string;
  focal_length_in35mm_format?: number;
  i_s_o?: number;
  lens_make?: string;
  lens_model?: string;
  make?: string;
  model?: string;
}

function formatExposureTime(scaled: number): string {
  const val = scaled / SCALE;
  if (val >= 1) return `${val}s`;
  return `1/${Math.round(1 / val)}s`;
}

function formatFNumber(scaled: number): string {
  return `f/${(scaled / SCALE).toFixed(1)}`;
}

function formatFocalLength(scaled: number): string {
  return `${Math.round(scaled / SCALE)}mm`;
}

function buildExifView(row: ExifRow): ExifView {
  return views.exifView({
    uri: row.uri,
    cid: row.cid,
    photo: row.photo,
    record: row,
    createdAt: row.created_at,
    ...(row.date_time_original ? { dateTimeOriginal: row.date_time_original } : {}),
    ...(row.exposure_time ? { exposureTime: formatExposureTime(row.exposure_time) } : {}),
    ...(row.f_number ? { fNumber: formatFNumber(row.f_number) } : {}),
    ...(row.flash ? { flash: row.flash } : {}),
    ...(row.focal_length_in35mm_format
      ? { focalLengthIn35mmFormat: formatFocalLength(row.focal_length_in35mm_format) }
      : {}),
    ...(row.i_s_o ? { iSO: Math.round(row.i_s_o / SCALE) } : {}),
    ...(row.lens_make ? { lensMake: row.lens_make } : {}),
    ...(row.lens_model ? { lensModel: row.lens_model } : {}),
    ...(row.make ? { make: row.make } : {}),
    ...(row.model ? { model: row.model } : {}),
  });
}

/** Look up Bluesky cross-posts for a set of grain URIs by searching bsky post text. */
export async function lookupCrossPosts(
  db: BaseContext["db"],
  items: Array<{ uri: string; did: string }>,
  collection: "gallery" | "story",
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const item of items) {
    const rkey = item.uri.split("/").pop();
    const url = `/profile/${item.did}/${collection}/${rkey}`;
    const rows = (await db.query(
      `SELECT uri FROM "app.bsky.feed.post" WHERE did = $1 AND "text" LIKE '%' || $2 || '%' LIMIT 1`,
      [item.did, url],
    )) as Array<{ uri: string }>;
    if (rows.length) {
      const postRkey = rows[0].uri.split("/").pop();
      map.set(item.uri, `https://bsky.app/profile/${item.did}/post/${postRkey}`);
    }
  }
  return map;
}

/** Shared hydration for gallery feeds — resolves photos, profiles, fav/comment counts. */
export async function hydrateGalleries(
  ctx: BaseContext,
  items: Row<Gallery>[],
): Promise<GalleryView[]> {
  const dids = [...new Set(items.map((item) => item.did).filter(Boolean))];
  const galleryUris = items.map((item) => item.uri);

  // Resolve viewer favorites
  const viewerFavs = new Map<string, string>();
  if (ctx.viewer?.did && galleryUris.length > 0) {
    const favRows = (await ctx.db.query(
      `SELECT subject, uri FROM "social.grain.favorite"
       WHERE did = $1 AND subject IN (${galleryUris.map((_, i) => `$${i + 2}`).join(",")})`,
      [ctx.viewer.did, ...galleryUris],
    )) as { subject: string; uri: string }[];
    for (const row of favRows) viewerFavs.set(row.subject, row.uri);
  }

  const [profiles, favCounts, commentCounts, labelsByUri, galleryItemRows, crossPosts] =
    await Promise.all([
      ctx.lookup<GrainActorProfile>("social.grain.actor.profile", "did", dids),
      galleryUris.length > 0
        ? (
            ctx.db.query(
              `SELECT subject, COUNT(DISTINCT did) as count FROM "social.grain.favorite"
           WHERE subject IN (${galleryUris.map((_, i) => `$${i + 1}`).join(",")}) GROUP BY subject`,
              galleryUris,
            ) as Promise<{ subject: string; count: number }[]>
          ).then((rows) => {
            const m = new Map<string, number>();
            for (const r of rows) m.set(r.subject, Number(r.count));
            return m;
          })
        : Promise.resolve(new Map<string, number>()),
      countComments(ctx.db, galleryUris),
      ctx.labels(galleryUris).then(async (externalLabels: Map<string, Label[]>) => {
        if (galleryUris.length === 0) return externalLabels;
        const selfLabelRows = (await ctx.db.query(
          `SELECT parent_uri, val FROM "social.grain.gallery__labels_self_labels"
           WHERE parent_uri IN (${galleryUris.map((_, i) => `$${i + 1}`).join(",")})`,
          galleryUris,
        )) as { parent_uri: string; val: string }[];
        for (const row of selfLabelRows) {
          const label: Label = { src: row.parent_uri.split("/")[2], uri: row.parent_uri, val: row.val, cts: new Date().toISOString() };
          const existing = externalLabels.get(row.parent_uri) ?? [];
          existing.push(label);
          externalLabels.set(row.parent_uri, existing);
        }
        return externalLabels;
      }) as Promise<Map<string, Label[]>>,
      galleryUris.length > 0
        ? (ctx.db.query(
            `SELECT uri, did, cid, gallery, item, position, created_at
           FROM "social.grain.gallery.item"
           WHERE gallery IN (${galleryUris.map((_, i) => `$${i + 1}`).join(",")})
           ORDER BY position ASC`,
            galleryUris,
          ) as Promise<
            Array<{
              uri: string;
              did: string;
              cid: string;
              gallery: string;
              item: string;
              position: number;
              created_at: string;
            }>
          >)
        : Promise.resolve([]),
      lookupCrossPosts(ctx.db, items, "gallery"),
    ]);

  // Group gallery items by gallery URI
  const itemsByGallery = new Map<string, Array<{ photoUri: string; position: number }>>();
  for (const row of galleryItemRows) {
    if (!itemsByGallery.has(row.gallery)) itemsByGallery.set(row.gallery, []);
    itemsByGallery.get(row.gallery)!.push({ photoUri: row.item, position: row.position ?? 0 });
  }

  // Fetch all referenced photos + EXIF data
  const allPhotoUris = [...new Set(galleryItemRows.map((r) => r.item))];
  const [photos, exifByPhoto] = await Promise.all([
    allPhotoUris.length > 0
      ? ctx.getRecords<Photo>("social.grain.photo", allPhotoUris)
      : Promise.resolve(new Map<string, Row<Photo>>()),
    allPhotoUris.length > 0
      ? (
          ctx.db.query(
            `SELECT * FROM "social.grain.photo.exif"
           WHERE photo IN (${allPhotoUris.map((_, i) => `$${i + 1}`).join(",")})`,
            allPhotoUris,
          ) as Promise<ExifRow[]>
        ).then((rows) => {
          const map = new Map<string, ExifRow>();
          for (const row of rows) map.set(row.photo, row);
          return map;
        })
      : Promise.resolve(new Map<string, ExifRow>()),
  ]);

  return items.map((item) => {
    const author = profiles.get(item.did);
    const galleryItems = itemsByGallery.get(item.uri) ?? [];

    const photoViews: PhotoView[] = galleryItems
      .map((gi) => {
        const photo = photos.get(gi.photoUri);
        if (!photo) return null;
        const val = photo.value;
        const exifRow = exifByPhoto.get(photo.uri);
        return views.photoView({
          uri: photo.uri,
          cid: photo.cid,
          thumb: ctx.blobUrl(photo.did, val.photo, "feed_thumbnail") ?? "",
          fullsize: ctx.blobUrl(photo.did, val.photo, "feed_fullsize") ?? "",
          alt: val.alt,
          aspectRatio: val.aspectRatio ?? { width: 4, height: 3 },
          ...(exifRow ? { exif: buildExifView(exifRow) } : {}),
        });
      })
      .filter((v): v is PhotoView => v !== null);

    return views.galleryView({
      uri: item.uri,
      cid: item.cid,
      record: item.value,
      indexedAt: item.indexed_at ?? item.value.createdAt,
      title: item.value.title,
      description: item.value.description,
      createdAt: item.value.createdAt,
      favCount: favCounts.get(item.uri) ?? 0,
      commentCount: commentCounts.get(item.uri) ?? 0,
      creator: author
        ? views.grainActorDefsProfileView({
            cid: author.cid,
            did: author.did,
            handle: author.handle ?? author.did,
            displayName: author.value.displayName,
            avatar: ctx.blobUrl(author.did, author.value.avatar) ?? undefined,
          })
        : views.grainActorDefsProfileView({
            cid: item.cid,
            did: item.did,
            handle: item.handle ?? item.did,
          }),
      items: photoViews,
      ...(item.value.location
        ? {
            location: {
              name: item.value.location.name,
              value: item.value.location.value,
            },
            ...(item.value.address ? { address: item.value.address } : {}),
          }
        : {}),
      ...(labelsByUri.has(item.uri) ? { labels: labelsByUri.get(item.uri) } : {}),
      ...(viewerFavs.has(item.uri) ? { viewer: { fav: viewerFavs.get(item.uri) } } : {}),
      ...(crossPosts.has(item.uri) ? { crossPost: { url: crossPosts.get(item.uri)! } } : {}),
    });
  });
}
