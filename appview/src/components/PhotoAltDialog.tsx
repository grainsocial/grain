import { PhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { AtUri } from "@atproto/syntax";
import { Button } from "./Button.tsx";
import { Dialog } from "./Dialog.tsx";
import { Label } from "./Label.tsx";
import { Textarea } from "./Textarea.tsx";

export function PhotoAltDialog({
  photo,
}: Readonly<{
  photo: PhotoView;
}>) {
  return (
    <Dialog id="photo-alt-dialog">
      <Dialog.Content>
        <Dialog.X class="fill-zinc-950 dark:fill-zinc-50" />
        <Dialog.Title>Add alt text</Dialog.Title>
        <div class="aspect-square relative">
          <img
            src={photo.fullsize}
            alt={photo.alt}
            class="absolute inset-0 w-full h-full object-contain"
          />
        </div>
        <form
          hx-put={`/actions/photo/${new AtUri(photo.uri).rkey}`}
          _="on htmx:afterOnLoad trigger closeDialog"
        >
          <div class="my-2">
            <Label htmlFor="alt">Descriptive alt text</Label>
            <Textarea
              id="alt"
              name="alt"
              rows={4}
              defaultValue={photo.alt}
              placeholder="Alt text"
              autoFocus
              class="dark:bg-zinc-800 dark:text-white"
            />
          </div>
          <div class="w-full flex flex-col gap-2 mt-2">
            <Button type="submit" variant="primary" class="w-full">
              Save
            </Button>
            <Dialog.Close variant="secondary" class="w-full">
              Close
            </Dialog.Close>
          </div>
        </form>
      </Dialog.Content>
    </Dialog>
  );
}
