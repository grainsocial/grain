import {
  dataURLToBlob,
  doResize,
  readFileAsDataURL,
} from "@bigmoves/bff/browser";
import exifr from "exifr";
import htmx from "htmx.org";
import { Exif, normalizeExif, tags as supportedTags } from "./exif.ts";

export class GalleryPhotosDialog {
  public async uploadPhotos(formElement: HTMLFormElement): Promise<void> {
    const formData = new FormData(formElement);
    const fileList = formData.getAll("files") as File[] ?? [];
    const parseExif = formData.get("parseExif") === "on";
    const galleryUri = formData.get("galleryUri") as string;
    const page = formData.get("page") as string;

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

      if (galleryUri) {
        fd.append("galleryUri", galleryUri);
      }

      if (page) {
        fd.append("page", page);
      }

      const response = await fetch(`/actions/photo`, {
        method: "POST",
        body: fd,
      });

      if (!response.ok) {
        alert(await response.text());
        return;
      }

      const html = await response.text();
      const temp = document.createElement("div");
      temp.innerHTML = html;

      const preview = document.querySelector("#image-preview");
      if (preview) {
        const child = temp.firstElementChild;
        if (child) {
          preview.appendChild(child);
        }
        htmx.process(preview);
      }

      const galleryContainer = document.querySelector(
        "#gallery-container",
      );
      if (galleryContainer) {
        const child = temp.firstElementChild;
        if (child) {
          galleryContainer.appendChild(child.children[0]);
        }
        htmx.process(galleryContainer);
      }

      const galleryInfo = document.querySelector(
        "#gallery-info",
      );
      if (galleryInfo) {
        const child = temp.children[1];
        if (child) {
          galleryInfo.replaceWith(child.children[0]);
        }
        htmx.process(galleryInfo);
      }
    });

    await Promise.all(uploadPromises);

    // Clear the file input after upload
    const fileInput = formElement.querySelector("input[type='file']");
    if (fileInput instanceof HTMLInputElement) {
      fileInput.value = "";
    }
  }
}
