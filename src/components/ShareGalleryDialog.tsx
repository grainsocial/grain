import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { AtUri } from "@atproto/syntax";
import { cn } from "@bigmoves/bff/components";
import { publicGalleryLink } from "../utils.ts";
import { Button } from "./Button.tsx";
import { Dialog } from "./Dialog.tsx";

export function ShareGalleryDialog({ gallery }: Readonly<{
  gallery: GalleryView;
}>) {
  const publicLink = publicGalleryLink(
    gallery.creator.handle,
    gallery.uri,
  );
  const intentLink = `https://bsky.app/intent/compose?text=${
    encodeURIComponent(
      "Check out this gallery on @grain.social \n" +
        publicLink,
    )
  }`;
  const darkroomServiceUrl = Deno.env.get("DARKROOM_HOST_URL") || "";
  const compositeImageUrl =
    `${darkroomServiceUrl}/xrpc/social.grain.darkroom.getGalleryComposite?uri=${
      encodeURIComponent(gallery.uri)
    }`;
  return (
    <Dialog>
      <Dialog.Content class="gap-4">
        <Dialog.Title>Share gallery</Dialog.Title>
        <Dialog.X class="fill-zinc-950 dark:fill-zinc-50" />

        <div class="w-full flex justify-center">
          <div class="relative">
            <div
              id="image-loader"
              class="flex items-center justify-center h-32 w-full"
            >
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 dark:border-zinc-100">
              </div>
            </div>
            <img
              src={compositeImageUrl}
              alt="Gallery preview"
              class="max-w-full h-auto border border-zinc-200 dark:border-zinc-800 hidden"
              _="on load add .hidden to #image-loader then remove .hidden from me
                 on error put 'Failed to load image' into #image-loader then add .text-red-500 to #image-loader"
            />
          </div>
        </div>

        <ul class="divide-y divide-zinc-200 dark:divide-zinc-800 border-t border-b border-zinc-200 dark:border-zinc-800">
          <li class="w-full hover:bg-zinc-200 dark:hover:bg-zinc-800">
            <a
              href={intentLink}
              target="_blank"
              rel="noopener noreferrer"
              class="flex gap-2 justify-start items-center text-left w-full px-2 py-4 cursor-pointer"
            >
              <i class="fa-brands fa-bluesky" />
              Share to Bluesky
            </a>
          </li>
          <li class="w-full hover:bg-zinc-200 dark:hover:bg-zinc-800">
            <button
              type="button"
              class="flex gap-2 justify-start items-center text-left w-full px-2 py-4 cursor-pointer"
              _={`on click call Grain.utils.copyToClipboard("${publicLink}")`}
            >
              <i class="fa-solid fa-link"></i>
              Copy link
            </button>
          </li>
          <li class="w-full hover:bg-zinc-200 dark:hover:bg-zinc-800">
            <a
              href={compositeImageUrl}
              download="gallery-preview.jpg"
              class="flex gap-2 justify-start items-center text-left w-full px-2 py-4 cursor-pointer"
            >
              <i class="fa-solid fa-download"></i>
              Save preview
            </a>
          </li>
        </ul>
        <Dialog.Close variant="secondary">Close</Dialog.Close>
      </Dialog.Content>
    </Dialog>
  );
}

export function ShareGalleryDialogButton(
  { class: classProp, gallery }: Readonly<
    { class?: string; gallery: GalleryView }
  >,
) {
  const rkey = new AtUri(gallery.uri).rkey;
  return (
    <Button
      variant="secondary"
      class={cn("whitespace-nowrap", classProp)}
      hx-get={`/dialogs/${gallery.creator.did}/gallery/${rkey}/share`}
      hx-trigger="click"
      hx-target="#dialog-target"
      hx-swap="innerHTML"
    >
      <i class="fa-solid fa-arrow-up-from-bracket mr-2" />
      Share
    </Button>
  );
}
