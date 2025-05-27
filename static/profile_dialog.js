// deno-lint-ignore-file no-window

function handleAvatarImageSelect(fileInput) {
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    Grain.readFileAsDataURL(file).then((dataUrl) => {
      const previewImg = document.createElement("img");
      previewImg.src = dataUrl;
      previewImg.className = "rounded-full w-full h-full object-cover";
      previewImg.alt = "Avatar preview";

      const imagePreview = fileInput.closest("form").querySelector(
        "#image-preview",
      );
      if (imagePreview) {
        imagePreview.innerHTML = "";
        imagePreview.appendChild(previewImg);
      }
    });
  }
}

async function updateProfile(formElement) {
  const formData = new FormData(formElement);

  const avatarFile = formData.get("file");
  if (avatarFile && avatarFile.type.startsWith("image/")) {
    try {
      const dataUrl = await Grain.readFileAsDataURL(file);

      const resized = await Grain.doResize(dataUrl, {
        width: 2000,
        height: 2000,
        maxSize: 1000 * 1000, // 1MB
        mode: "contain",
      });

      const blob = Grain.dataURLToBlob(resized.path);
      formData.set("file", blob, avatarFile.name);
    } catch (err) {
      console.error("Error resizing image:", err);
      formData.delete("file");
    }
  }

  htmx.ajax("POST", "/actions/profile/update", {
    "swap": "none",
    "values": Object.fromEntries(formData),
    "source": formElement,
  });
}

window.Grain = window.Grain || {};
window.Grain.handleAvatarImageSelect = handleAvatarImageSelect;
window.Grain.updateProfile = updateProfile;
