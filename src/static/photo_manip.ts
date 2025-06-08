type ResizeOptions = {
  width: number;
  height: number;
  quality: number;
  mode: "cover" | "contain" | "stretch";
};

type ResizeResult = {
  dataUrl: string;
  width: number;
  height: number;
};

type DoResizeOptions = {
  width: number;
  height: number;
  maxSize: number;
  mode: "cover" | "contain" | "stretch";
};

type DoResizeResult = {
  path: string;
  mime: string;
  size: number;
  width: number;
  height: number;
};

export function readFileAsDataURL(
  file: File,
): Promise<string | ArrayBuffer | null> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function dataURLToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(",");
  // Use RegExp.exec instead of match for type safety
  const mimeMatch = /:(.*?);/.exec(meta);
  if (!mimeMatch) throw new Error("Invalid data URL");
  const mime = mimeMatch[1];
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

function getDataUriSize(dataUri: string): number {
  const base64 = dataUri.split(",")[1];
  return Math.ceil((base64.length * 3) / 4);
}

function createResizedImage(
  dataUri: string,
  options: ResizeOptions,
): Promise<ResizeResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let scale: number;
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

export async function doResize(
  dataUri: string,
  opts: DoResizeOptions,
): Promise<DoResizeResult> {
  let bestResult: ResizeResult | null = null;
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
