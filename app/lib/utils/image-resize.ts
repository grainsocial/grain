import { extractExif, type ExifData, type ExifMetaData, type GpsData } from "./extract-exif";

export interface ProcessedPhoto {
  dataUrl: string;
  width: number;
  height: number;
  alt: string;
  exif?: ExifData;
  gps?: GpsData;
  meta?: ExifMetaData;
}

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getBase64Size(base64: string): number {
  const str = base64.split(",")[1] || base64;
  return Math.ceil((str.length * 3) / 4);
}

function createResizedImage(
  dataUrl: string,
  options: { width: number; height: number; quality: number },
): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(options.width / img.width, options.height / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;

      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, w, h);

      resolve({ dataUrl: canvas.toDataURL("image/jpeg", options.quality), width: w, height: h });
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export async function resizeImage(
  dataUrl: string,
  opts: { width: number; height: number; maxSize: number },
): Promise<{ dataUrl: string; width: number; height: number }> {
  let bestResult: { dataUrl: string; width: number; height: number } | null = null;
  let minQuality = 0;
  let maxQuality = 100;

  while (maxQuality - minQuality > 1) {
    const quality = Math.round((minQuality + maxQuality) / 2);
    const result = await createResizedImage(dataUrl, {
      width: opts.width,
      height: opts.height,
      quality: quality / 100,
    });

    const size = getBase64Size(result.dataUrl);
    if (size <= opts.maxSize) {
      bestResult = result;
      minQuality = quality;
    } else {
      maxQuality = quality;
    }
  }

  if (!bestResult) {
    throw new Error("Failed to compress image within size limit");
  }

  return bestResult;
}

export async function processPhotos(files: File[]): Promise<ProcessedPhoto[]> {
  const processed: ProcessedPhoto[] = [];
  for (const file of files) {
    const [dataUrl, extracted] = await Promise.all([readFileAsDataURL(file), extractExif(file)]);
    const resized = await resizeImage(dataUrl, {
      width: 2000,
      height: 2000,
      maxSize: 900_000,
    });
    processed.push({
      dataUrl: resized.dataUrl,
      width: resized.width,
      height: resized.height,
      alt: extracted.meta?.alt ?? "",
      exif: extracted.exif,
      gps: extracted.gps,
      meta: extracted.meta,
    });
  }
  return processed;
}
