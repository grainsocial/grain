import { PhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { AtUri } from "@atproto/syntax";
import { Dialog } from "@bigmoves/bff/components";
import { PhotoSelectButton } from "./PhotoSelectButton.tsx";

export function PhotoSelectDialog({
  galleryUri,
  itemUris,
  photos,
}: Readonly<{
  galleryUri: string;
  itemUris: string[];
  photos: PhotoView[];
}>) {
  return (
    <Dialog id="photo-select-dialog" class="z-100">
      <Dialog.Content class="w-full max-w-5xl dark:bg-zinc-950 sm:min-h-screen flex flex-col relative">
        <Dialog.X class="fill-zinc-950 dark:fill-zinc-50" />
        <Dialog.Title>Add photos</Dialog.Title>
        {photos.length
          ? (
            <p class="my-2 text-center">
              Choose photos to add/remove from your gallery. Click close when
              done.
            </p>
          )
          : null}
        {photos.length
          ? (
            <div class="grid grid-cols-3 sm:grid-cols-5 gap-4 my-4 flex-1">
              {photos.map((photo) => (
                <PhotoSelectButton
                  key={photo.cid}
                  galleryUri={galleryUri}
                  itemUris={itemUris}
                  photo={photo}
                />
              ))}
            </div>
          )
          : (
            <div class="flex-1 flex justify-center items-center my-30">
              <p>
                No photos yet.{" "}
                <a
                  href={`/upload?returnTo=${new AtUri(galleryUri).rkey}`}
                  class="hover:underline font-semibold text-sky-500"
                >
                  Upload
                </a>{" "}
                photos and return to add.
              </p>
            </div>
          )}
        <div class="w-full flex flex-col gap-2 mt-2">
          <Dialog.Close class="w-full">Close</Dialog.Close>
        </div>
      </Dialog.Content>
    </Dialog>
  );
}
