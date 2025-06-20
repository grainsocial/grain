import { Record as Gallery } from "$lexicon/types/social/grain/gallery.ts";
import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { Record as GalleryItem } from "$lexicon/types/social/grain/gallery/item.ts";
import { Record as Photo } from "$lexicon/types/social/grain/photo.ts";
import { ExifView, PhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { Record as PhotoExif } from "$lexicon/types/social/grain/photo/exif.ts";
import { $Typed } from "$lexicon/util.ts";
import { BffContext, WithBffMeta } from "@bigmoves/bff";
import { format, parseISO } from "date-fns";
import { PUBLIC_URL, USE_CDN } from "../env.ts";
import { getActorProfile } from "./actor.ts";
import { galleryToView, getGalleryItemsAndPhotos } from "./gallery.ts";

export function getPhoto(
  uri: string,
  ctx: BffContext,
): $Typed<PhotoView> | null {
  const photo = ctx.indexService.getRecord<WithBffMeta<Photo>>(uri);
  if (!photo) return null;
  const { items: exifItems } = ctx.indexService.getRecords<
    WithBffMeta<PhotoExif>
  >(
    "social.grain.photo.exif",
    {
      where: [{ field: "photo", equals: uri }],
    },
  );
  return photoToView(
    photo.did,
    photo,
    exifItems.length > 0 ? exifItems[0] : undefined,
  );
}

export function photoThumb(did: string, cid: string) {
  return photoUrl(did, cid, "thumbnail");
}

export function photoToView(
  did: string,
  photo: WithBffMeta<Photo>,
  exif?: WithBffMeta<PhotoExif>,
): $Typed<PhotoView> {
  return {
    $type: "social.grain.photo.defs#photoView",
    uri: photo.uri,
    cid: photo.photo.ref.toString(),
    thumb: photoUrl(did, photo.photo.ref.toString(), "thumbnail"),
    fullsize: photoUrl(did, photo.photo.ref.toString(), "fullsize"),
    alt: photo.alt,
    aspectRatio: photo.aspectRatio,
    exif: exif ? exifToView(exif) : undefined,
  };
}

export function photoUrl(
  did: string,
  cid: string,
  type: "thumbnail" | "fullsize" = "fullsize",
): string {
  if (!USE_CDN) {
    return `${PUBLIC_URL}/actions/get-blob?did=${did}&cid=${cid}`;
  }
  return `https://cdn.bsky.app/img/feed_${type}/plain/${did}/${cid}@jpeg`;
}

export function exifToView(
  exif: WithBffMeta<PhotoExif>,
): $Typed<ExifView> {
  const deserializedExif = deserializeExif(exif);
  return {
    ...deserializedExif,
    make: deserializedExif.make ? formatMake(deserializedExif.make) : undefined,
    fNumber: deserializedExif.fNumber
      ? formatAperture(deserializedExif.fNumber)
      : undefined,
    dateTimeOriginal: deserializedExif.dateTimeOriginal
      ? format(
        parseISO(deserializedExif.dateTimeOriginal),
        "MMM d, yyyy, h:mm a",
      )
      : undefined,
    focalLengthIn35mmFormat: deserializedExif.focalLengthIn35mmFormat
      ? `${deserializedExif.focalLengthIn35mmFormat}mm`
      : undefined,
    exposureTime: deserializedExif.exposureTime !== undefined
      ? formatExposureTime(deserializedExif.exposureTime)
      : undefined,
    $type: "social.grain.photo.defs#exifView",
  };
}

function formatMake(make: string) {
  return make
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatAperture(fNumber: number): string {
  return `ƒ/${Number.isInteger(fNumber) ? fNumber : fNumber.toFixed(1)}`;
}

function formatExposureTime(seconds: number): string {
  if (seconds >= 1) {
    return `${seconds}s`;
  }

  const denominator = Math.round(1 / seconds);
  return `1/${denominator}`;
}

const SCALE_FACTOR = 1000000;

export function deserializeExif(
  exif: WithBffMeta<PhotoExif>,
  scale: number = SCALE_FACTOR,
): WithBffMeta<PhotoExif> {
  const deserialized: Partial<WithBffMeta<PhotoExif>> = {
    $type: exif.$type,
    photo: exif.photo,
    createdAt: exif.createdAt,
  };

  for (const [key, value] of Object.entries(exif)) {
    if (typeof value === "number") {
      deserialized[key] = value / scale;
    } else if (Array.isArray(value)) {
      deserialized[key] = value.map((v) =>
        typeof v === "number" ? v / scale : v
      );
    } else {
      deserialized[key] = value;
    }
  }

  deserialized.indexedAt = exif.indexedAt;
  deserialized.cid = exif.cid;
  deserialized.did = exif.did;
  deserialized.uri = exif.uri;

  return deserialized as WithBffMeta<PhotoExif>;
}

const exifDisplayNames: Record<string, string> = {
  Make: "Make",
  Model: "Model",
  LensMake: "Lens Make",
  LensModel: "Lens Model",
  FNumber: "Aperture",
  FocalLengthIn35mmFormat: "Focal Length",
  ExposureTime: "Exposure Time",
  ISO: "ISO",
  Flash: "Flash",
  DateTimeOriginal: "Date Taken",
};

const tagOrder = [
  "Make",
  "Model",
  "LensMake",
  "LensModel",
  "FNumber",
  "FocalLengthIn35mmFormat",
  "ExposureTime",
  "ISO",
  "Flash",
  "DateTimeOriginal",
];

export function getOrderedExifData(photo: PhotoView) {
  if (!photo.exif) return [];
  const entries = Object.entries(photo.exif)
    .filter(([key]) =>
      tagOrder.some((tag) => tag.toLowerCase() === key.toLowerCase())
    )
    .map(([key, value]) => {
      const tagKey = tagOrder.find(
        (tag) => tag.toLowerCase() === key.toLowerCase(),
      );
      const displayKey = tagKey && exifDisplayNames[tagKey]
        ? exifDisplayNames[tagKey]
        : key;
      return { key, displayKey, value };
    });

  // Sort according to tagOrder, unknown tags go last in original order
  return entries.sort((a, b) => {
    const aIdx = tagOrder.findIndex(
      (tag) => tag.toLowerCase() === a.key.toLowerCase(),
    );
    const bIdx = tagOrder.findIndex(
      (tag) => tag.toLowerCase() === b.key.toLowerCase(),
    );
    if (aIdx === -1 && bIdx === -1) return 0;
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });
}

export function getPhotoGalleries(
  photoUri: string,
  ctx: BffContext,
): GalleryView[] {
  const { items: galleryItems } = ctx.indexService.getRecords<
    WithBffMeta<GalleryItem>
  >(
    "social.grain.gallery.item",
    {
      where: [{ field: "item", equals: photoUri }],
    },
  );

  const galleryUris = Array.from(
    new Set(galleryItems.map((item) => item.gallery)),
  );
  if (galleryUris.length === 0) return [];

  const { items: galleries } = ctx.indexService.getRecords<
    WithBffMeta<Gallery>
  >(
    "social.grain.gallery",
    {
      where: [{ field: "uri", in: galleryUris }],
    },
  );
  if (!galleries.length) return [];

  const galleryPhotosMap = getGalleryItemsAndPhotos(ctx, galleries);
  const labels = ctx.indexService.queryLabels({ subjects: galleryUris });
  return galleries
    .map((gallery) => {
      const profile = getActorProfile(gallery.did, ctx);
      if (!profile) return undefined;
      return galleryToView({
        record: gallery,
        creator: profile,
        items: galleryPhotosMap.get(gallery.uri) ?? [],
        labels: labels ?? [],
      });
    })
    .filter((g): g is $Typed<GalleryView> => Boolean(g));
}

export function getPhotosBulk(
  uris: string[],
  ctx: BffContext,
) {
  if (!uris.length) return [];
  const { items: photos } = ctx.indexService.getRecords<WithBffMeta<Photo>>(
    "social.grain.photo",
    {
      where: [{ field: "uri", in: uris }],
    },
  );
  if (!photos.length) return [];
  const { items: exifItems } = ctx.indexService.getRecords<
    WithBffMeta<PhotoExif>
  >(
    "social.grain.photo.exif",
    {
      where: [{ field: "photo", in: uris }],
    },
  );
  const exifMap = new Map<string, WithBffMeta<PhotoExif>>();
  for (const exif of exifItems) {
    exifMap.set(exif.photo, exif);
  }
  return photos.map((photo) =>
    photoToView(photo.did, photo, exifMap.get(photo.uri))
  );
}
