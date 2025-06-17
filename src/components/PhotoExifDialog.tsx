import { PhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { getOrderedExifData } from "../lib/photo.ts";
import { Dialog } from "./Dialog.tsx";

export function PhotoExifDialog({
  photo,
}: Readonly<{
  photo: PhotoView;
}>) {
  return (
    <Dialog id="photo-alt-dialog">
      <Dialog.Content>
        <Dialog.X class="fill-zinc-950 dark:fill-zinc-50" />
        <Dialog.Title>Camera Settings</Dialog.Title>
        <div class="aspect-square relative">
          <img
            src={photo.fullsize}
            alt={photo.alt}
            class="absolute inset-0 w-full h-full object-contain"
          />
        </div>
        {photo.exif && (
          <div className="mt-4 text-sm space-y-1">
            {getOrderedExifData(photo).map(({ displayKey, value }) => (
              <div key={displayKey} className="flex justify-between gap-4">
                <dt className="font-medium">{displayKey}</dt>
                <dd className="text-right max-w-[60%] break-words">
                  {String(value)}
                </dd>
              </div>
            ))}
          </div>
        )}
        <Dialog.Close variant="secondary" class="w-full mt-4">
          Close
        </Dialog.Close>
      </Dialog.Content>
    </Dialog>
  );
}
