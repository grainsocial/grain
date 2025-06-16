import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { PhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { Un$Typed } from "$lexicon/util.ts";
import { AtUri } from "@atproto/syntax";
import { AltTextButton } from "./AltTextButton.tsx";
import { PhotoExifButton } from "./PhotoExifButton.tsx";
import { RemovePhotoDialogButton } from "./RemovePhotoDialog.tsx";

export function PhotoPreview({
  photo,
  selectedGallery,
}: Readonly<{
  photo: Un$Typed<PhotoView>;
  selectedGallery?: GalleryView;
}>) {
  const atUri = new AtUri(photo.uri);
  const did = atUri.hostname;
  const rkey = atUri.rkey;
  return (
    <div
      class="relative aspect-square bg-zinc-200 dark:bg-zinc-900"
      id={`photo-${rkey}`}
    >
      {photo.uri ? <AltTextButton photoUri={photo.uri} /> : null}
      {photo.exif ? <PhotoExifButton photoUri={photo.uri} /> : null}
      {photo.uri
        ? (
          <RemovePhotoDialogButton
            selectedGallery={selectedGallery}
            photoUri={photo.uri}
          />
        )
        : null}
      {photo.uri
        ? (
          <button
            type="button"
            hx-get={`/dialogs/gallery/${did}/select?photoUri=${photo.uri}`}
            hx-trigger="click"
            hx-target="#layout"
            hx-swap="afterbegin"
            class="bg-zinc-950/50 z-10 absolute bottom-2 right-2 cursor-pointer size-4 flex items-center justify-center"
          >
            <i class="fas fa-plus text-white"></i>
          </button>
        )
        : null}
      <img
        src={photo.thumb}
        alt=""
        data-state={photo.uri ? "complete" : "pending"}
        class="absolute inset-0 w-full h-full object-contain data-[state=pending]:opacity-50"
      />
    </div>
  );
}
