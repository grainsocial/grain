import { PhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { Dialog } from "@bigmoves/bff/components";
import { getOrderedExifData } from "../lib/photo.ts";

export function ExifOverlayDialog({
  photo,
}: Readonly<{
  photo: PhotoView;
}>) {
  return (
    <Dialog class="z-101">
      <Dialog.Content
        class="bg-transparent text-zinc-50 relative"
        _={Dialog._closeOnClick}
      >
        <Dialog.Title>Camera Settings</Dialog.Title>
        <Dialog.X />
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
