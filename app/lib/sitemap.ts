/** The record-backed sitemaps, each paged by getSitemap. */
export const KINDS = ["profiles", "galleries"] as const;

/** Indexable pages that are not a profile or a gallery. */
export const STATIC_PATHS = [
  "/",
  "/explore",
  "/cameras",
  "/locations",
  "/groups",
  "/support/terms",
  "/support/privacy",
  "/support/community-guidelines",
  "/support/copyright",
  "/support/child-safety",
];

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function xml(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${body}\n`, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
