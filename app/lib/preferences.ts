import { writable, get } from "svelte/store";
import { callXrpc } from "$hatk/client";
import { Images, Users, Camera, MapPin, Hash, Pin, Sparkles } from "lucide-svelte";

export interface PinnedFeed {
  id: string;
  label: string;
  type: string;
  path: string;
}

export const DEFAULT_PINNED: PinnedFeed[] = [
  { id: "recent", label: "Recent", type: "feed", path: "/feeds/recent" },
  { id: "following", label: "Following", type: "feed", path: "/feeds/following" },
  { id: "foryou", label: "For You", type: "feed", path: "/feeds/for-you" },
];

/* eslint-disable @typescript-eslint/no-explicit-any */
const CORE_ICONS: Record<string, any> = {
  recent: Images,
  following: Users,
  foryou: Sparkles,
};

const TYPE_ICONS: Record<string, any> = {
  camera: Camera,
  location: MapPin,
  hashtag: Hash,
};

export function feedIcon(feed: { id: string; type: string }): any {
  return CORE_ICONS[feed.id] ?? TYPE_ICONS[feed.type] ?? Pin;
}

export const pinnedFeeds = writable<PinnedFeed[]>(DEFAULT_PINNED);
export const includeExif = writable(true);
export const includeLocation = writable(true);

function isValidFeed(f: unknown): f is PinnedFeed {
  return (
    !!f &&
    typeof f === "object" &&
    typeof (f as any).id === "string" &&
    typeof (f as any).label === "string" &&
    typeof (f as any).path === "string"
  );
}

export function loadPreferences(prefs: Record<string, unknown> | null): void {
  if (!prefs) return;
  if (Array.isArray(prefs.pinnedFeeds)) {
    const valid = prefs.pinnedFeeds.filter(isValidFeed).map((f) =>
      f.id === "recent" && f.path === "/" ? { ...f, path: "/feeds/recent" } : f
    );
    if (valid.length > 0) pinnedFeeds.set(valid);
  }
  if (typeof prefs.includeExif === "boolean") includeExif.set(prefs.includeExif);
  if (typeof prefs.includeLocation === "boolean") includeLocation.set(prefs.includeLocation);
}

export async function setIncludeExif(value: boolean): Promise<void> {
  includeExif.set(value);
  await callXrpc("dev.hatk.putPreference", { key: "includeExif", value });
}

export async function setIncludeLocation(value: boolean): Promise<void> {
  includeLocation.set(value);
  await callXrpc("dev.hatk.putPreference", { key: "includeLocation", value });
}

export async function pinFeed(feed: PinnedFeed): Promise<boolean> {
  const previous = get(pinnedFeeds);
  if (previous.some((f) => f.id === feed.id)) return false;
  const updated = [...previous, feed];
  pinnedFeeds.set(updated);
  try {
    await callXrpc("dev.hatk.putPreference", { key: "pinnedFeeds", value: updated });
  } catch {
    pinnedFeeds.set(previous);
  }
  return true;
}

export async function unpinFeed(id: string): Promise<boolean> {
  const previous = get(pinnedFeeds);
  const updated = previous.filter((f) => f.id !== id);
  if (updated.length === previous.length) return false;
  if (updated.length === 0) return false;
  pinnedFeeds.set(updated);
  try {
    await callXrpc("dev.hatk.putPreference", { key: "pinnedFeeds", value: updated });
  } catch {
    pinnedFeeds.set(previous);
  }
  return true;
}

export async function reorderFeeds(feeds: PinnedFeed[]): Promise<void> {
  const previous = get(pinnedFeeds);
  pinnedFeeds.set(feeds);
  try {
    await callXrpc("dev.hatk.putPreference", { key: "pinnedFeeds", value: feeds });
  } catch {
    pinnedFeeds.set(previous);
  }
}

export function resetPreferences(): void {
  pinnedFeeds.set(DEFAULT_PINNED);
  includeExif.set(true);
  includeLocation.set(true);
}

export async function markNotificationsSeen(): Promise<void> {
  await callXrpc("dev.hatk.putPreference", {
    key: "lastSeenNotifications",
    value: new Date().toISOString(),
  });
}
