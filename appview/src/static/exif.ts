export const tags = [
  "DateTimeOriginal",
  "ExposureTime",
  "FNumber",
  "Flash",
  "FocalLengthIn35mmFormat",
  "ISO",
  "LensMake",
  "LensModel",
  "Make",
  "Model",
];

export const SCALE_FACTOR = 1000000;

export type Exif = Record<
  string,
  number | string | boolean | Array<number | string> | undefined | Date
>;

export function normalizeExif(
  exif: Exif,
  scale: number = SCALE_FACTOR,
): Exif {
  const normalized: Record<
    string,
    number | string | boolean | Array<number | string> | undefined
  > = {};

  for (const [key, value] of Object.entries(exif)) {
    const camelKey = key[0].toLowerCase() + key.slice(1);

    if (typeof value === "number") {
      normalized[camelKey] = Math.round(value * scale);
    } else if (Array.isArray(value)) {
      normalized[camelKey] = value.map((v) =>
        typeof v === "number" ? Math.round(v * scale) : v
      );
    } else if (value instanceof Date) {
      normalized[camelKey] = value.toISOString();
    } else if (typeof value === "string") {
      normalized[camelKey] = value;
    } else if (typeof value === "boolean") {
      normalized[camelKey] = value;
    } else if (value === undefined) {
      normalized[camelKey] = undefined;
    } else {
      // fallback for unknown types
      normalized[camelKey] = String(value);
    }
  }

  return normalized;
}
