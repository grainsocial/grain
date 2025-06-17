import { Record as Gallery } from "$lexicon/types/social/grain/gallery.ts";
import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { AtUri } from "@atproto/syntax";
import { Button } from "./Button.tsx";
import { Dialog } from "./Dialog.tsx";
import { Input } from "./Input.tsx";

export function GallerySelectDialog(
  { photoUri, userDid, galleries }: Readonly<
    {
      photoUri?: string;
      userDid: string;
      galleries: GalleryView[];
    }
  >,
) {
  return (
    <Dialog id="gallery-select-dialog">
      <Dialog.Content class="min-h-[calc(100vh-100px)] overflow-hidden flex flex-col">
        <Dialog.X class="fill-zinc-950 dark:fill-zinc-50" />
        <Dialog.Title>
          {photoUri ? "Add to gallery" : "Select gallery"}
        </Dialog.Title>

        <form class="my-4">
          <Input
            type="text"
            name="q"
            placeholder="Enter gallery name or select from the list"
            hx-get={`/dialogs/gallery/${userDid}/select`}
            hx-target="#search-results"
            hx-trigger="input changed delay:500ms, keyup[key=='Enter']"
            hx-swap="innerHTML"
            autoFocus
          />
        </form>

        <div id="search-results" class="flex-1 overflow-y-auto">
          <GallerySelectDialogSearchResults
            photoUri={photoUri}
            galleries={galleries}
          />
        </div>
      </Dialog.Content>
    </Dialog>
  );
}

export function GallerySelectDialogSearchResults(
  { photoUri, galleries }: {
    photoUri?: string;
    galleries: GalleryView[];
  },
) {
  return (
    galleries.length > 0
      ? (
        <ul class="divide-zinc-200 dark:divide-zinc-800 divide-y">
          {galleries.map((gallery) => (
            <li
              key={gallery.cid}
              class="w-full hover:bg-zinc-200 dark:hover:bg-zinc-800"
            >
              {photoUri
                ? (
                  <button
                    type="button"
                    hx-put={addToGalleryActionLink(photoUri, gallery.uri)}
                    hx-swap="none"
                    class="block text-left w-full px-2 py-4"
                  >
                    {(gallery.record as Gallery).title}
                    <div class="text-sm text-zinc-600 dark:text-zinc-500">
                      {(gallery.record as Gallery).description}
                    </div>
                  </button>
                )
                : (
                  <a
                    href={uploadPageLink(gallery.uri)}
                    class="block w-full px-2 py-4"
                  >
                    {(gallery.record as Gallery).title}
                    <div class="text-sm text-zinc-600 dark:text-zinc-500">
                      {(gallery.record as Gallery).description}
                    </div>
                  </a>
                )}
            </li>
          ))}
        </ul>
      )
      : <p>No galleries found.</p>
  );
}

function addToGalleryActionLink(photoUri: string, galleryUri: string) {
  const photoRKey = new AtUri(photoUri).rkey;
  const galleryRkey = new AtUri(galleryUri).rkey;
  return `/actions/gallery/${galleryRkey}/add-photo/${photoRKey}?page=upload`;
}

function uploadPageLink(galleryUri: string) {
  const rkey = new AtUri(galleryUri).rkey;
  return `/upload?gallery=${rkey}`;
}

export function GallerySelectDialogButton(
  { userDid }: Readonly<{ userDid: string }>,
) {
  return (
    <Button
      type="button"
      variant="secondary"
      class="w-full sm:w-fit"
      hx-get={`/dialogs/gallery/${userDid}/select`}
      hx-trigger="click"
      hx-target="#layout"
      hx-swap="afterbegin"
      _="on click halt"
    >
      <i class="fa fa-filter mr-2" />
      Filter by gallery
    </Button>
  );
}
