import { PhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { AtUri } from "@atproto/syntax";

export function PhotoSelectButton({
  galleryUri,
  photo,
}: Readonly<{
  galleryUri: string;
  photo: PhotoView;
}>) {
  const galleryRkey = new AtUri(galleryUri).rkey;
  const photoRkey = new AtUri(photo.uri).rkey;
  return (
    <button
      hx-put={`/actions/gallery/${galleryRkey}/remove-photo/${photoRkey}?selectedGallery=${
        galleryUri ?? ""
      }`}
      hx-swap="none"
      hx-confirm="Are you sure you want to remove this photo from the gallery?"
      type="button"
      class="group cursor-pointer aspect-square relative"
      _={`on htmx:afterOnLoad remove me`}
    >
      <div class="absolute top-2 right-2 z-30 size-4 bg-zinc-950/50 flex items-center justify-center">
        <i class="fa-close fa-solid text-white z-10" />
      </div>
      <img
        src={photo.fullsize}
        alt={photo.alt}
        class="w-full h-full object-cover"
        loading="lazy"
      />
    </button>
  );
}
