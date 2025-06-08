import exifr from "exifr";
import htmx from "htmx.org";
import { dataURLToBlob, doResize, readFileAsDataURL } from "./photo_manip.ts";
import { tags as supportedTags } from "./tags.ts";

export class UploadPage {
  public async uploadPhotos(formElement: HTMLFormElement): Promise<void> {
    const formData = new FormData(formElement);
    const fileList = formData.getAll("files") as File[] ?? [];
    const parseExif = formData.get("parseExif") === "on";

    if (fileList.length > 10) {
      alert("You can only upload 10 photos at a time");
      return;
    }

    const uploadPromises = fileList.map(async (file) => {
      let fileDataUri: string | ArrayBuffer | null;
      let tags: Exif | undefined = undefined;
      let resized;

      try {
        fileDataUri = await readFileAsDataURL(file);
        if (fileDataUri === null || typeof fileDataUri !== "string") {
          console.error("File data URL is not a string:", fileDataUri);
          alert("Error reading file.");
          return;
        }
      } catch (err) {
        console.error("Error reading file as Data URL:", err);
        alert("Error reading file.");
        return;
      }

      if (parseExif) {
        try {
          const rawTags = await exifr.parse(file, { pick: supportedTags });
          console.log("EXIF tags:", await exifr.parse(file));
          tags = normalizeExif(rawTags);
        } catch (err) {
          console.error("Error reading EXIF data:", err);
        }
      }

      try {
        resized = await doResize(fileDataUri, {
          width: 2000,
          height: 2000,
          maxSize: 1000 * 1000, // 1MB
          mode: "contain",
        });
      } catch (err) {
        console.error("Error resizing image:", err);
        alert("Error resizing image.");
        return;
      }

      const blob = dataURLToBlob(resized.path);

      const fd = new FormData();
      fd.append("file", blob, file.name);
      fd.append("width", String(resized.width));
      fd.append("height", String(resized.height));

      if (tags) {
        fd.append("exif", JSON.stringify(tags));
      }

      htmx.ajax("POST", "/actions/photo", {
        "swap": "afterbegin",
        "target": "#image-preview",
        "values": Object.fromEntries(fd),
        "source": formElement,
      });
    });

    await Promise.all(uploadPromises);

    // Clear the file input after upload
    (formElement.querySelector("input[type='file']") as HTMLInputElement)!
      .value = "";
  }
}

const SCALE_FACTOR = 1000000;

type Exif = Record<
  string,
  number | string | boolean | Array<number | string> | undefined | Date
>;

function normalizeExif(
  exif: Exif,
  scale: number = SCALE_FACTOR,
): Exif {
  const normalized: Record<
    string,
    number | string | boolean | Array<number | string> | undefined
  > = {};

  for (const [key, value] of Object.entries(exif)) {
    const camelKey = key[0].toLowerCase() + key.slice(1);

    if (typeof value === "number") {
      normalized[camelKey] = Math.round(value * scale);
    } else if (Array.isArray(value)) {
      normalized[camelKey] = value.map((v) =>
        typeof v === "number" ? Math.round(v * scale) : v
      );
    } else if (value instanceof Date) {
      normalized[camelKey] = value.toISOString();
    } else if (typeof value === "string") {
      normalized[camelKey] = value;
    } else if (typeof value === "boolean") {
      normalized[camelKey] = value;
    } else if (value === undefined) {
      normalized[camelKey] = undefined;
    } else {
      // fallback for unknown types
      normalized[camelKey] = String(value);
    }
  }

  return normalized;
}
