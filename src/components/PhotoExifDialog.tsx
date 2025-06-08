import { PhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { Dialog } from "@bigmoves/bff/components";
import { getOrderedExifData } from "../lib/photo.ts";

export function PhotoExifDialog({
  photo,
}: Readonly<{
  photo: PhotoView;
}>) {
  console.log(getOrderedExifData(photo));
  return (
    <Dialog id="photo-alt-dialog" class="z-100">
      <Dialog.Content class="dark:bg-zinc-950 relative">
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
          <div className="mt-4 text-sm">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              {getOrderedExifData(photo).map(({ displayKey, value }) => (
                <>
                  <dt className="font-medium text-right">{displayKey}:</dt>
                  <dd className="text-left">{String(value)}</dd>
                </>
              ))}
            </dl>
          </div>
        )}
      </Dialog.Content>
    </Dialog>
  );
}
