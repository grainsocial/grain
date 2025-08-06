import {
  dataURLToBlob,
  doResize,
  readFileAsDataURL,
} from "@bigmoves/bff/browser";
import htmx from "htmx.org";

export class ProfileDialog {
  public handleAvatarImageSelect(fileInput: HTMLInputElement): void {
    const file = fileInput.files?.[0];
    if (file) {
      readFileAsDataURL(file).then((dataUrl) => {
        const previewImg = document.createElement("img");
        if (typeof dataUrl === "string") {
          previewImg.src = dataUrl;
        } else {
          console.error(
            "Expected dataUrl to be a string, got:",
            typeof dataUrl,
          );
          previewImg.src = "";
        }
        previewImg.className = "rounded-full w-full h-full object-cover";
        previewImg.alt = "Avatar preview";

        const imagePreview = fileInput.closest("form")?.querySelector(
          "#image-preview",
        );
        if (imagePreview) {
          imagePreview.innerHTML = "";
          imagePreview.appendChild(previewImg);
        }
      });
    }
  }

  public async updateProfile(formElement: HTMLFormElement): Promise<void> {
    const formData = new FormData(formElement);

    const avatarFile = formData.get("file");
    if (
      avatarFile instanceof File && avatarFile?.type?.startsWith?.("image/")
    ) {
      try {
        const dataUrl = await readFileAsDataURL(avatarFile);

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
        formData.set("file", blob, avatarFile.name);
      } catch (err) {
        console.error("Error resizing image:", err);
        formData.delete("file");
      }
    }

    htmx.ajax("PUT", "/actions/profile", {
      swap: "none",
      values: Object.fromEntries(formData),
      source: formElement,
    });
  }
}
