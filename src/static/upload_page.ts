import htmx from "htmx.org";
import hyperscript from "hyperscript.org";
import { dataURLToBlob, doResize, readFileAsDataURL } from "./photo_manip.ts";

export class UploadPage {
  public async uploadPhotos(inputElement: HTMLInputElement): Promise<void> {
    const fileList = Array.from(inputElement.files ?? []);

    if (fileList.length > 10) {
      alert("You can only upload 10 photos at a time");
      return;
    }

    const uploadPromises = fileList.map(async (file) => {
      try {
        const dataUrl = await readFileAsDataURL(file);

        if (!dataUrl || typeof dataUrl !== "string") {
          console.error("Failed to read file as data URL");
          return;
        }

        const resized = await doResize(dataUrl, {
          width: 2000,
          height: 2000,
          maxSize: 1000 * 1000, // 1MB
          mode: "contain",
        });

        const blob = dataURLToBlob(resized.path);

        const fd = new FormData();
        fd.append("file", blob, (file as File).name);
        fd.append("width", String(resized.width));
        fd.append("height", String(resized.height));

        const response = await fetch("/actions/photo", {
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
        const photoId = temp?.firstElementChild?.id;

        const preview = document.querySelector("#image-preview");
        if (preview) {
          const firstChild = temp.firstElementChild;

          if (firstChild) {
            preview.insertBefore(firstChild, preview.firstChild);
          }

          htmx.process(preview);

          const deleteButton = preview.querySelector(
            `#delete-photo-${photoId}`,
          );
          if (!deleteButton) {
            return;
          }
          htmx.process(deleteButton);
          hyperscript.processNode(deleteButton);
        }
      } catch (err) {
        console.error("Error uploading photo:", err);
        alert("Error uploading photo");
      }
    });

    await Promise.all(uploadPromises);
    inputElement.value = "";
  }
}
