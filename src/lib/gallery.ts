import { Label } from "$lexicon/types/com/atproto/label/defs.ts";
import { ProfileView } from "$lexicon/types/social/grain/actor/defs.ts";
import { Record as Favorite } from "$lexicon/types/social/grain/favorite.ts";
import { Record as Gallery } from "$lexicon/types/social/grain/gallery.ts";
import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { Record as GalleryItem } from "$lexicon/types/social/grain/gallery/item.ts";
import {
  isRecord as isPhoto,
  Record as Photo,
} from "$lexicon/types/social/grain/photo.ts";
import {
  isPhotoView,
  PhotoView,
} from "$lexicon/types/social/grain/photo/defs.ts";
import { Record as PhotoExif } from "$lexicon/types/social/grain/photo/exif.ts";
import { Un$Typed } from "$lexicon/util.ts";
import { AtUri } from "@atproto/syntax";
import { BffContext, WithBffMeta } from "@bigmoves/bff";
import { getActorProfile } from "./actor.ts";
import { photoToView } from "./photo.ts";

type PhotoWithExif = WithBffMeta<Photo> & {
  exif?: WithBffMeta<PhotoExif>;
};

export function getGalleryItemsAndPhotos(
  ctx: BffContext,
  galleries: WithBffMeta<Gallery>[],
): Map<string, PhotoWithExif[]> {
  const galleryUris = galleries.map(
    (gallery) =>
      `at://${gallery.did}/social.grain.gallery/${new AtUri(gallery.uri).rkey}`,
  );

  if (galleryUris.length === 0) return new Map();

  const { items: galleryItems } = ctx.indexService.getRecords<
    WithBffMeta<GalleryItem>
  >("social.grain.gallery.item", {
    orderBy: [{ field: "position", direction: "asc" }],
    where: [{ field: "gallery", in: galleryUris }],
  });

  const photoUris = galleryItems.map((item) => item.item).filter(Boolean);
  if (photoUris.length === 0) return new Map();

  const { items: photos } = ctx.indexService.getRecords<WithBffMeta<Photo>>(
    "social.grain.photo",
    {
      where: [{ field: "uri", in: photoUris }],
      orderBy: [{ field: "createdAt", direction: "asc" }],
    },
  );

  const { items: photosExif } = ctx.indexService.getRecords<
    WithBffMeta<PhotoExif>
  >(
    "social.grain.photo.exif",
    {
      where: [{ field: "photo", in: photoUris }],
    },
  );

  const photosMap = new Map<string, PhotoWithExif>();
  const exifMap = new Map<string, WithBffMeta<PhotoExif>>();
  for (const exif of photosExif) {
    exifMap.set(exif.photo, exif);
  }
  for (const photo of photos) {
    const exif = exifMap.get(photo.uri);
    photosMap.set(photo.uri, exif ? { ...photo, exif } : photo);
  }

  const galleryPhotosMap = new Map<string, PhotoWithExif[]>();
  for (const item of galleryItems) {
    const galleryUri = item.gallery;
    const photo = photosMap.get(item.item);

    if (!galleryPhotosMap.has(galleryUri)) {
      galleryPhotosMap.set(galleryUri, []);
    }

    if (photo) {
      galleryPhotosMap.get(galleryUri)?.push(photo);
    }
  }

  return galleryPhotosMap;
}

export function getGallery(handleOrDid: string, rkey: string, ctx: BffContext) {
  let did: string;
  if (handleOrDid.includes("did:")) {
    did = handleOrDid;
  } else {
    const actor = ctx.indexService.getActorByHandle(handleOrDid);
    if (!actor) return null;
    did = actor.did;
  }
  const gallery = ctx.indexService.getRecord<WithBffMeta<Gallery>>(
    `at://${did}/social.grain.gallery/${rkey}`,
  );
  if (!gallery) return null;
  const galleryPhotosMap = getGalleryItemsAndPhotos(ctx, [gallery]);
  const profile = getActorProfile(did, ctx);
  if (!profile) return null;
  const labels = ctx.indexService.queryLabels({
    subjects: [gallery.uri],
  });
  return galleryToView(
    gallery,
    profile,
    galleryPhotosMap.get(gallery.uri) ?? [],
    labels,
  );
}

export async function deleteGallery(uri: string, ctx: BffContext) {
  await ctx.deleteRecord(uri);
  const { items: galleryItems } = ctx.indexService.getRecords<
    WithBffMeta<GalleryItem>
  >("social.grain.gallery.item", {
    where: [{ field: "gallery", equals: uri }],
  });
  for (const item of galleryItems) {
    await ctx.deleteRecord(item.uri);
  }
  const { items: favs } = ctx.indexService.getRecords<WithBffMeta<Favorite>>(
    "social.grain.favorite",
    {
      where: [{ field: "subject", equals: uri }],
    },
  );
  for (const fav of favs) {
    await ctx.deleteRecord(fav.uri);
  }
}

export function getGalleryFavs(galleryUri: string, ctx: BffContext) {
  const atUri = new AtUri(galleryUri);
  const results = ctx.indexService.getRecords<WithBffMeta<Favorite>>(
    "social.grain.favorite",
    {
      where: [
        {
          field: "subject",
          equals: `at://${atUri.hostname}/social.grain.gallery/${atUri.rkey}`,
        },
      ],
    },
  );
  return results.items;
}

export function galleryToView(
  record: WithBffMeta<Gallery>,
  creator: Un$Typed<ProfileView>,
  items: PhotoWithExif[],
  labels: Label[] = [],
): Un$Typed<GalleryView> {
  return {
    uri: record.uri,
    cid: record.cid,
    creator,
    record,
    items: items
      ?.map((item) => itemToView(record.did, item))
      .filter(isPhotoView),
    labels,
    indexedAt: record.indexedAt,
  };
}

function itemToView(
  did: string,
  item:
    | PhotoWithExif
    | {
      $type: string;
    },
): Un$Typed<PhotoView> | undefined {
  if (isPhoto(item)) {
    return photoToView(did, item, item.exif);
  }
  return undefined;
}

export function getGalleryCameras(
  gallery: GalleryView,
): string[] {
  const photos = gallery.items?.filter(isPhotoView) ?? [];
  const cameras = new Set<string>();
  for (const photo of photos) {
    if (photo.exif?.make) {
      cameras.add(`${photo.exif.make} ${photo.exif.model}`.trim());
    }
  }
  return Array.from(cameras);
}

export function queryGalleriesByName(
  userDid: string,
  nameQuery: string,
  ctx: BffContext,
): GalleryView[] {
  if (!nameQuery || !userDid) return [];
  const { items: galleries } = ctx.indexService.getRecords<
    WithBffMeta<Gallery>
  >(
    "social.grain.gallery",
    {
      where: [
        { field: "did", equals: userDid },
        { field: "title", contains: nameQuery },
      ],
      orderBy: [{ field: "createdAt", direction: "desc" }],
    },
  );
  if (!galleries.length) return [];

  const galleryPhotosMap = getGalleryItemsAndPhotos(ctx, galleries);

  const profile = getActorProfile(userDid, ctx);
  if (!profile) return [];

  const uris = galleries.map((g) => g.uri);
  const labels = ctx.indexService.queryLabels({ subjects: uris });

  return galleries.map((gallery) =>
    galleryToView(
      gallery,
      profile,
      galleryPhotosMap.get(gallery.uri) ?? [],
      labels,
    )
  );
}

export function getGalleryPhotos(
  galleryUri: string,
  ctx: BffContext,
): PhotoView[] {
  if (!galleryUri) return [];
  const { items: galleryItems } = ctx.indexService.getRecords<
    WithBffMeta<GalleryItem>
  >(
    "social.grain.gallery.item",
    {
      where: [{ field: "gallery", equals: galleryUri }],
    },
  );
  const photoUris = galleryItems.map((item) => item.item).filter(Boolean);
  if (!photoUris.length) return [];
  const { items: photos } = ctx.indexService.getRecords<WithBffMeta<Photo>>(
    "social.grain.photo",
    {
      where: [{ field: "uri", in: photoUris }],
      orderBy: [{ field: "createdAt", direction: "desc" }],
    },
  );
  const { items: photosExif } = ctx.indexService.getRecords<
    WithBffMeta<PhotoExif>
  >(
    "social.grain.photo.exif",
    {
      where: [{ field: "photo", in: photoUris }],
    },
  );
  const photosMap = new Map<string, PhotoWithExif>();
  const exifMap = new Map<string, WithBffMeta<PhotoExif>>();
  for (const exif of photosExif) {
    exifMap.set(exif.photo, exif);
  }
  for (const photo of photos) {
    const exif = exifMap.get(photo.uri);
    photosMap.set(photo.uri, exif ? { ...photo, exif } : photo);
  }
  // Get the gallery DID from the URI
  const did = (() => {
    try {
      return new AtUri(galleryUri).hostname;
    } catch {
      return undefined;
    }
  })();
  // Return PhotoView[] in the order of photo creation time (already sorted by SQL)
  return photos
    .map((photo) => {
      const exif = exifMap.get(photo.uri);
      if (did) {
        return photoToView(did, exif ? { ...photo, exif } : photo, exif);
      }
      return undefined;
    })
    .filter(isPhotoView);
}
