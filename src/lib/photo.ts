import { Record as Photo } from "$lexicon/types/social/grain/photo.ts";
import { PhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { $Typed } from "$lexicon/util.ts";
import { WithBffMeta } from "@bigmoves/bff";
import { PUBLIC_URL, USE_CDN } from "../env.ts";

export function photoThumb(did: string, cid: string) {
  return photoUrl(did, cid, "thumbnail");
}

export function photoToView(
  did: string,
  photo: WithBffMeta<Photo>,
): $Typed<PhotoView> {
  return {
    $type: "social.grain.photo.defs#photoView",
    uri: photo.uri,
    cid: photo.photo.ref.toString(),
    thumb: photoUrl(did, photo.photo.ref.toString(), "thumbnail"),
    fullsize: photoUrl(did, photo.photo.ref.toString(), "fullsize"),
    alt: photo.alt,
    aspectRatio: photo.aspectRatio,
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
