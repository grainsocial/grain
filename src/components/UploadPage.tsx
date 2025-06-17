import { Record as Gallery } from "$lexicon/types/social/grain/gallery.ts";
import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { PhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { Un$Typed } from "$lexicon/util.ts";
import { profileLink } from "../utils.ts";
import { Breadcrumb } from "./Breadcrumb.tsx";
import { Button } from "./Button.tsx";
import { GallerySelectDialogButton } from "./GallerySelectDialog.tsx";
import { PhotoPreview } from "./PhotoPreview.tsx";

export function UploadPage({
  userDid,
  userHandle,
  photos,
  returnTo,
  selectedGallery,
}: Readonly<
  {
    userDid: string;
    userHandle: string;
    photos: PhotoView[];
    returnTo?: string;
    selectedGallery?: Un$Typed<GalleryView>;
  }
>) {
  return (
    <div class="flex flex-col px-4 pt-4 mb-4 space-y-4">
      <Breadcrumb
        items={[
          returnTo
            ? { label: "Gallery", href: returnTo }
            : { label: "Profile", href: profileLink(userHandle) },
          { label: "Upload" },
        ]}
      />
      <form
        hx-encoding="multipart/form-data"
        _="on change from #file-input call Grain.uploadPage.uploadPhotos(me)"
      >
        <input hidden name="galleryUri" value={selectedGallery?.uri} />
        <Button variant="primary" class="mb-4 w-full sm:w-fit" asChild>
          <label>
            <i class="fa fa-plus"></i>{" "}
            {selectedGallery ? "Add photos to gallery" : "Add photos"}
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
      <div class="flex flex-col sm:flex-row items-center justify-between gap-2">
        {selectedGallery
          ? (
            <div className="flex-1 flex items-center my-2">
              Showing photos for &quot;{(selectedGallery?.record as Gallery)
                .title}&quot;&nbsp; (
              <span id="photos-count">{photos.length}</span>
              )
            </div>
          )
          : (
            <div className="flex-1 flex items-center my-2">
              All photos&nbsp;(
              <span id="photos-count">{photos.length}</span>
              )
            </div>
          )}
        <div class="flex items-center flex-col sm:flex-row gap-2 w-full justify-end flex-1">
          {selectedGallery
            ? (
              <Button variant="secondary" class="w-full sm:w-fit" asChild>
                <a
                  href="/upload"
                  title="Clear gallery selection"
                >
                  <i class="fa fa-close mr-2" />
                  Remove gallery filter
                </a>
              </Button>
            )
            : null}
          {!selectedGallery
            ? <GallerySelectDialogButton userDid={userDid} />
            : null}
          {
            /* {!selectedGallery && (
            <Button variant="secondary" class="w-full sm:w-fit">
              <i class="fa fa-plus"></i> Create gallery
            </Button>
          )} */
          }
          {
            /* {selectedGallery
            ? (
              <Button variant="secondary" asChild>
                <a
                  class="w-full sm:w-fit"
                  href={galleryLink(
                    selectedGallery.creator.handle,
                    new AtUri(selectedGallery.uri).rkey,
                  )}
                >
                  Go to gallery page
                </a>
              </Button>
            )
            : null} */
          }
        </div>
      </div>
      <div
        id="image-preview"
        class="w-full h-full grid grid-cols-2 sm:grid-cols-5 gap-2"
      >
        {photos.map((photo) => (
          <PhotoPreview
            key={photo.cid}
            photo={photo}
            selectedGallery={selectedGallery}
          />
        ))}
      </div>
    </div>
  );
}
