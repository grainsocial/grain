import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { PhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { Dialog } from "https://jsr.io/@bigmoves/bff/0.3.0-beta.21/components/Dialog.tsx";
import { photoDialogLink } from "../utils.ts";

export function PhotoDialog({
  gallery,
  image,
  nextImage,
  prevImage,
}: Readonly<{
  gallery: GalleryView;
  image: PhotoView;
  nextImage?: PhotoView;
  prevImage?: PhotoView;
}>) {
  return (
    <Dialog id="photo-dialog" class="bg-zinc-950 z-100">
      <Dialog.X />
      {nextImage
        ? (
          <div
            hx-get={photoDialogLink(gallery, nextImage)}
            hx-trigger="keyup[key=='ArrowRight'] from:body, swipeleft from:body"
            hx-target="#photo-dialog"
            hx-swap="innerHTML"
          />
        )
        : null}
      {prevImage
        ? (
          <div
            hx-get={photoDialogLink(gallery, prevImage)}
            hx-trigger="keyup[key=='ArrowLeft'] from:body, swiperight from:body"
            hx-target="#photo-dialog"
            hx-swap="innerHTML"
          />
        )
        : null}
      <div
        class="flex flex-col w-5xl h-[calc(100vh-100px)] sm:h-screen z-20"
        _={Dialog._closeOnClick}
      >
        <div class="flex flex-col p-4 z-20 flex-1 relative">
          <img
            src={image.fullsize}
            alt={image.alt}
            class="absolute inset-0 w-full h-full object-contain"
          />
        </div>
        {image.alt
          ? (
            <div class="px-4 sm:px-0 py-4 bg-black text-white text-left">
              {image.alt}
            </div>
          )
          : null}
      </div>
    </Dialog>
  );
}
