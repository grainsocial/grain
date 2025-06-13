import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { PhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { AtUri } from "@atproto/syntax";
import { cn, Dialog } from "@bigmoves/bff/components";
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
        class="flex flex-col w-5xl h-[calc(100vh-100px)] sm:h-screen z-20 relative sm:static"
        _={Dialog._closeOnClick}
      >
        <div class="flex flex-col p-4 z-20 flex-1 relative">
          <img
            src={image.fullsize}
            alt={image.alt}
            class="absolute inset-0 w-full h-full object-contain"
          />
        </div>
        {image.exif
          ? (
            <div class="hidden sm:block absolute bottom-2 right-2">
              <ExifButton photo={image} />
            </div>
          )
          : null}
        {image.alt
          ? (
            <div class="px-4 sm:px-0 py-4 bg-black text-white text-left flex">
              {image.alt}
              {image.exif
                ? (
                  <div class="block sm:hidden self-end justify-end -m-2">
                    <ExifButton photo={image} />
                  </div>
                )
                : null}
            </div>
          )
          : null}
        {!image.alt && image.exif
          ? (
            <ExifButton
              photo={image}
              class="block sm:hidden absolute bottom-2 right-2 z-100"
            />
          )
          : null}
      </div>
    </Dialog>
  );
}

function ExifButton(
  { photo, class: classProp }: Readonly<{ photo: PhotoView; class?: string }>,
) {
  const atUri = new AtUri(photo.uri);
  const did = atUri.hostname;
  const rkey = atUri.rkey;
  return (
    <button
      type="button"
      class={cn("text-zinc-50 p-2 cursor-pointer", classProp)}
      hx-get={`/dialogs/photo/${did}/${rkey}/exif-overlay`}
      hx-trigger="click"
      hx-target="#layout"
      hx-swap="afterbegin"
      _="on click halt"
    >
      <i class="fa fa-camera" />
      <span class="sr-only">Show EXIF</span>
    </button>
  );
}
