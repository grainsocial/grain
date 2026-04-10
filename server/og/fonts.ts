import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const cache = new Map<string, ArrayBuffer>();

function loadFont(filename: string) {
  let data = cache.get(filename);
  if (!data) {
    data = readFileSync(resolve(import.meta.dirname, filename)).buffer;
    cache.set(filename, data);
  }
  return data;
}

export function syneBrandFont() {
  return {
    name: "Syne",
    data: loadFont("Syne-ExtraBold.ttf"),
    weight: 800 as const,
    style: "normal" as const,
  };
}

export function fallbackFonts() {
  return [
    {
      name: "Noto Sans JP",
      data: loadFont("NotoSansJP-Regular.ttf"),
      weight: 400 as const,
      style: "normal" as const,
    },
    {
      name: "Noto Emoji",
      data: loadFont("NotoEmoji-Regular.ttf"),
      weight: 400 as const,
      style: "normal" as const,
    },
  ];
}

export function allFonts() {
  return [syneBrandFont(), ...fallbackFonts()];
}
