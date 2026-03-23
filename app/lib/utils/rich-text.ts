interface Facet {
  index: { byteStart: number; byteEnd: number };
  features: Array<
    | { $type: "app.bsky.richtext.facet#link"; uri: string }
    | { $type: "app.bsky.richtext.facet#mention"; did: string }
    | { $type: "app.bsky.richtext.facet#tag"; tag: string }
  >;
}

export async function parseTextToFacets(
  text: string,
  resolveHandle?: (handle: string) => Promise<string | null>,
): Promise<{ text: string; facets: Facet[] }> {
  if (!text) return { text: "", facets: [] };

  const facets: Facet[] = [];
  const encoder = new TextEncoder();

  function getByteOffset(str: string, charIndex: number): number {
    return encoder.encode(str.slice(0, charIndex)).length;
  }

  const claimed = new Set<number>();

  function isRangeClaimed(start: number, end: number): boolean {
    for (let i = start; i < end; i++) {
      if (claimed.has(i)) return true;
    }
    return false;
  }

  function claimRange(start: number, end: number): void {
    for (let i = start; i < end; i++) {
      claimed.add(i);
    }
  }

  // URLs (highest priority)
  const urlRegex = /https?:\/\/[^\s<>[\]()]+/g;
  let urlMatch;
  while ((urlMatch = urlRegex.exec(text)) !== null) {
    const start = urlMatch.index;
    const end = start + urlMatch[0].length;
    if (!isRangeClaimed(start, end)) {
      claimRange(start, end);
      facets.push({
        index: { byteStart: getByteOffset(text, start), byteEnd: getByteOffset(text, end) },
        features: [{ $type: "app.bsky.richtext.facet#link", uri: urlMatch[0] }],
      });
    }
  }

  // Mentions
  const mentionRegex =
    /@([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?/g;
  let mentionMatch;
  while ((mentionMatch = mentionRegex.exec(text)) !== null) {
    const start = mentionMatch.index;
    const end = start + mentionMatch[0].length;
    const handle = mentionMatch[0].slice(1);
    if (!isRangeClaimed(start, end) && resolveHandle) {
      try {
        const did = await resolveHandle(handle);
        if (did) {
          claimRange(start, end);
          facets.push({
            index: { byteStart: getByteOffset(text, start), byteEnd: getByteOffset(text, end) },
            features: [{ $type: "app.bsky.richtext.facet#mention", did }],
          });
        }
      } catch {
        // Handle not found — skip
      }
    }
  }

  // Hashtags
  const hashtagRegex = /#([a-zA-Z][a-zA-Z0-9_]*)/g;
  let hashtagMatch;
  while ((hashtagMatch = hashtagRegex.exec(text)) !== null) {
    const start = hashtagMatch.index;
    const end = start + hashtagMatch[0].length;
    const tag = hashtagMatch[1];
    if (!isRangeClaimed(start, end)) {
      claimRange(start, end);
      facets.push({
        index: { byteStart: getByteOffset(text, start), byteEnd: getByteOffset(text, end) },
        features: [{ $type: "app.bsky.richtext.facet#tag", tag }],
      });
    }
  }

  facets.sort((a, b) => a.index.byteStart - b.index.byteStart);
  return { text, facets };
}
