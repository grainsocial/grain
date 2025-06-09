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
import { Un$Typed } from "$lexicon/util.ts";
import { AtUri } from "@atproto/syntax";
import { BffContext, WithBffMeta } from "@bigmoves/bff";
import { getActorProfile } from "./actor.ts";
import { photoToView } from "./photo.ts";

export function getGalleryItemsAndPhotos(
  ctx: BffContext,
  galleries: WithBffMeta<Gallery>[],
): Map<string, WithBffMeta<Photo>[]> {
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
    },
  );

  const photosMap = new Map<string, WithBffMeta<Photo>>();
  for (const photo of photos) {
    photosMap.set(photo.uri, photo);
  }

  const galleryPhotosMap = new Map<string, WithBffMeta<Photo>[]>();
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
  items: Photo[],
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
    | WithBffMeta<Photo>
    | {
      $type: string;
    },
): Un$Typed<PhotoView> | undefined {
  if (isPhoto(item)) {
    return photoToView(did, item);
  }
  return undefined;
}
