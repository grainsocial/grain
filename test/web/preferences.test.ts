import { afterEach, describe, expect, test, vi } from "vitest";
import {
  forgetPreferences,
  keepPreferences,
  putPreference,
  readPreferences,
  toSettings,
  withSetting,
} from "$lib/preferenceSync";
import type { GrainActorDefsPreferences } from "$lib/preferenceSync";

const feeds = [{ id: "recent", label: "Recent", type: "feed", path: "/feeds/recent" }];

const prefs: GrainActorDefsPreferences = [
  { $type: "social.grain.actor.defs#pinnedFeedsPref", items: feeds },
  { $type: "social.grain.actor.defs#photoMetadataPref", includeExif: false },
  { $type: "social.grain.actor.defs#themePref", theme: "dark" },
  {
    $type: "social.grain.actor.defs#notificationsPref",
    follows: { push: false, inApp: true, from: "follows" },
  },
];

afterEach(() => {
  vi.unstubAllGlobals();
  forgetPreferences();
});

describe("toSettings", () => {
  test("reads each kind of preference", () => {
    expect(toSettings(prefs)).toEqual({
      pinnedFeeds: feeds,
      includeExif: false,
      theme: "dark",
      notificationPrefs: { follows: { push: false, inApp: true, from: "follows" } },
    });
  });

  test("reads none as none", () => {
    expect(toSettings([])).toEqual({});
    expect(toSettings(null)).toEqual({});
  });
});

describe("withSetting", () => {
  test("replaces the one item, in its place", () => {
    const next = withSetting(prefs, "theme", "light");
    expect(next[2]).toEqual({ $type: "social.grain.actor.defs#themePref", theme: "light" });
    expect(next.filter((p, i) => p !== prefs[i])).toHaveLength(1);
  });

  test("keeps the other half of the photo metadata", () => {
    const next = withSetting(prefs, "includeLocation", false);
    expect(next[1]).toEqual({
      $type: "social.grain.actor.defs#photoMetadataPref",
      includeExif: false,
      includeLocation: false,
    });
  });

  test("adds an item not set before", () => {
    const next = withSetting([], "includeExif", true);
    expect(next).toEqual([
      { $type: "social.grain.actor.defs#photoMetadataPref", includeExif: true },
    ]);
  });
});

describe("putPreference", () => {
  test("puts the whole set, two changes at once both landing", async () => {
    const put: GrainActorDefsPreferences[] = [];
    vi.stubGlobal("window", {});
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      expect(url).toBe("/xrpc/social.grain.actor.putPreferences");
      put.push(JSON.parse(init.body as string).preferences);
      return new Response("{}", { status: 200 });
    });
    keepPreferences(prefs);
    await Promise.all([putPreference("theme", "light"), putPreference("includeLocation", true)]);
    expect(put).toHaveLength(2);
    expect(toSettings(put[1])).toMatchObject({
      theme: "light",
      includeLocation: true,
      includeExif: false,
    });
  });

  test("reads the set first when it has none", async () => {
    const urls: string[] = [];
    vi.stubGlobal("window", {});
    vi.stubGlobal("fetch", async (url: string) => {
      urls.push(url);
      const out = url.includes("getPreferences") ? { preferences: prefs } : {};
      return new Response(JSON.stringify(out), { status: 200 });
    });
    await putPreference("theme", "system");
    expect(urls).toEqual([
      "/xrpc/social.grain.actor.getPreferences",
      "/xrpc/social.grain.actor.putPreferences",
    ]);
  });

  test("a change that fails throws, and the next goes on", async () => {
    let fail = true;
    vi.stubGlobal("window", {});
    vi.stubGlobal("fetch", async () => {
      const status = fail ? 500 : 200;
      fail = false;
      return new Response("{}", { status });
    });
    keepPreferences(prefs);
    await expect(putPreference("theme", "light")).rejects.toThrow(/failed: 500/);
    await expect(putPreference("theme", "light")).resolves.toBeUndefined();
  });

  test("on the server, a set read is not kept for the next request", async () => {
    vi.stubGlobal("window", undefined);
    const read = async () => new Response(JSON.stringify({ preferences: prefs }), { status: 200 });
    await readPreferences(read as typeof fetch);
    keepPreferences(prefs);
    const urls: string[] = [];
    vi.stubGlobal("window", {});
    vi.stubGlobal("fetch", async (url: string) => {
      urls.push(url);
      const out = url.includes("getPreferences") ? { preferences: [] } : {};
      return new Response(JSON.stringify(out), { status: 200 });
    });
    await putPreference("theme", "dark");
    expect(urls[0]).toBe("/xrpc/social.grain.actor.getPreferences");
  });
});
