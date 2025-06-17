import { PhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { $Typed } from "$lexicon/util.ts";
import { Button } from "./Button.tsx";
import { Dialog } from "./Dialog.tsx";
import { LibaryPhotoSelectDialogButton } from "./LibraryPhotoSelectDialog.tsx";
import { PhotoSelectButton } from "./PhotoSelectButton.tsx";

export function GalleryEditPhotosDialog({
  galleryUri,
  photos,
}: Readonly<{
  galleryUri: string;
  photos: $Typed<PhotoView>[];
}>) {
  return (
    <Dialog id="photo-select-dialog">
      <Dialog.Content class="flex flex-col">
        <Dialog.X class="fill-zinc-950 dark:fill-zinc-50" />
        <Dialog.Title>Edit photos</Dialog.Title>
        <div class="flex flex-col gap-4">
          <form
            class="w-full flex flex-col gap-4"
            hx-encoding="multipart/form-data"
            _="on change from #file-input call Grain.galleryPhotosDialog.uploadPhotos(me)"
          >
            <input hidden name="page" value="gallery" />
            <input hidden name="galleryUri" value={galleryUri} />
            <Button variant="primary" class="w-full" asChild>
              <label>
                <i class="fa-solid fa-cloud-arrow-up mr-2" />
                Upload photos
                <input
                  id="file-input"
                  class="hidden"
                  type="file"
                  name="files"
                  multiple
                  accept="image/*"
                />
              </label>
            </Button>

            <label class="block gap-2">
              <input
                id="parse-exif"
                type="checkbox"
                name="parseExif"
                class="mr-2 accent-sky-600"
                checked
              />
              Include image metadata (EXIF)
              <button
                type="button"
                hx-get="/dialogs/exif-info"
                hx-target="#layout"
                hx-swap="afterbegin"
                class="cursor-pointer"
              >
                <i class="fa fa-info-circle ml-1" />
              </button>
            </label>
          </form>
          <LibaryPhotoSelectDialogButton galleryUri={galleryUri} />
        </div>
        <div class="flex-1 overflow-y-auto">
          <div id="image-preview" class="grid grid-cols-3 gap-2 my-4">
            {photos.length
              ? (
                photos.map((photo) => (
                  <PhotoSelectButton
                    key={photo.cid}
                    galleryUri={galleryUri}
                    photo={photo}
                  />
                ))
              )
              : null}
          </div>
        </div>
        <div class="w-full flex flex-col gap-2 mt-2">
          <Dialog.Close variant="secondary" class="w-full">Close</Dialog.Close>
        </div>
      </Dialog.Content>
    </Dialog>
  );
}
