import { Label } from "$lexicon/types/com/atproto/label/defs.ts";
import { ProfileView } from "$lexicon/types/social/grain/actor/defs.ts";
import { Record as Comment } from "$lexicon/types/social/grain/comment.ts";
import { Record as Favorite } from "$lexicon/types/social/grain/favorite.ts";
import { Record as Gallery } from "$lexicon/types/social/grain/gallery.ts";
import {
  GalleryView,
  ViewerState,
} from "$lexicon/types/social/grain/gallery/defs.ts";
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
import { $Typed, Un$Typed } from "$lexicon/util.ts";
import { Facet } from "@atproto/api";
import { AtUri } from "@atproto/syntax";
import { BffContext, WithBffMeta } from "@bigmoves/bff";
import { getGalleryCommentsCount } from "../modules/comments.tsx";
import { getActorProfile, getActorProfilesBulk } from "./actor.ts";
import { photoToView } from "./photo.ts";
import { parseFacetedText } from "./rich_text.ts";

type PhotoWithMeta = WithBffMeta<Photo> & {
  item?: WithBffMeta<GalleryItem>;
  exif?: WithBffMeta<PhotoExif>;
};

export function getGalleryItemsAndPhotos(
  ctx: BffContext,
  galleries: WithBffMeta<Gallery>[],
): Map<string, PhotoWithMeta[]> {
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

  const photosMap = new Map<string, PhotoWithMeta>();
  const exifMap = new Map<string, WithBffMeta<PhotoExif>>();
  for (const exif of photosExif) {
    exifMap.set(exif.photo, exif);
  }
  for (const photo of photos) {
    const exif = exifMap.get(photo.uri);
    photosMap.set(photo.uri, exif ? { ...photo, exif } : photo);
  }

  const galleryPhotosMap = new Map<string, PhotoWithMeta[]>();
  for (const item of galleryItems) {
    const galleryUri = item.gallery;
    const photo = photosMap.get(item.item);

    if (!galleryPhotosMap.has(galleryUri)) {
      galleryPhotosMap.set(galleryUri, []);
    }

    if (photo) {
      // Attach the galleryItem uri as itemUri
      galleryPhotosMap.get(galleryUri)?.push({
        ...photo,
        item,
      });
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

  const favs = getGalleryFavs(gallery.uri, ctx);

  const comments = getGalleryCommentsCount(gallery.uri, ctx);

  let viewerFav: string | undefined = undefined;
  if (ctx.currentUser?.did) {
    const fav = getGalleryFav(ctx.currentUser?.did, gallery.uri, ctx);
    if (fav) {
      viewerFav = fav.uri;
    }
  }

  return galleryToView({
    record: gallery,
    creator: profile,
    items: galleryPhotosMap.get(gallery.uri) ?? [],
    labels,
    favCount: favs,
    commentCount: comments,
    viewerState: {
      fav: viewerFav,
    },
  });
}

export async function deleteGallery(
  uri: string,
  cascade: boolean,
  ctx: BffContext,
) {
  try {
    await ctx.deleteRecord(uri);
    if (!cascade) return true;
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
  } catch (error) {
    console.error("Failed to delete gallery:", error);
    return false;
  }
  return true;
}

export function getGalleryFavs(galleryUri: string, ctx: BffContext) {
  const atUri = new AtUri(galleryUri);
  const count = ctx.indexService.countRecords(
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
  return count;
}

export function getGalleryFav(
  did: string,
  galleryUri: string,
  ctx: BffContext,
) {
  const atUri = new AtUri(galleryUri);
  const { items: favs } = ctx.indexService.getRecords<WithBffMeta<Favorite>>(
    "social.grain.favorite",
    {
      where: [
        {
          field: "subject",
          equals: `at://${atUri.hostname}/social.grain.gallery/${atUri.rkey}`,
        },
        { field: "did", equals: did },
      ],
    },
  );
  return favs[0];
}

export function galleryToView({
  record,
  creator,
  items,
  labels = [],
  favCount,
  commentCount,
  viewerState,
}: {
  record: WithBffMeta<Gallery>;
  creator: Un$Typed<ProfileView>;
  items: PhotoWithMeta[];
  labels: Label[];
  favCount?: number;
  commentCount?: number;
  viewerState?: ViewerState;
  cameras?: string[];
}): $Typed<GalleryView> {
  const viewItems = items
    ?.map((item) => itemToView(record.did, item))
    .filter(isPhotoView);
  const cameras = getGalleryCameras(viewItems);
  return {
    $type: "social.grain.gallery.defs#galleryView",
    uri: record.uri,
    cid: record.cid,
    title: record.title,
    description: record.description,
    cameras,
    facets: record.facets,
    creator,
    record,
    items: viewItems,
    labels,
    favCount,
    commentCount,
    viewer: viewerState,
    createdAt: record.createdAt,
    indexedAt: record.indexedAt,
  };
}

function itemToView(
  did: string,
  item:
    | PhotoWithMeta
    | {
      $type: string;
    },
): Un$Typed<PhotoView> | undefined {
  if (isPhoto(item)) {
    return photoToView(did, item, item.exif, item.item);
  }
  return undefined;
}

export function getGalleryCameras(
  items: Array<PhotoWithMeta | PhotoView>,
): string[] {
  const cameras = new Set<string>();
  if (!Array.isArray(items)) return [];
  for (const item of items) {
    const exif = "exif" in item ? item.exif : (item as PhotoView).exif;
    if (exif?.make && exif?.model) {
      cameras.add(`${exif.make} ${exif.model}`.trim());
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
    galleryToView({
      record: gallery,
      creator: profile,
      items: galleryPhotosMap.get(gallery.uri) ?? [],
      labels,
    })
  );
}

export function getGalleryUrisByFacet(
  type: string,
  value: string,
  ctx: BffContext,
) {
  const { items: galleries } = ctx.indexService.getRecords<
    WithBffMeta<Gallery>
  >(
    "social.grain.gallery",
    {
      facet: {
        "type": type,
        "value": value,
      },
      orderBy: [{ field: "createdAt", direction: "desc" }],
    },
  );
  return galleries.map((g) => g.uri);
}

export function getGalleryUrisByCommentFacet(
  type: string,
  value: string,
  ctx: BffContext,
) {
  const { items: comments } = ctx.indexService.getRecords<Comment>(
    "social.grain.comment",
    {
      facet: {
        type,
        value,
      },
    },
  );
  return comments.map((comment) => comment.subject).filter((uri) =>
    uri.includes("social.grain.gallery")
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
  const exifMap = new Map<string, WithBffMeta<PhotoExif>>();
  for (const exif of photosExif) {
    exifMap.set(exif.photo, exif);
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

export function getGalleriesBulk(
  uris: string[],
  ctx: BffContext,
) {
  if (!uris.length) return [];
  const { items: galleries } = ctx.indexService.getRecords<
    WithBffMeta<Gallery>
  >(
    "social.grain.gallery",
    {
      where: [{ field: "uri", in: uris }],
    },
  );
  if (!galleries.length) return [];

  const galleryPhotosMap = getGalleryItemsAndPhotos(ctx, galleries);

  const uniqueDids = Array.from(new Set(galleries.map((g) => g.did)));
  const creators = getActorProfilesBulk(uniqueDids, ctx);
  const creatorMap = new Map(creators.map((c) => [c.did, c]));

  const labels = ctx.indexService.queryLabels({ subjects: uris });

  return galleries
    .map((gallery) => {
      const creator = creatorMap.get(gallery.did);
      if (!creator) return null;
      return galleryToView({
        record: gallery,
        creator,
        items: galleryPhotosMap.get(gallery.uri) ?? [],
        labels,
      });
    })
    .filter((g): g is ReturnType<typeof galleryToView> => g !== null);
}

export function getGalleryCount(
  userDid: string,
  ctx: BffContext,
): number {
  return ctx.indexService.countRecords("social.grain.gallery", {
    where: [{ field: "did", equals: userDid }],
  });
}

export function getGalleriesByHashtag(
  tag: string,
  ctx: BffContext,
): GalleryView[] {
  const galleryUris = getGalleryUrisByFacet(
    "tag",
    tag,
    ctx,
  );
  const galleriesUrisInComments = getGalleryUrisByCommentFacet(
    "tag",
    tag,
    ctx,
  );
  const uniqueGalleryUris = Array.from(
    new Set([...galleryUris, ...galleriesUrisInComments]),
  );
  return getGalleriesBulk(
    uniqueGalleryUris,
    ctx,
  );
}

export function createGallery(
  ctx: BffContext,
  {
    title,
    description,
  }: {
    title: string;
    description?: string;
  },
): Promise<string> {
  let facets: Facet[] | undefined = undefined;
  if (description) {
    try {
      const resp = parseFacetedText(description, ctx);
      facets = resp.facets;
    } catch (e) {
      console.error("Failed to parse facets:", e);
    }
  }

  return ctx.createRecord<Gallery>(
    "social.grain.gallery",
    {
      title,
      description,
      facets,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
  );
}

export async function updateGallery(
  ctx: BffContext,
  uri: string,
  {
    title,
    description,
  }: {
    title: string;
    description?: string;
  },
): Promise<boolean> {
  let facets: Facet[] | undefined = undefined;
  if (description) {
    try {
      const resp = parseFacetedText(description, ctx);
      facets = resp.facets;
    } catch (e) {
      console.error("Failed to parse facets:", e);
    }
  }

  const gallery = ctx.indexService.getRecord<WithBffMeta<Gallery>>(uri);
  if (!gallery) return false;
  const rkey = new AtUri(uri).rkey;
  await ctx.updateRecord<Gallery>(
    "social.grain.gallery",
    rkey,
    {
      title,
      description,
      facets,
      updatedAt: new Date().toISOString(),
      createdAt: gallery.createdAt,
    },
  );
  return true;
}

export async function createGalleryItem(
  ctx: BffContext,
  galleryUri: string,
  itemUri: string,
): Promise<string | null> {
  const count = ctx.indexService.countRecords(
    "social.grain.gallery.item",
    {
      where: [
        { field: "gallery", equals: galleryUri },
      ],
    },
  );
  const position = count ?? 0;
  const createdItemUri = await ctx.createRecord<GalleryItem>(
    "social.grain.gallery.item",
    {
      gallery: galleryUri,
      item: itemUri,
      position,
      createdAt: new Date().toISOString(),
    },
  );
  return createdItemUri;
}

export async function removeGalleryItem(
  ctx: BffContext,
  galleryUri: string,
  photoUri: string,
): Promise<boolean> {
  const { items: galleryItems } = ctx.indexService.getRecords<
    WithBffMeta<GalleryItem>
  >(
    "social.grain.gallery.item",
    {
      where: [
        { field: "gallery", equals: galleryUri },
        { field: "item", equals: photoUri },
      ],
    },
  );
  if (!galleryItems.length) return false;
  for (const item of galleryItems) {
    await ctx.deleteRecord(item.uri);
  }
  return true;
}

export async function applySort(
  writes: Array<{
    itemUri: string;
    position: number;
  }>,
  ctx: BffContext,
): Promise<boolean> {
  const urisToUpdate = writes.map((update) => update.itemUri);

  const { items: galleryItems } = ctx.indexService.getRecords<
    WithBffMeta<GalleryItem>
  >(
    "social.grain.gallery.item",
    {
      where: [
        { field: "uri", in: urisToUpdate },
      ],
    },
  );

  const positionMap = new Map<string, number>();
  for (const update of writes) {
    positionMap.set(update.itemUri, update.position);
  }

  const updates = galleryItems.map((item) => {
    // Use position from positionMap if it exists (including 0)
    const hasPosition = positionMap.has(item.uri);
    return {
      collection: "social.grain.gallery.item",
      rkey: new AtUri(item.uri).rkey,
      data: {
        ...item,
        position: hasPosition ? positionMap.get(item.uri) : item.position,
      },
    };
  });

  try {
    await ctx.updateRecords(updates);
  } catch (error) {
    console.error("Failed to update gallery item positions:", error);
    return false;
  }

  return true;
}
