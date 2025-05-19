import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { isPhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { Un$Typed } from "$lexicon/util.ts";
import { AtUri } from "@atproto/syntax";
import { cn } from "@bigmoves/bff/components";
import { galleryLink } from "../utils.ts";

export function GalleryPreviewLink({
  gallery,
  size = "default",
}: Readonly<{ gallery: Un$Typed<GalleryView>; size?: "small" | "default" }>) {
  const gap = size === "small" ? "gap-1" : "gap-2";
  return (
    <a
      href={galleryLink(
        gallery.creator.handle,
        new AtUri(gallery.uri).rkey,
      )}
      class={cn("flex w-full max-w-md aspect-[3/2] overflow-hidden", gap)}
    >
      <div class="w-2/3 h-full">
        <img
          src={gallery.items?.filter(isPhotoView)[0].thumb}
          alt={gallery.items?.filter(isPhotoView)[0].alt}
          class="w-full h-full object-cover"
        />
      </div>
      <div class={cn("w-1/3 flex flex-col h-full", gap)}>
        <div class="h-1/2">
          {gallery.items?.filter(isPhotoView)?.[1]
            ? (
              <img
                src={gallery.items?.filter(isPhotoView)?.[1]
                  ?.thumb}
                alt={gallery.items?.filter(isPhotoView)?.[1]?.alt}
                class="w-full h-full object-cover"
              />
            )
            : <div className="w-full h-full bg-zinc-200 dark:bg-zinc-900" />}
        </div>
        <div class="h-1/2">
          {gallery.items?.filter(isPhotoView)?.[2]
            ? (
              <img
                src={gallery.items?.filter(isPhotoView)?.[2]
                  ?.thumb}
                alt={gallery.items?.filter(isPhotoView)?.[2]?.alt}
                class="w-full h-full object-cover"
              />
            )
            : <div className="w-full h-full bg-zinc-200 dark:bg-zinc-900" />}
        </div>
      </div>
    </a>
  );
}
