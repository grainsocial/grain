import { PhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { Un$Typed } from "$lexicon/util.ts";
import { AtUri } from "@atproto/syntax";
import { AltTextButton } from "./AltTextButton.tsx";
import { PhotoExifButton } from "./PhotoExifButton.tsx";

export function PhotoPreview({
  photo,
}: Readonly<{
  photo: Un$Typed<PhotoView>;
}>) {
  const rkey = new AtUri(photo.uri).rkey;
  return (
    <div
      class="relative aspect-square bg-zinc-200 dark:bg-zinc-900"
      id={rkey}
    >
      {photo.uri ? <AltTextButton photoUri={photo.uri} /> : null}
      {photo.exif ? <PhotoExifButton photoUri={photo.uri} /> : null}
      {photo.uri
        ? (
          <button
            type="button"
            id={`delete-photo-${rkey}`}
            hx-delete={`/actions/photo/${rkey}`}
            class="bg-zinc-950 z-10 absolute top-2 right-2 cursor-pointer size-4 flex items-center justify-center"
            _="on htmx:afterOnLoad remove me.parentNode"
          >
            <i class="fas fa-close text-white"></i>
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
