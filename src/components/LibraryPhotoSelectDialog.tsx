import { PhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { $Typed } from "$lexicon/util.ts";
import { AtUri } from "@atproto/syntax";
import { Button } from "./Button.tsx";
import { Dialog } from "./Dialog.tsx";

export function LibraryPhotoSelectDialog({
  galleryUri,
  photos,
}: Readonly<{
  galleryUri: string;
  photos: $Typed<PhotoView>[];
}>) {
  const rkey = new AtUri(galleryUri).rkey;
  return (
    <Dialog id="photo-select-dialog" class="z-101">
      <Dialog.Content class="flex flex-col gap-4">
        <Dialog.X class="fill-zinc-950 dark:fill-zinc-50" />
        <Dialog.Title>My library</Dialog.Title>

        <form
          id="photo-select-form"
          hx-put={`/actions/gallery/${rkey}/add-photos`}
          hx-target="#dialog-target"
          hx-swap="innerHTML"
          class="flex-1 overflow-y-auto"
        >
          {photos.length
            ? (
              <div class="grid grid-cols-3 gap-2">
                {photos.map((photo) => (
                  <PhotoItem
                    key={photo.cid}
                    photo={photo}
                  />
                ))}
              </div>
            )
            : (
              <div class="flex justify-center items-center my-30 h-full">
                <p>No photos yet.</p>
              </div>
            )}
        </form>

        <div
          id="photo-select-overlay"
          class="w-full bg-white dark:bg-zinc-900 flex justify-between items-center z-102"
          _="on load set my.count to 0"
        >
          <span id="selected-count">0 selected</span>
          <Button
            type="submit"
            form="photo-select-form"
            variant="primary"
          >
            Add to gallery
          </Button>
        </div>

        <Dialog.Close variant="secondary" class="w-full">Close</Dialog.Close>
      </Dialog.Content>
    </Dialog>
  );
}

export function LibaryPhotoSelectDialogButton({ galleryUri }: Readonly<{
  galleryUri: string;
}>) {
  const rkey = new AtUri(galleryUri).rkey;
  return (
    <Button
      type="button"
      variant="secondary"
      hx-get={`/dialogs/gallery/${rkey}/library`}
      hx-trigger="click"
      hx-target="#dialog-target"
      hx-swap="innerHTML"
    >
      <i class="fa-solid fa-plus mr-2" />
      Add from library
    </Button>
  );
}

export function PhotoItem({
  photo,
}: Readonly<{
  photo: PhotoView;
}>) {
  return (
    <button
      type="button"
      class="group relative aspect-square cursor-pointer"
      _="
    on click
      set checkbox to me.querySelector('input[type=checkbox]')
      set checkbox.checked to not checkbox.checked
      trigger change on checkbox
  "
    >
      <input
        type="checkbox"
        name="photoUri"
        value={photo.uri}
        class="peer absolute top-2 left-2 z-30 w-5 h-5 accent-sky-600"
        _="
      on change
        set checkedCount to my.closest('form') or document
        then set checkedInputs to checkedCount.querySelectorAll('input[type=checkbox]:checked')
        then set count to checkedInputs.length
        then set #selected-count's innerText to `${count} selected`"
      />

      <img
        src={photo.fullsize}
        alt={photo.alt}
        loading="lazy"
        class="w-full h-full object-cover transition-opacity duration-200 peer-checked:opacity-50"
      />
    </button>
  );
}
