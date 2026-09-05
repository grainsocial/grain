// Viewed state for stories.
//
// The appview keeps what each account has watched, so a story watched here is
// grey on the phone and the other way round. This module is the client side of
// that: it reports what was watched and keeps the query cache honest in the
// meantime, so a ring greys out the moment the story is seen rather than after
// the next refetch.

import { callXrpc, type StoryAuthor, type StoryView } from "$hatk/client";
import type { QueryClient } from "@tanstack/svelte-query";
import { get } from "svelte/store";
import { viewer as viewerStore } from "$lib/stores";

/** Grey ring: every live story of this author has been watched. */
export function isCaughtUp(
  author: Pick<StoryAuthor, "unviewedCount" | "lastViewedAt" | "latestAt">,
) {
  if (typeof author.unviewedCount === "number") return author.unviewedCount === 0;
  if (!author.lastViewedAt) return false;
  return new Date(author.lastViewedAt).getTime() >= new Date(author.latestAt).getTime();
}

/** Where to open an author: their first unwatched story, or the start once caught up. */
export function firstUnviewedIndex(stories: Pick<StoryView, "viewer">[]) {
  const i = stories.findIndex((s) => !s.viewer?.viewed);
  return i < 0 ? 0 : i;
}

// Marked this session, per account. The server ignores repeats, but there is
// no point in sending them, and the cache patch below must not double-count.
const marked = new Set<string>();

export async function markStoriesViewed(stories: StoryView[], queryClient: QueryClient) {
  const viewerDid = get(viewerStore)?.did;
  if (!viewerDid) return;
  const key = (uri: string) => `${viewerDid} ${uri}`;
  const fresh = stories.filter((s) => !marked.has(key(s.uri)) && !s.viewer?.viewed);
  if (fresh.length === 0) return;
  for (const s of fresh) marked.add(key(s.uri));

  // Patch the caches first so the UI does not wait on the round trip.
  const byAuthor = new Map<string, StoryView[]>();
  for (const s of fresh) {
    const list = byAuthor.get(s.creator.did) ?? [];
    list.push(s);
    byAuthor.set(s.creator.did, list);
  }
  for (const [did, list] of byAuthor) {
    const uris = new Set(list.map((s) => s.uri));
    queryClient.setQueryData<StoryView[]>(["stories", did], (old) =>
      old?.map((s) => (uris.has(s.uri) ? { ...s, viewer: { ...s.viewer, viewed: true } } : s)),
    );
    const newest = list
      .map((s) => s.createdAt)
      .sort()
      .at(-1)!;
    queryClient.setQueryData<StoryAuthor[]>(["storyAuthors"], (old) =>
      old?.map((a) => {
        if (a.profile.did !== did) return a;
        const lastViewedAt = !a.lastViewedAt || a.lastViewedAt < newest ? newest : a.lastViewedAt;
        const unviewedCount =
          typeof a.unviewedCount === "number"
            ? Math.max(0, a.unviewedCount - list.length)
            : a.unviewedCount;
        return { ...a, lastViewedAt, unviewedCount };
      }),
    );
  }

  try {
    await callXrpc("social.grain.unspecced.markStoriesViewed", {
      stories: fresh.map((s) => s.uri),
    });
  } catch {
    // Let the next attempt retry; the next refetch reconciles the cache either way.
    for (const s of fresh) marked.delete(key(s.uri));
  }
}
