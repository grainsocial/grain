async function uploadPhotos(inputElement) {
  const fileList = Array.from(inputElement.files);

  if (fileList.length > 10) {
    alert("You can only upload 10 photos at a time");
    return;
  }

  const preview = document.querySelector("#image-preview");

  const uploadPromises = fileList.map(async (file) => {
    try {
      const dataUrl = await readFileAsDataURL(file);

      const resized = await doResize(dataUrl, {
        width: 2000,
        height: 2000,
        maxSize: 1000 * 1000, // 1MB
        mode: "contain",
      });

      const blob = dataURLToBlob(resized.path);

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

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function dataURLToBlob(dataUrl) {
  const [meta, base64] = dataUrl.split(",");
  const mime = meta.match(/:(.*?);/)[1];
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

function getDataUriSize(dataUri) {
  const base64 = dataUri.split(",")[1];
  return Math.ceil((base64.length * 3) / 4);
}

function createResizedImage(dataUri, options) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let scale = 1;
      if (options.mode === "cover") {
        scale = Math.max(
          options.width / img.width,
          options.height / img.height,
        );
      } else if (options.mode === "contain") {
        scale = Math.min(
          options.width / img.width,
          options.height / img.height,
        );
      } else {
        scale = 1; // stretch or fallback
      }

      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Failed to get canvas context"));

      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, w, h);

      resolve({
        dataUrl: canvas.toDataURL("image/jpeg", options.quality),
        width: w,
        height: h,
      });
    };
    img.onerror = (e) => reject(e);
    img.src = dataUri;
  });
}

async function doResize(dataUri, opts) {
  let bestResult = null;
  let minQuality = 0;
  let maxQuality = 101;

  while (maxQuality - minQuality > 1) {
    const quality = Math.round((minQuality + maxQuality) / 2);
    const result = await createResizedImage(dataUri, {
      width: opts.width,
      height: opts.height,
      quality: quality / 100,
      mode: opts.mode,
    });

    const size = getDataUriSize(result.dataUrl);

    if (size < opts.maxSize) {
      minQuality = quality;
      bestResult = result;
    } else {
      maxQuality = quality;
    }
  }

  if (!bestResult) {
    throw new Error("Failed to compress image");
  }

  return {
    path: bestResult.dataUrl,
    mime: "image/jpeg",
    size: getDataUriSize(bestResult.dataUrl),
    width: bestResult.width,
    height: bestResult.height,
  };
}
