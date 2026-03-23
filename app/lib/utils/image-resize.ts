export interface ExifData {
  make?: string;
  model?: string;
  lensMake?: string;
  lensModel?: string;
  exposureTime?: number;
  fNumber?: number;
  iSO?: number;
  focalLengthIn35mmFormat?: number;
  flash?: string;
  dateTimeOriginal?: string;
}

export interface GpsData {
  latitude: number;
  longitude: number;
}

export interface ProcessedPhoto {
  dataUrl: string;
  width: number;
  height: number;
  alt: string;
  exif?: ExifData;
  gps?: GpsData;
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

const SCALE = 1_000_000;

async function extractExif(file: File): Promise<{ exif?: ExifData; gps?: GpsData }> {
  try {
    const exifr = await import("exifr");
    const raw = await exifr.parse(file, {
      pick: [
        "Make",
        "Model",
        "LensMake",
        "LensModel",
        "ExposureTime",
        "FNumber",
        "ISO",
        "FocalLengthIn35mmFormat",
        "Flash",
        "DateTimeOriginal",
      ],
    });
    if (!raw) return {};
    const exif: ExifData = {};
    if (raw.Make) exif.make = String(raw.Make).trim();
    if (raw.Model) exif.model = String(raw.Model).trim();
    if (raw.LensMake) exif.lensMake = String(raw.LensMake).trim();
    if (raw.LensModel) exif.lensModel = String(raw.LensModel).trim();
    if (raw.ExposureTime) exif.exposureTime = Math.round(raw.ExposureTime * SCALE);
    if (raw.FNumber) exif.fNumber = Math.round(raw.FNumber * SCALE);
    if (raw.ISO) exif.iSO = Math.round(raw.ISO * SCALE);
    if (raw.FocalLengthIn35mmFormat)
      exif.focalLengthIn35mmFormat = Math.round(raw.FocalLengthIn35mmFormat * SCALE);
    if (raw.Flash != null) exif.flash = String(raw.Flash);
    if (raw.DateTimeOriginal instanceof Date)
      exif.dateTimeOriginal = raw.DateTimeOriginal.toISOString();

    let gps: GpsData | undefined;
    try {
      const coords = await exifr.gps(file);
      if (coords && typeof coords.latitude === "number" && typeof coords.longitude === "number") {
        gps = { latitude: coords.latitude, longitude: coords.longitude };
      }
    } catch {
      // GPS extraction failed, continue without it
    }

    return {
      exif: Object.keys(exif).length > 0 ? exif : undefined,
      gps,
    };
  } catch {
    return {};
  }
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
      alt: "",
      exif: extracted.exif,
      gps: extracted.gps,
    });
  }
  return processed;
}
