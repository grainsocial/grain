import { PhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { Button } from "@bigmoves/bff/components";
import { profileLink } from "../utils.ts";
import { PhotoPreview } from "./PhotoPreview.tsx";

export function UploadPage({
  handle,
  photos,
  returnTo,
}: Readonly<{ handle: string; photos: PhotoView[]; returnTo?: string }>) {
  return (
    <div class="flex flex-col px-4 pt-4 mb-4 space-y-4">
      <div class="flex">
        <div class="flex-1">
          {returnTo
            ? (
              <a href={returnTo} class="hover:underline">
                <i class="fa-solid fa-arrow-left mr-2" />
                Back to gallery
              </a>
            )
            : (
              <a href={profileLink(handle)} class="hover:underline">
                <i class="fa-solid fa-arrow-left mr-2" />
                Back to profile
              </a>
            )}
        </div>
      </div>
      <Button variant="primary" class="mb-4 w-full sm:w-fit" asChild>
        <label>
          <i class="fa fa-plus"></i> Add photos
          <input
            class="hidden"
            type="file"
            multiple
            accept="image/*"
            _="on change call uploadPhotos(me)"
          />
        </label>
      </Button>
      <div
        id="image-preview"
        class="w-full h-full grid grid-cols-2 sm:grid-cols-5 gap-2"
      >
        {photos.map((photo) => (
          <PhotoPreview key={photo.cid} src={photo.thumb} uri={photo.uri} />
        ))}
      </div>
    </div>
  );
}
