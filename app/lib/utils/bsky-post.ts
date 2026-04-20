import { callXrpc } from "$hatk/client";
import { parseTextToFacets } from "$lib/utils/rich-text";

interface BskyPostOptions {
  url: string;
  title?: string;
  location?: {
    name: string;
    address?: {
      locality?: string;
      region?: string;
      country?: string;
    };
  } | null;
  description?: string;
  images: Array<{
    dataUrl: string;
    alt?: string;
    width: number;
    height: number;
  }>;
}

export async function createBskyPost(options: BskyPostOptions): Promise<void> {
  const { url, title, location, description, images } = options;

  const graphemeLength = (s: string) => [...new Intl.Segmenter().segment(s)].length;

  // Build location line. `location.name` may be either a POI name
  // ("Blue Bottle Coffee") or a Nominatim-formatted fallback that already
  // contains locality/state/country ("New York, New York, United States").
  // We take the first comma-separated chunk as the primary label, then
  // append locality/region/country while dropping adjacent duplicates —
  // this keeps useful context for POIs ("Blue Bottle Coffee, Oakland, California, US")
  // while collapsing duplicates for city fallbacks ("New York, US").
  let locationLine: string | null = null;
  if (location) {
    const trimmedName = location.name.trim();
    const primaryLabel = trimmedName.split(",")[0].trim() || trimmedName;
    const parts: string[] = [];
    const appendIfDistinct = (value?: string) => {
      const v = value?.trim();
      if (!v) return;
      if (parts[parts.length - 1]?.toLowerCase() === v.toLowerCase()) return;
      parts.push(v);
    };
    appendIfDistinct(primaryLabel);
    appendIfDistinct(location.address?.locality);
    appendIfDistinct(location.address?.region);
    appendIfDistinct(location.address?.country);
    locationLine = `📍 ${parts.join(", ")}`;
  }

  // Build suffix (location + hashtag + link)
  const suffixLines: string[] = [];
  if (locationLine) {
    suffixLines.push("");
    suffixLines.push(locationLine);
  }
  suffixLines.push("");
  suffixLines.push(`#GrainSocial ${url}`);
  const suffix = suffixLines.join("\n");

  const maxContent = 300 - graphemeLength(suffix);

  // Build title + description content
  let content = "";
  const t = title?.trim() ?? "";
  const d = description?.trim() ?? "";
  if (t && d) content = `${t}, ${d}`;
  else if (t) content = t;
  else if (d) content = d;

  if (content && graphemeLength(content) > maxContent) {
    const segments = [...new Intl.Segmenter().segment(content)];
    content =
      segments
        .slice(0, Math.max(0, maxContent - 1))
        .map((s) => s.segment)
        .join("") + "…";
  }

  const lines: string[] = [];
  if (content) lines.push(content);
  lines.push(...suffixLines);

  const postText = lines.join("\n");

  const resolveHandle = async (handle: string): Promise<string | null> => {
    try {
      const res = await fetch(
        `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`,
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data.did ?? null;
    } catch {
      return null;
    }
  };
  const postFacets = (await parseTextToFacets(postText, resolveHandle)).facets;

  const imageRefs: Array<{
    image: any;
    alt: string;
    aspectRatio?: { width: number; height: number };
  }> = [];
  for (const img of images.slice(0, 4)) {
    const base64 = img.dataUrl.split(",")[1];
    const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const blob = new Blob([binary], { type: "image/jpeg" });
    const uploadResult = await callXrpc("dev.hatk.uploadBlob", blob as any);
    imageRefs.push({
      image: (uploadResult as any).blob,
      alt: img.alt || "",
      aspectRatio: { width: img.width, height: img.height },
    });
  }

  await callXrpc("dev.hatk.createRecord", {
    collection: "app.bsky.feed.post",
    record: {
      text: postText,
      facets: postFacets.length > 0 ? postFacets : undefined,
      embed:
        imageRefs.length > 0
          ? { $type: "app.bsky.embed.images" as const, images: imageRefs }
          : undefined,
      tags: ["grainsocial"],
      createdAt: new Date().toISOString(),
    },
  });
}
