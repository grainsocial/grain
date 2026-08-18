import { infiniteQueryOptions, queryOptions } from "@tanstack/svelte-query";
import { callXrpc } from "$hatk/client";

type Fetch = typeof globalThis.fetch;

// ─── Feeds ──────────────────────────────────────────────────────────

/**
 * Rows per feed page. Keep this as the default for every feed query — the
 * feed query keys deliberately omit `limit`, so an SSR prefetch and the
 * component's own `createQuery` share one cache entry. If they disagree on
 * limit, the larger value silently wins on the first refetch after staleTime.
 *
 * Galleries hydrate with all of their photos, so each row is expensive: a
 * photo-dense feed (e.g. /camera/Ricoh GR II) ran ~900KB at 50.
 */
export const FEED_PAGE_SIZE = 30;

export const recentFeedQuery = (limit = FEED_PAGE_SIZE, f?: Fetch) =>
  queryOptions({
    queryKey: ["getFeed", "recent"],
    queryFn: () => callXrpc("dev.hatk.getFeed", { feed: "recent", limit }, f),
    staleTime: 60_000,
  });

export const followingFeedQuery = (did: string, limit = FEED_PAGE_SIZE, f?: Fetch) =>
  queryOptions({
    queryKey: ["getFeed", "following", did],
    queryFn: () => callXrpc("dev.hatk.getFeed", { feed: "following", actor: did, limit }, f),
    staleTime: 60_000,
  });

export const forYouFeedQuery = (did: string, limit = FEED_PAGE_SIZE, f?: Fetch) =>
  queryOptions({
    queryKey: ["getFeed", "foryou", did],
    queryFn: () => callXrpc("dev.hatk.getFeed", { feed: "foryou", actor: did, limit }, f),
    staleTime: 60_000,
  });

export const actorFeedQuery = (did: string, f?: Fetch) =>
  infiniteQueryOptions({
    queryKey: ["getFeed", "actor", did],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      callXrpc(
        "dev.hatk.getFeed",
        { feed: "actor", actor: did, limit: 30, ...(pageParam ? { cursor: pageParam } : {}) },
        f,
      ),
    getNextPageParam: (lastPage) => lastPage?.cursor,
    staleTime: 60_000,
  });

export const cameraFeedQuery = (camera: string, limit = FEED_PAGE_SIZE, f?: Fetch) =>
  queryOptions({
    queryKey: ["getFeed", "camera", camera],
    queryFn: () => callXrpc("dev.hatk.getFeed", { feed: "camera", camera, limit }, f),
    staleTime: 60_000,
  });

export const camerasQuery = (f?: Fetch) =>
  queryOptions({
    queryKey: ["cameras"],
    queryFn: () =>
      callXrpc("social.grain.unspecced.getCameras", undefined, f).then((r) => r?.cameras ?? []),
    staleTime: 5 * 60_000,
  });

export const locationFeedQuery = (
  location: string,
  name?: string,
  limit = FEED_PAGE_SIZE,
  f?: Fetch,
) =>
  queryOptions({
    queryKey: ["getFeed", "location", name || location],
    queryFn: () =>
      callXrpc(
        "dev.hatk.getFeed",
        { feed: "location", location, ...(name ? { name } : {}), limit },
        f,
      ),
    staleTime: 60_000,
  });

export const locationsQuery = (f?: Fetch) =>
  queryOptions({
    queryKey: ["locations"],
    queryFn: () =>
      callXrpc("social.grain.unspecced.getLocations", undefined, f).then((r) => r?.locations ?? []),
    staleTime: 5 * 60_000,
  });

// ─── Favorites ──────────────────────────────────────────────────────

export const actorFavoritesInfiniteQuery = (did: string, f?: Fetch) =>
  infiniteQueryOptions({
    queryKey: ["actorFavorites", did],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      callXrpc(
        "social.grain.unspecced.getActorFavorites",
        { actor: did, limit: 30, ...(pageParam ? { cursor: pageParam } : {}) },
        f,
      ),
    getNextPageParam: (lastPage) => lastPage?.cursor,
    staleTime: 60_000,
  });

// ─── Stories ────────────────────────────────────────────────────────

export const storyAuthorsQuery = (f?: Fetch) =>
  queryOptions({
    queryKey: ["storyAuthors"],
    queryFn: () =>
      callXrpc("social.grain.unspecced.getStoryAuthors", undefined, f).then(
        (r) => r?.authors ?? [],
      ),
    staleTime: 60_000,
  });

export const storyQuery = (storyUri: string, f?: Fetch) =>
  queryOptions({
    queryKey: ["getStory", storyUri],
    queryFn: () =>
      callXrpc("social.grain.unspecced.getStory", { story: storyUri }, f).then(
        (r) => r?.story ?? null,
      ),
    staleTime: 60_000,
  });

export const storiesQuery = (did: string, f?: Fetch) =>
  queryOptions({
    queryKey: ["stories", did],
    queryFn: () =>
      callXrpc("social.grain.unspecced.getStories", { actor: did }, f).then(
        (r) => r?.stories ?? [],
      ),
    staleTime: 30_000,
  });

export const storyArchiveQuery = (did: string, f?: Fetch) =>
  infiniteQueryOptions({
    queryKey: ["stories", "archive", did],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      callXrpc(
        "social.grain.unspecced.getStoryArchive",
        { actor: did, limit: 30, ...(pageParam ? { cursor: pageParam } : {}) },
        f,
      ).then((r) => r ?? { stories: [], cursor: undefined }),
    getNextPageParam: (lastPage) => lastPage?.cursor,
    staleTime: 60_000,
  });

// ─── Preferences ────────────────────────────────────────────────────

export const preferencesQuery = (f?: Fetch) =>
  queryOptions({
    queryKey: ["preferences"],
    queryFn: () =>
      callXrpc("dev.hatk.getPreferences", undefined, f).then(
        (r: any) => (r?.preferences ?? {}) as Record<string, unknown>,
      ),
    staleTime: 60_000,
  });

// ─── Profile ────────────────────────────────────────────────────────

export const actorProfileQuery = (did: string, viewer?: string, f?: Fetch) =>
  queryOptions({
    queryKey: ["actorProfile", did],
    queryFn: () =>
      callXrpc(
        "social.grain.unspecced.getActorProfile",
        { actor: did, ...(viewer ? { viewer } : {}) },
        f,
      ),
    staleTime: 60_000,
  });

// ─── Followers / Following ───────────────────────────────────────────

export const followersQuery = (did: string, f?: Fetch) =>
  queryOptions({
    queryKey: ["followers", did],
    queryFn: () => callXrpc("social.grain.unspecced.getFollowers", { actor: did }, f),
    staleTime: 60_000,
  });

export const followingQuery = (did: string, f?: Fetch) =>
  queryOptions({
    queryKey: ["following", did],
    queryFn: () => callXrpc("social.grain.unspecced.getFollowing", { actor: did }, f),
    staleTime: 60_000,
  });

// ─── Blocks / Mutes ─────────────────────────────────────────────────

export const blocksQuery = (f?: Fetch) =>
  queryOptions({
    queryKey: ["blocks"],
    queryFn: () => callXrpc("social.grain.unspecced.getBlocks", {}, f),
    staleTime: 60_000,
  });

export const mutesQuery = (f?: Fetch) =>
  queryOptions({
    queryKey: ["mutes"],
    queryFn: () => callXrpc("social.grain.unspecced.getMutes", {}, f),
    staleTime: 60_000,
  });

/**
 * Whether the viewer's PDS serves permissioned spaces. A property of their
 * server, so it only changes when that server is redeployed — the server-side
 * probe caches for an hour and this sits in front of it.
 */
export const spaceSupportQuery = (f?: Fetch) =>
  queryOptions({
    queryKey: ["spaceSupport"],
    queryFn: () => callXrpc("social.grain.unspecced.getSpaceSupport", {}, f),
    staleTime: 5 * 60_000,
  });

/**
 * A gallery living in a permissioned space. Assembled from member repos on
 * every request rather than read from the index — there is no index for it —
 * so this is deliberately not prefetched or held stale.
 */
export const privateGalleryQuery = (space: string, f?: Fetch) =>
  queryOptions({
    queryKey: ["privateGallery", space],
    queryFn: () => callXrpc("social.grain.unspecced.getPrivateGallery", { space }, f),
    staleTime: 30_000,
    retry: false,
  });

export const knownFollowersQuery = (did: string, viewer: string, f?: Fetch) =>
  queryOptions({
    queryKey: ["knownFollowers", did, viewer],
    queryFn: () => callXrpc("social.grain.unspecced.getKnownFollowers", { actor: did, viewer }, f),
    staleTime: 60_000,
  });

// ─── Search ─────────────────────────────────────────────────────────

export const searchGalleriesQuery = (q: string) =>
  queryOptions({
    queryKey: ["search", "galleries", q],
    queryFn: () => callXrpc("social.grain.unspecced.searchGalleries", { q, limit: 30 }),
    enabled: !!q,
    staleTime: 60_000,
  });

export const searchProfilesQuery = (q: string) =>
  queryOptions({
    queryKey: ["search", "people", q],
    queryFn: () => callXrpc("social.grain.unspecced.searchProfiles", { q, limit: 30 }),
    enabled: !!q,
    staleTime: 60_000,
  });

// ─── Gallery ────────────────────────────────────────────────────────

export const galleryQuery = (galleryUri: string, f?: Fetch) =>
  queryOptions({
    queryKey: ["getGallery", galleryUri],
    queryFn: () =>
      callXrpc("social.grain.unspecced.getGallery", { gallery: galleryUri }, f).then(
        (r) => r.gallery,
      ),
    staleTime: 60_000,
  });

export const galleryFavoritesQuery = (galleryUri: string, viewer?: string, f?: Fetch) =>
  queryOptions({
    queryKey: ["galleryFavorites", galleryUri],
    queryFn: () =>
      callXrpc(
        "social.grain.unspecced.getGalleryFavorites",
        { gallery: galleryUri, ...(viewer ? { viewer } : {}) },
        f,
      ),
    staleTime: 60_000,
  });

// ─── Gallery Thread (Comments) ──────────────────────────────────────

export const commentThreadQuery = (subjectUri: string, f?: Fetch) =>
  queryOptions({
    queryKey: ["getCommentThread", subjectUri],
    queryFn: () => callXrpc("social.grain.unspecced.getCommentThread", { subject: subjectUri }, f),
    staleTime: 30_000,
  });

// ─── Notifications ─────────────────────────────────────────────────

export const notificationsQuery = (viewer: string, f?: Fetch) =>
  queryOptions({
    queryKey: ["notifications", viewer],
    queryFn: () => callXrpc("social.grain.unspecced.getNotifications", { limit: 100 }, f),
    staleTime: 60_000,
  });

export const unseenNotificationCountQuery = (viewer: string, f?: Fetch) =>
  queryOptions({
    queryKey: ["unseenNotificationCount", viewer],
    queryFn: () =>
      callXrpc("social.grain.unspecced.getNotifications", { countOnly: true }, f).then(
        (r: any) => (r?.unseenCount ?? 0) as number,
      ),
    staleTime: 60_000,
  });
