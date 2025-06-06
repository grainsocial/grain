import htmx from "htmx.org";
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

        htmx.ajax("POST", "/actions/photo", {
          "swap": "afterbegin",
          "target": "#image-preview",
          "values": Object.fromEntries(fd),
          "source": inputElement,
        });
      } catch (err) {
        console.error("Error uploading photo:", err);
        alert("Error uploading photo");
      }
    });

    await Promise.all(uploadPromises);
    inputElement.value = "";
  }
}
