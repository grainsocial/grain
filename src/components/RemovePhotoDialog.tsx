import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { AtUri } from "@atproto/syntax";
import { Button } from "./Button.tsx";
import { Dialog } from "./Dialog.tsx";

export function RemovePhotoDialog(
  { photoUri, galleries, selectedGallery }: Readonly<
    {
      photoUri: string;
      galleries: GalleryView[];
      selectedGallery?: GalleryView;
    }
  >,
) {
  const rkey = new AtUri(photoUri).rkey;
  return (
    <Dialog>
      <Dialog.Content class="gap-4">
        <Dialog.Title>Remove photo</Dialog.Title>
        <Dialog.X class="fill-zinc-950 dark:fill-zinc-50" />

        {galleries.length > 0
          ? (
            <div id="photo-galleries" class="flex flex-col gap-2">
              <h2>
                This photo appears in the following galleries. Select to remove.
              </h2>
              <ul class="divide-y divide-zinc-200 dark:divide-zinc-800 border-t border-b border-zinc-200 dark:border-zinc-800">
                {galleries.map((gallery) => (
                  <li
                    key={gallery.uri}
                    class="w-full hover:bg-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <button
                      type="button"
                      hx-put={`/actions/gallery/${
                        new AtUri(gallery.uri).rkey
                      }/remove-photo/${rkey}?selectedGallery=${
                        selectedGallery?.uri ?? ""
                      }`}
                      class="flex justify-between items-center text-left w-full px-2 py-4"
                      _="on htmx:afterRequest
                          if me.closest('ul').children.length is 1
                            then remove #photo-galleries
                            else remove me.closest('li')"
                    >
                      {gallery.record.title || "Untitled Gallery"}
                      <i class="fa fa-close" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
          : null}

        <Button
          variant="destructive"
          hx-delete={`/actions/photo/${rkey}?selectedGallery=${
            selectedGallery?.uri ?? ""
          }`}
          hx-swap="none"
          hx-confirm="Are you sure you want to delete this photo? This action cannot be undone."
        >
          Delete photo
        </Button>
      </Dialog.Content>
    </Dialog>
  );
}

export function RemovePhotoDialogButton(
  { selectedGallery, photoUri }: Readonly<
    { selectedGallery?: GalleryView; photoUri: string }
  >,
) {
  const rkey = new AtUri(photoUri).rkey;
  return (
    <button
      type="button"
      class="bg-zinc-950/50 z-10 absolute top-2 right-2 cursor-pointer size-4 flex items-center justify-center"
      hx-get={`/dialogs/photo/${rkey}/remove?selectedGallery=${
        selectedGallery?.uri ?? ""
      }`}
      hx-trigger="click"
      hx-target="#layout"
      hx-swap="afterbegin"
      _="on click halt"
    >
      <i class="fas fa-close text-white"></i>
    </button>
  );
}

// <button
//   type="button"
//   id={`delete-photo-${rkey}`}
//   hx-delete={`/actions/photo/${rkey}`}
//   class="bg-zinc-950/50 z-10 absolute top-2 right-2 cursor-pointer size-4 flex items-center justify-center"
//   _="on htmx:afterOnLoad remove me.parentNode"
// >
//   <i class="fas fa-close text-white"></i>
// </button>
