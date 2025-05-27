// deno-lint-ignore-file no-window

async function uploadPhotos(inputElement) {
  const fileList = Array.from(inputElement.files);

  if (fileList.length > 10) {
    alert("You can only upload 10 photos at a time");
    return;
  }

  const preview = document.querySelector("#image-preview");

  const uploadPromises = fileList.map(async (file) => {
    try {
      const dataUrl = await Grain.readFileAsDataURL(file);

      const resized = await Grain.doResize(dataUrl, {
        width: 2000,
        height: 2000,
        maxSize: 1000 * 1000, // 1MB
        mode: "contain",
      });

      const blob = Grain.dataURLToBlob(resized.path);

      const fd = new FormData();
      fd.append("file", blob, file.name);
      fd.append("width", resized.width);
      fd.append("height", resized.height);

      const response = await fetch("/actions/photo/upload", {
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
      preview.insertBefore(temp.firstElementChild, preview.firstChild);
      htmx.process(preview);
    } catch (err) {
      console.error("Error uploading photo:", err);
      alert("Error uploading photo");
    }
  });

  await Promise.all(uploadPromises);
  inputElement.value = "";
}

window.Grain = window.Grain || {};
window.Grain.uploadPhotos = uploadPhotos;
