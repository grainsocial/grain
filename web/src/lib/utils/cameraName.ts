// Normalize raw EXIF make+model strings for display.
//
// Examples:
//   "RICOH IMAGING COMPANY, LTD. GR II"             → "Ricoh GR II"
//   "RICOH IMAGING COMPANY, LTD. RICOH GR III"      → "Ricoh GR III"
//   "NIKON CORPORATION NIKON D600"                  → "Nikon D600"
//   "OLYMPUS IMAGING CORP. TG-3"                    → "Olympus TG-3"
//   "FUJI PHOTO FILM CO., LTD. SP-3000"             → "Fuji Photo Film SP-3000"
//   "LEICA CAMERA AG LEICA Q (Typ 116)"             → "Leica Q (Typ 116)"
//   "KONICA MINOLTA ALPHA SWEET DIGITAL"            → "Konica Minolta Alpha Sweet Digital"
//   "samsung Galaxy S24+"                           → "Samsung Galaxy S24+"
//   "Apple iPhone 14 Pro"                           → "Apple iPhone 14 Pro" (no change)
//   "SONY ILCE-7M3"                                 → "Sony ILCE-7M3" (model code preserved)
//   "FUJIFILM X-T30 II"                             → "Fujifilm X-T30 II" (roman numeral preserved)

export function cleanCameraName(raw: string): string {
  let s = raw
    .replace(/\bIMAGING COMPANY,?\s*LTD\.?/gi, "")
    .replace(/\bIMAGING CORP\.?/gi, "")
    .replace(/\bPHOTO FILM CO\.,?\s*LTD\.?/gi, "PHOTO FILM")
    .replace(/\bCAMERA AG\b/gi, "")
    .replace(/\bCORPORATION\b/gi, "")
    .replace(/\bCO\.,?\s*LTD\.?/gi, "")
    .replace(/\bGmbH\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Dedup adjacent identical tokens (case-insensitive) — e.g. "NIKON NIKON D300".
  const tokens = s.split(" ");
  const deduped: string[] = [];
  for (const t of tokens) {
    const prev = deduped[deduped.length - 1];
    if (!prev || prev.toUpperCase() !== t.toUpperCase()) deduped.push(t);
  }

  // Title-case brand-like tokens:
  //   - ALL-CAPS letters ≥ 4 chars (brands: NIKON, FUJIFILM, KONICA, MINOLTA)
  //   - all-lowercase letters ≥ 2 chars (samsung, motorola)
  // Skip tokens with digits, hyphens, roman numerals, or mixed case.
  const titled = deduped.map((w) => {
    if (/^[A-Z]{4,}$/.test(w)) return w[0] + w.slice(1).toLowerCase();
    if (/^[a-z]{2,}$/.test(w)) return w[0].toUpperCase() + w.slice(1);
    return w;
  });

  return titled.join(" ").trim();
}
