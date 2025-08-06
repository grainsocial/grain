import { Record as Gallery } from "$lexicon/types/social/grain/gallery.ts";
import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { Button } from "./Button.tsx";
import { Dialog } from "./Dialog.tsx";
import { Input } from "./Input.tsx";
import { Label } from "./Label.tsx";
import { Textarea } from "./Textarea.tsx";

export function GalleryDetailsDialog({
  gallery,
}: Readonly<{ gallery?: GalleryView | null }>) {
  return (
    <Dialog id="gallery-dialog">
      <Dialog.Content>
        <Dialog.X class="fill-zinc-950 dark:fill-zinc-50" />
        <Dialog.Title>
          {gallery ? "Edit details" : "Create a new gallery"}
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
            <Label htmlFor="title">Gallery name</Label>
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
            <Label htmlFor="description">Description</Label>
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
        <div class="flex flex-col gap-2 mt-2">
          <Button
            variant="primary"
            form="gallery-form"
            type="submit"
            class="w-full"
          >
            {gallery ? "Update gallery" : "Create gallery"}
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
      </Dialog.Content>
    </Dialog>
  );
}
