// The viewer's preferences as grain-serve keeps them: one typed set,
// `social.grain.actor.defs#preferences`, each kind of preference one item,
// read whole and written whole.
//
// The rest of the web reads them as one record of named values (`Settings`),
// and changes one value at a time (`putPreference`): each change is made to
// the set last read or written, and the set put back, one change after
// another, so two made at once both land.

import { call, query, type Fetch } from "$lib/xrpc";
import type {
  NotificationPref,
  NotificationsPref,
  PhotoMetadataPref,
  PinnedFeed,
  PinnedFeedsPref,
  Preferences as GrainActorDefsPreferences,
  ThemePref,
} from "$lib/lexicons/social/grain/actor/defs.ts";
import type * as getPreferences from "$lib/lexicons/social/grain/actor/getPreferences.ts";
import type * as putPreferences from "$lib/lexicons/social/grain/actor/putPreferences.ts";

export type { GrainActorDefsPreferences };

type Item = GrainActorDefsPreferences[number];

const PINNED = "social.grain.actor.defs#pinnedFeedsPref";
const METADATA = "social.grain.actor.defs#photoMetadataPref";
const THEME = "social.grain.actor.defs#themePref";
const NOTIFICATIONS = "social.grain.actor.defs#notificationsPref";

export type NotificationKind = "favorites" | "follows" | "comments" | "mentions";

/** The preferences as the web reads them, each left out until it is set. */
export interface Settings {
  pinnedFeeds?: PinnedFeed[];
  includeExif?: boolean;
  includeLocation?: boolean;
  theme?: string;
  notificationPrefs?: Partial<Record<NotificationKind, NotificationPref>>;
}

/** `prefs` read as `Settings`. */
export function toSettings(prefs: GrainActorDefsPreferences | null | undefined): Settings {
  const settings: Settings = {};
  for (const item of prefs ?? []) {
    // An open union: a kind this web does not know is passed over.
    switch (item.$type) {
      case PINNED:
        settings.pinnedFeeds = (item as PinnedFeedsPref).items;
        break;
      case METADATA: {
        const { includeExif, includeLocation } = item as PhotoMetadataPref;
        if (includeExif !== undefined) settings.includeExif = includeExif;
        if (includeLocation !== undefined) settings.includeLocation = includeLocation;
        break;
      }
      case THEME:
        settings.theme = (item as ThemePref).theme;
        break;
      case NOTIFICATIONS: {
        const { $type: _, ...kinds } = item as NotificationsPref;
        settings.notificationPrefs = kinds;
        break;
      }
    }
  }
  return settings;
}

/** `prefs` with `key` set to `value`, every other item as it was. */
export function withSetting<K extends keyof Settings>(
  prefs: GrainActorDefsPreferences,
  key: K,
  value: NonNullable<Settings[K]>,
): GrainActorDefsPreferences {
  const metadata = prefs.find((p) => p.$type === METADATA) as PhotoMetadataPref | undefined;
  let item: Item;
  switch (key) {
    case "pinnedFeeds":
      item = { $type: PINNED, items: value as PinnedFeed[] };
      break;
    case "includeExif":
    case "includeLocation":
      item = { ...metadata, $type: METADATA, [key]: value as boolean };
      break;
    case "theme":
      item = { $type: THEME, theme: value as string };
      break;
    case "notificationPrefs":
      item = { $type: NOTIFICATIONS, ...(value as Settings["notificationPrefs"]) };
      break;
    default:
      return prefs;
  }
  const at = prefs.findIndex((p) => p.$type === item.$type);
  return at === -1 ? [...prefs, item] : prefs.map((p, i) => (i === at ? item : p));
}

/**
 * The set last read or written in this browser, if any has been. On the
 * server, where one module serves every request, nothing is kept.
 */
let current: GrainActorDefsPreferences | null = null;
/** The changes made so far, in turn. */
let queue: Promise<unknown> = Promise.resolve();

/** Reads the viewer's preferences, and keeps them as the set changes start from. */
export async function readPreferences(fetch?: Fetch): Promise<Settings> {
  const { preferences } = await query<typeof getPreferences.main>(
    "social.grain.actor.getPreferences",
    {},
    fetch,
  );
  const prefs = preferences ?? [];
  if (inBrowser()) current = prefs;
  return toSettings(prefs);
}

/** Keeps `prefs`, read elsewhere (the layout's load), as the set changes start from. */
export function keepPreferences(prefs: GrainActorDefsPreferences): void {
  if (inBrowser()) current = prefs;
}

function inBrowser(): boolean {
  return typeof window !== "undefined";
}

/** Sets one preference, and puts the whole set back. */
export function putPreference<K extends keyof Settings>(
  key: K,
  value: NonNullable<Settings[K]>,
): Promise<void> {
  const change = queue.then(async () => {
    if (!current) await readPreferences();
    const next = withSetting(current ?? [], key, value);
    await call<typeof putPreferences.main>("social.grain.actor.putPreferences", {
      preferences: next,
    });
    current = next;
  });
  queue = change.catch(() => {});
  return change;
}

/** Forgets the set, as logging out does. */
export function forgetPreferences(): void {
  current = null;
}
