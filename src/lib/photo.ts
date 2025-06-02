import { Record as Photo } from "$lexicon/types/social/grain/photo.ts";
import { ExifView, PhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { Record as PhotoExif } from "$lexicon/types/social/grain/photo/exif.ts";
import { $Typed } from "$lexicon/util.ts";
import { BffContext, WithBffMeta } from "@bigmoves/bff";
import { PUBLIC_URL, USE_CDN } from "../env.ts";

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
    $type: "social.grain.photo.defs#exifView",
  };
}

const EXIF_SCALE = 1000000;

export function deserializeExif(
  exif: WithBffMeta<PhotoExif>,
  scale: number = EXIF_SCALE,
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
