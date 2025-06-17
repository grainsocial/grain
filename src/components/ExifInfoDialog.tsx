import { Dialog } from "./Dialog.tsx";

export function ExifInfoDialog() {
  return (
    <Dialog class="z-101">
      <Dialog.Content class="flex flex-col gap-2">
        <Dialog.Title>EXIF Info</Dialog.Title>
        <Dialog.X class="fill-zinc-950 dark:fill-zinc-50" />
        <div class="text-sm mt-2">
          <p>
            When you upload photos to Grain, we extract a small set of standard
            EXIF metadata from each image. This information is used to help
            organize photos by date taken, camera make, lens make, etc. This is
            a list of tags we currently support.
          </p>
          <ul class="list-disc ml-6 mt-2">
            <li>
              <b>DateTimeOriginal</b>: When the photo was taken
            </li>
            <li>
              <b>ExposureTime</b>: Shutter speed (e.g., 1/250s)
            </li>
            <li>
              <b>FNumber</b>: Aperture (f-stop)
            </li>
            <li>
              <b>Flash</b>: Whether the flash fired
            </li>
            <li>
              <b>FocalLengthIn35mmFormat</b>: Lens focal length (35mm
              equivalent)
            </li>
            <li>
              <b>ISO</b>: ISO sensitivity setting
            </li>
            <li>
              <b>LensMake</b>: Lens manufacturer
            </li>
            <li>
              <b>LensModel</b>: Lens model
            </li>
            <li>
              <b>Make</b>: Camera manufacturer
            </li>
            <li>
              <b>Model</b>: Camera model
            </li>
          </ul>
          <p class="mt-2">
            No GPS or location data is collected, and we do not store any
            personally identifiable information. The EXIF data is used solely to
            enhance your photo organization and discovery experience on Grain.
          </p>
          <p class="mt-2">
            If you want to remove EXIF data from your photo after uploading, you
            can delete the photo and re-upload with the "Include image metadata"
            checkbox unchecked.
          </p>
          <p class="mt-2">
            You can learn more about the types of metadata commonly embedded in
            photos at{" "}
            <a
              href="https://exiv2.org/tags.html"
              className="text-sky-500 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              exiv2.org
            </a>
            .
          </p>
        </div>
        <Dialog.Close variant="secondary">Close</Dialog.Close>
      </Dialog.Content>
    </Dialog>
  );
}
