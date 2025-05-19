import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { PhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { AtUri } from "@atproto/syntax";
import { photoDialogLink } from "../utils.ts";

export function PhotoButton({
  photo,
  gallery,
}: Readonly<{
  photo: PhotoView;
  gallery: GalleryView;
}>) {
  return (
    <button
      id={`photo-${new AtUri(photo.uri).rkey}`}
      type="button"
      hx-get={photoDialogLink(gallery, photo)}
      hx-trigger="click"
      hx-target="#layout"
      hx-swap="afterbegin"
      class="masonry-tile absolute cursor-pointer"
      data-width={photo.aspectRatio?.width}
      data-height={photo.aspectRatio?.height}
    >
      <img
        src={photo.fullsize}
        alt={photo.alt}
        class="w-full h-full object-cover"
      />
      {photo.alt
        ? (
          <div class="absolute bg-zinc-950 dark:bg-zinc-900 bottom-1 right-1 sm:bottom-1 sm:right-1 text-xs text-white font-semibold py-[1px] px-[3px]">
            ALT
          </div>
        )
        : null}
    </button>
  );
}
