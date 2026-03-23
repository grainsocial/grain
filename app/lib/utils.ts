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

/** Format a date like grain-next: Today, Yesterday, N days ago, then Mon DD. */
export function relativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
