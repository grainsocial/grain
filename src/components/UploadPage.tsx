import { PhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { Button } from "@bigmoves/bff/components";
import { profileLink } from "../utils.ts";
import { Breadcrumb } from "./Breadcrumb.tsx";
import { PhotoPreview } from "./PhotoPreview.tsx";

export function UploadPage({
  handle,
  photos,
  returnTo,
}: Readonly<{ handle: string; photos: PhotoView[]; returnTo?: string }>) {
  return (
    <div class="flex flex-col px-4 pt-4 mb-4 space-y-4">
      <Breadcrumb
        items={[
          returnTo
            ? { label: "Gallery", href: returnTo }
            : { label: "Profile", href: profileLink(handle) },
          { label: "Upload" },
        ]}
      />
      <div>
        Upload 10 photos at a time. Click{" "}
        <button
          type="button"
          hx-get="/dialogs/gallery/new"
          hx-target="#layout"
          hx-swap="afterbegin"
          class="font-semibold hover:underline cursor-pointer text-sky-500"
        >
          here
        </button>{" "}
        to create a gallery or add to existing galleries once you're done!
      </div>
      <form
        hx-encoding="multipart/form-data"
        _="on change from #file-input call Grain.uploadPage.uploadPhotos(me)"
      >
        <Button variant="primary" class="mb-4 w-full sm:w-fit" asChild>
          <label>
            <i class="fa fa-plus"></i> Add photos
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
      <div
        id="image-preview"
        class="w-full h-full grid grid-cols-2 sm:grid-cols-5 gap-2"
      >
        {photos.map((photo) => <PhotoPreview key={photo.cid} photo={photo} />)}
      </div>
    </div>
  );
}
