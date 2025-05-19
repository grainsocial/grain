import { Record as Photo } from "$lexicon/types/social/grain/photo.ts";
import { PhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { $Typed } from "$lexicon/util.ts";
import { WithBffMeta } from "@bigmoves/bff";

export function photoThumb(did: string, cid: string) {
  return `https://cdn.bsky.app/img/feed_thumbnail/plain/${did}/${cid}@jpeg`;
}

export function photoToView(
  did: string,
  photo: WithBffMeta<Photo>,
): $Typed<PhotoView> {
  return {
    $type: "social.grain.photo.defs#photoView",
    uri: photo.uri,
    cid: photo.photo.ref.toString(),
    thumb:
      `https://cdn.bsky.app/img/feed_thumbnail/plain/${did}/${photo.photo.ref.toString()}@jpeg`,
    fullsize:
      `https://cdn.bsky.app/img/feed_fullsize/plain/${did}/${photo.photo.ref.toString()}@jpeg`,
    alt: photo.alt,
    aspectRatio: photo.aspectRatio,
  };
}
