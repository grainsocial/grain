import { PhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { Dialog } from "@bigmoves/bff/components";

export function PhotoExifDialog({
  photo,
}: Readonly<{
  photo: PhotoView;
}>) {
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
          <div className="mt-4 text-sm text-zinc-700 dark:text-zinc-300">
            {
              /* <a
              href={`https://pdsls.dev/${photo.exif.uri}`}
              className="my-4 hover:underline font-semibold block text-sky-500"
            >
              Inspect Record
            </a> */
            }
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              {Object.entries(photo.exif)
                .filter(
                  ([key]) =>
                    ![
                      "$type",
                      "photo",
                      "createdAt",
                      "uri",
                      "cid",
                      "did",
                      "indexedAt",
                    ].includes(key),
                )
                .map(([key, value]) => {
                  let displayKey;
                  if (key.toLowerCase() === "iso") {
                    displayKey = "ISO";
                  } else {
                    displayKey = key
                      .replace(/([a-z])([A-Z])/g, "$1 $2")
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (c) => c.toUpperCase());
                  }
                  return (
                    <>
                      <dt className="font-medium text-right">{displayKey}:</dt>
                      <dd className="text-left">{String(value)}</dd>
                    </>
                  );
                })}
            </dl>
          </div>
        )}
      </Dialog.Content>
    </Dialog>
  );
}
