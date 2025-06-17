import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { isPhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { AtUri } from "@atproto/syntax";
import { Button } from "./Button.tsx";
import { Dialog } from "./Dialog.tsx";

export function GallerySortDialog(
  { gallery }: Readonly<{ gallery: GalleryView }>,
) {
  return (
    <Dialog id="gallery-sort-dialog">
      <Dialog.Content>
        <Dialog.X class="fill-zinc-950 dark:fill-zinc-50" />
        <Dialog.Title>Sort gallery</Dialog.Title>
        <p class="my-2 text-center">Drag photos to rearrange</p>
        <form
          hx-post={`/actions/gallery/${new AtUri(gallery.uri).rkey}/sort`}
          hx-trigger="submit"
          hx-swap="none"
        >
          <div class="sortable grid grid-cols-3 sm:grid-cols-5 gap-2 mt-2">
            {gallery?.items?.filter(isPhotoView).map((item) => (
              <div
                key={item.cid}
                class="relative aspect-square cursor-grab"
              >
                <input type="hidden" name="item" value={item.uri} />
                <img
                  src={item.fullsize}
                  alt={item.alt}
                  class="w-full h-full absolute object-cover"
                />
              </div>
            ))}
          </div>
          <div class="flex flex-col gap-2 mt-2">
            <Button
              variant="primary"
              type="submit"
              class="w-full"
            >
              Save
            </Button>
            <Button
              variant="secondary"
              type="button"
              class="w-full"
              _={Dialog._closeOnClick}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Dialog.Content>
    </Dialog>
  );
}
