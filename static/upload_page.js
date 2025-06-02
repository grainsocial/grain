// deno-lint-ignore-file no-window

async function uploadPhotos(inputElement) {
  const fileList = Array.from(inputElement.files);

  if (fileList.length > 10) {
    alert("You can only upload 10 photos at a time");
    return;
  }

  const preview = document.querySelector("#image-preview");

  const uploadPromises = fileList.map(async (file) => {
    let dataUrl = "";
    let exif;
    let resized;

    try {
      dataUrl = await Grain.readFileAsDataURL(file);
    } catch (err) {
      console.error("Error reading file as Data URL:", err);
      alert("Error reading file.");
      return;
    }

    try {
      const rawExif = await window.exifr.parse(file, { gps: false });
      exif = normalizeExif(rawExif);
    } catch (err) {
      console.error("Error reading EXIF data:", err);
    }

    try {
      resized = await Grain.doResize(dataUrl, {
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

    const blob = Grain.dataURLToBlob(resized.path);

    const fd = new FormData();
    fd.append("file", blob, file.name);
    fd.append("width", resized.width);
    fd.append("height", resized.height);
    fd.append("exif", JSON.stringify(exif));

    try {
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

const SCALE_FACTOR = 1000000;

function normalizeExif(
  exif,
  scale = SCALE_FACTOR,
) {
  const normalized = {};

  for (const [key, value] of Object.entries(exif)) {
    const camelKey = key[0].toLowerCase() + key.slice(1);

    if (typeof value === "number") {
      normalized[camelKey] = Math.round(value * scale);
    } else if (Array.isArray(value)) {
      normalized[camelKey] = value.map((v) =>
        typeof v === "number" ? Math.round(v * scale) : v
      );
    } else {
      normalized[camelKey] = value;
    }
  }

  return normalized;
}

window.Grain = window.Grain || {};
window.Grain.uploadPhotos = uploadPhotos;
