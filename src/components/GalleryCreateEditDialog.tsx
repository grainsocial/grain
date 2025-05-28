import { Record as Gallery } from "$lexicon/types/social/grain/gallery.ts";
import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { Button, Dialog, Input, Textarea } from "@bigmoves/bff/components";

export function GalleryCreateEditDialog({
  gallery,
}: Readonly<{ gallery?: GalleryView | null }>) {
  return (
    <Dialog id="gallery-dialog" class="z-100">
      <Dialog.Content class="dark:bg-zinc-950 relative">
        <Dialog.X class="fill-zinc-950 dark:fill-zinc-50" />
        <Dialog.Title>
          {gallery ? "Edit gallery" : "Create a new gallery"}
        </Dialog.Title>
        <form
          id="gallery-form"
          class="max-w-xl"
          hx-post={`/actions/create-edit${
            gallery ? "?uri=" + gallery?.uri : ""
          }`}
          hx-swap="none"
          _="on htmx:afterOnLoad
            if event.detail.xhr.status != 200
              alert('Error: ' + event.detail.xhr.responseText)"
        >
          <div class="mb-4 relative">
            <label htmlFor="title">Gallery name</label>
            <Input
              type="text"
              id="title"
              name="title"
              class="dark:bg-zinc-800 dark:text-white"
              required
              value={(gallery?.record as Gallery)?.title}
              autofocus
            />
          </div>
          <div class="mb-2 relative">
            <label htmlFor="description">Description</label>
            <Textarea
              id="description"
              name="description"
              rows={4}
              class="dark:bg-zinc-800 dark:text-white"
            >
              {(gallery?.record as Gallery)?.description}
            </Textarea>
          </div>
        </form>
        <div class="max-w-xl">
          <input
            type="button"
            name="galleryUri"
            value={gallery?.uri}
            class="hidden"
          />
        </div>
        <form
          id="delete-form"
          hx-post={`/actions/gallery/delete?uri=${gallery?.uri}`}
        >
          <input type="hidden" name="uri" value={gallery?.uri} />
        </form>
        <div class="flex flex-col gap-2 mt-2">
          <Button
            variant="primary"
            form="gallery-form"
            type="submit"
            class="w-full"
          >
            {gallery ? "Update gallery" : "Create gallery"}
          </Button>
          {gallery
            ? (
              <Button
                variant="destructive"
                form="delete-form"
                type="submit"
                class="w-full"
              >
                Delete gallery
              </Button>
            )
            : null}
          <Button
            variant="secondary"
            type="button"
            class="w-full"
            _={Dialog._closeOnClick}
          >
            Cancel
          </Button>
        </div>
      </Dialog.Content>
    </Dialog>
  );
}
