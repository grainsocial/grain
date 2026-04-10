import { readFileSync } from "node:fs";
import { resolve } from "node:path";

let syneFontData: ArrayBuffer | null = null;

export function syneBrandFont() {
  if (!syneFontData) {
    const path = resolve(import.meta.dirname, "Syne-ExtraBold.ttf");
    syneFontData = readFileSync(path).buffer;
  }
  return {
    name: "Syne",
    data: syneFontData,
    weight: 800 as const,
    style: "normal" as const,
  };
}
