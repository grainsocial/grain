import { PhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { AtUri } from "@atproto/syntax";
import { Button, Dialog, Textarea } from "@bigmoves/bff/components";

export function PhotoAltDialog({
  photo,
}: Readonly<{
  photo: PhotoView;
}>) {
  return (
    <Dialog id="photo-alt-dialog" class="z-30">
      <Dialog.Content class="dark:bg-zinc-950 relative">
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
            <label htmlFor="alt">Descriptive alt text</label>
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
            <Dialog.Close class="w-full">Cancel</Dialog.Close>
          </div>
        </form>
      </Dialog.Content>
    </Dialog>
  );
}
