// The web side of viewed stories: which ring is grey, where the viewer opens,
// and how reporting a view patches the query cache before the server answers.

import { beforeEach, describe, expect, test, vi } from "vitest";
import { QueryClient } from "@tanstack/svelte-query";

const calls: { nsid: string; input: unknown }[] = [];
let fail = false;

// Mocked by resolved path: the $hatk and $lib aliases resolve before vi.mock matches.
vi.mock("../hatk.generated.client.ts", () => ({
  callXrpc: async (nsid: string, input: unknown) => {
    calls.push({ nsid, input });
    if (fail) throw new Error("offline");
    return {};
  },
}));

vi.mock("../app/lib/stores.ts", async () => {
  const { writable } = await import("svelte/store");
  return { viewer: writable<{ did: string } | null>({ did: "did:plc:me" }) };
});

const { isCaughtUp, firstUnviewedIndex, markStoriesViewed } = await import("../app/lib/stories.ts");
const { viewer } = await import("../app/lib/stores.ts");

const ALICE = "did:plc:alice";
const story = (id: string, createdAt: string, viewed?: boolean) =>
  ({
    uri: `at://${ALICE}/social.grain.story/${id}`,
    cid: `cid-${id}`,
    creator: { cid: "", did: ALICE, handle: "alice.test" },
    thumb: "",
    fullsize: "",
    aspectRatio: { width: 9, height: 16 },
    createdAt,
    ...(viewed ? { viewer: { viewed: true } } : {}),
  }) as any;

const author = (extra: Record<string, unknown> = {}) =>
  ({
    profile: { cid: "", did: ALICE, handle: "alice.test" },
    storyCount: 3,
    latestAt: "2026-09-04T12:00:00.000Z",
    ...extra,
  }) as any;

describe("isCaughtUp", () => {
  test("trusts the server's count when it is there", () => {
    expect(isCaughtUp(author({ unviewedCount: 0 }))).toBe(true);
    expect(isCaughtUp(author({ unviewedCount: 1 }))).toBe(false);
  });

  test("falls back to comparing the high-water mark with the newest story", () => {
    expect(isCaughtUp(author())).toBe(false);
    expect(isCaughtUp(author({ lastViewedAt: "2026-09-04T11:00:00.000Z" }))).toBe(false);
    expect(isCaughtUp(author({ lastViewedAt: "2026-09-04T12:00:00.000Z" }))).toBe(true);
  });
});

describe("firstUnviewedIndex", () => {
  test("opens on the first story not yet watched, or the start once caught up", () => {
    const s = [story("a", "t1", true), story("b", "t2"), story("c", "t3")];
    expect(firstUnviewedIndex(s)).toBe(1);
    expect(firstUnviewedIndex(s.map((x) => ({ ...x, viewer: { viewed: true } })))).toBe(0);
    expect(firstUnviewedIndex([])).toBe(0);
  });
});

describe("markStoriesViewed", () => {
  let qc: QueryClient;
  const a1 = story("a1", "2026-09-04T12:00:00.000Z");
  const a2 = story("a2", "2026-09-04T10:00:00.000Z");
  const a3 = story("a3", "2026-09-04T08:00:00.000Z");

  beforeEach(() => {
    calls.length = 0;
    fail = false;
    viewer.set({ did: `did:plc:me-${Math.random()}` });
    qc = new QueryClient();
    qc.setQueryData(["stories", ALICE], [a3, a2, a1]);
    qc.setQueryData(["storyAuthors"], [author({ unviewedCount: 3 })]);
  });

  test("posts the URIs and patches the story and author caches at once", async () => {
    await markStoriesViewed([a3], qc);

    expect(calls).toEqual([
      {
        nsid: "social.grain.unspecced.markStoriesViewed",
        input: { stories: [a3.uri] },
      },
    ]);
    const stories = qc.getQueryData<any[]>(["stories", ALICE])!;
    expect(stories.map((s) => !!s.viewer?.viewed)).toEqual([true, false, false]);
    const [alice] = qc.getQueryData<any[]>(["storyAuthors"])!;
    expect(alice.unviewedCount).toBe(2);
    expect(alice.lastViewedAt).toBe(a3.createdAt);
  });

  test("the high-water mark only moves forward", async () => {
    await markStoriesViewed([a1], qc);
    await markStoriesViewed([a2], qc);
    const [alice] = qc.getQueryData<any[]>(["storyAuthors"])!;
    expect(alice.lastViewedAt).toBe(a1.createdAt);
    expect(alice.unviewedCount).toBe(1);
  });

  test("does not report a story twice, nor one the server already marked", async () => {
    await markStoriesViewed([a3], qc);
    await markStoriesViewed([a3, story("a4", "t", true)], qc);
    expect(calls).toHaveLength(1);
  });

  test("a failed report is retried next time", async () => {
    fail = true;
    await markStoriesViewed([a3], qc);
    fail = false;
    await markStoriesViewed([a3], qc);
    expect(calls).toHaveLength(2);
  });

  test("does nothing when signed out", async () => {
    viewer.set(null);
    await markStoriesViewed([a3], qc);
    expect(calls).toHaveLength(0);
    const stories = qc.getQueryData<any[]>(["stories", ALICE])!;
    expect(stories.some((s) => s.viewer?.viewed)).toBe(false);
  });
});
