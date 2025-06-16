import { PhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { $Typed } from "$lexicon/util.ts";
import { AtUri } from "@atproto/syntax";
import { Button, Dialog } from "@bigmoves/bff/components";

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
      <Dialog.Content class="dark:bg-zinc-950 flex flex-col relative">
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
              <div class="grid grid-cols-3 gap-2 my-4">
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
          class="w-full bg-white dark:bg-zinc-950 py-4 flex justify-between items-center z-102"
          _="on load set my.count to 0"
        >
          <span id="selected-count">0 selected</span>
          <Button
            type="submit"
            form="photo-select-form"
            variant="primary"
            class="px-4 py-2"
          >
            Add
          </Button>
        </div>

        <div class="w-full flex flex-col gap-2 mt-2">
          <Dialog.Close class="w-full">Close</Dialog.Close>
        </div>
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
      class="mb-2"
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
      class="group cursor-pointer aspect-square relative"
      _="
    on click
      set checkbox to me.querySelector('input[type=checkbox]')
      set checkbox.checked to not checkbox.checked
      trigger change on checkbox
  "
    >
      <div class="absolute top-2 left-2 z-30 pointer-events-none">
        <input
          type="checkbox"
          name="photoUri"
          value={photo.uri}
          class="accent-sky-600 w-5 h5 scale-150 pointer-events-auto"
          _="
        on change
          set checkedCount to my.closest('form') or document
            then set checkedInputs to checkedCount.querySelectorAll('input[type=checkbox]:checked')
            then set count to checkedInputs.length
            then set #selected-count's innerText to `${count} selected`"
        />
      </div>
      <img
        src={photo.fullsize}
        alt={photo.alt}
        class="w-full h-full object-cover pointer-events-none"
        loading="lazy"
      />
    </button>
  );
}

// const galleryRkey = new AtUri(galleryUri).rkey;
// const photoRkey = new AtUri(photo.uri).rkey;
