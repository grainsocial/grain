/** Build a blob URL for a profile image. Returns pre-resolved URLs as-is. */
export function blobUrl(did: string, blobRef: unknown): string | null {
  if (!blobRef) return null;
  if (typeof blobRef === "string") {
    if (blobRef.startsWith("http")) return blobRef;
    try {
      blobRef = JSON.parse(blobRef);
    } catch {
      return null;
    }
  }
  const p = blobRef as any;
  if (!p?.ref?.$link) return null;
  return `https://cdn.bsky.app/img/avatar/plain/${did}/${p.ref.$link}@jpeg`;
}

/** Get initials for fallback avatar. */
export function initials(did: string): string {
  return did.split(":")[2]?.slice(0, 2).toUpperCase() || "??";
}

/** Truncate a DID for display. */
export function truncDid(did: string): string {
  if (did.length <= 24) return did;
  return did.slice(0, 12) + "\u2026" + did.slice(-6);
}

/** Compact relative time matching grain-native: now, 2m, 3h, 4d, 1w, then Mon DD. */
export function relativeTime(iso: string): string {
  const date = new Date(iso);
  const diff = (Date.now() - date.getTime()) / 1000;

  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
