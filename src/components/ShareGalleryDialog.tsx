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
  return (
    <Dialog>
      <Dialog.Content class="gap-4">
        <Dialog.Title>Share gallery</Dialog.Title>
        <Dialog.X class="fill-zinc-950 dark:fill-zinc-50" />

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
