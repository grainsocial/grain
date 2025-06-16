import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { AtUri } from "@atproto/syntax";
import { Button, Dialog } from "@bigmoves/bff/components";

export function EditGalleryDialog({ gallery }: Readonly<{
  gallery: GalleryView;
}>) {
  const rkey = new AtUri(gallery.uri).rkey;
  return (
    <Dialog class="z-100">
      <Dialog.Content class="dark:bg-zinc-950 relative gap-4">
        <Dialog.Title>Edit gallery</Dialog.Title>
        <Dialog.X class="fill-zinc-950 dark:fill-zinc-50" />

        <ul class="divide-y divide-zinc-200 dark:divide-zinc-800 border-t border-b border-zinc-200 dark:border-zinc-800">
          <li class="w-full hover:bg-zinc-200 dark:hover:bg-zinc-800">
            <button
              type="button"
              class="flex flex-col justify-start items-start text-left w-full px-2 py-4 focus:outline-2 focus:outline-sky-500 focus:outline-offset-[-2px] cursor-pointer"
              hx-get={`/dialogs/gallery/${rkey}/edit`}
              hx-target="#dialog-target"
              hx-swap="innerHTML"
            >
              Edit details
              <div class="text-sm text-zinc-600 dark:text-zinc-500">
                Update title, description, etc
              </div>
            </button>
          </li>
          <li class="w-full hover:bg-zinc-200 dark:hover:bg-zinc-800">
            <button
              type="button"
              class="flex flex-col justify-start items-start text-left w-full px-2 py-4 focus:outline-2 focus:outline-sky-500 focus:outline-offset-[-2px] cursor-pointer"
              hx-get={`/dialogs/gallery/${rkey}/photos`}
              hx-target="#dialog-target"
              hx-swap="innerHTML"
            >
              Edit photos
              <div class="text-sm text-zinc-600 dark:text-zinc-500">
                Upload photos, add from library, or remove photos
              </div>
            </button>
          </li>
          <li class="w-full hover:bg-zinc-200 dark:hover:bg-zinc-800">
            <button
              type="button"
              hx-get={`/dialogs/gallery/${rkey}/sort`}
              hx-target="#dialog-target"
              hx-swap="innerHTML"
              class="flex justify-between items-center text-left w-full px-2 py-4 focus:outline-2 focus:outline-sky-500 focus:outline-offset-[-2px] cursor-pointer"
            >
              Change sort order
            </button>
          </li>
        </ul>

        <Button
          variant="destructive"
          hx-post={`/actions/gallery/delete?uri=${gallery?.uri}`}
        >
          Delete gallery
        </Button>
      </Dialog.Content>
    </Dialog>
  );
}

export function EditGalleryButton({ gallery }: Readonly<{
  gallery: GalleryView;
}>) {
  const rkey = new AtUri(gallery.uri).rkey;
  return (
    <Button
      type="button"
      variant="primary"
      hx-get={`/dialogs/gallery/${rkey}`}
      hx-trigger="click"
      hx-target="#dialog-target"
      hx-swap="innerHTML"
    >
      Edit gallery
    </Button>
  );
}
