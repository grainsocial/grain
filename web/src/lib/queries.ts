import { infiniteQueryOptions, queryOptions } from "@tanstack/svelte-query";
import type { AtIdentifierString, AtUriString, DidString } from "@atproto/lex";
import { query } from "$lib/xrpc";
import type * as listNotifications from "$lib/lexicons/social/grain/notification/listNotifications.ts";
import type * as getUnreadCount from "$lib/lexicons/social/grain/notification/getUnreadCount.ts";
import { getFeed } from "$lib/feed";
import { readPreferences } from "$lib/preferenceSync";
import type * as actorGetFavorites from "$lib/lexicons/social/grain/actor/getFavorites.ts";
import type * as actorGetProfile from "$lib/lexicons/social/grain/actor/getProfile.ts";
import type * as actorSearchActors from "$lib/lexicons/social/grain/actor/searchActors.ts";
import type * as commentGetThread from "$lib/lexicons/social/grain/comment/getThread.ts";
import type * as galleryGetCameras from "$lib/lexicons/social/grain/gallery/getCameras.ts";
import type * as galleryGetFavorites from "$lib/lexicons/social/grain/gallery/getFavorites.ts";
import type * as galleryGetGallery from "$lib/lexicons/social/grain/gallery/getGallery.ts";
import type * as galleryGetLocations from "$lib/lexicons/social/grain/gallery/getLocations.ts";
import type * as gallerySearchGalleries from "$lib/lexicons/social/grain/gallery/searchGalleries.ts";
import type * as graphGetBlocks from "$lib/lexicons/social/grain/graph/getBlocks.ts";
import type * as graphGetFollowers from "$lib/lexicons/social/grain/graph/getFollowers.ts";
import type * as graphGetFollowing from "$lib/lexicons/social/grain/graph/getFollowing.ts";
import type * as graphGetKnownFollowers from "$lib/lexicons/social/grain/graph/getKnownFollowers.ts";
import type * as graphGetMutes from "$lib/lexicons/social/grain/graph/getMutes.ts";
import type * as storyGetArchive from "$lib/lexicons/social/grain/story/getArchive.ts";
import type * as storyGetAuthors from "$lib/lexicons/social/grain/story/getAuthors.ts";
import type * as storyGetStories from "$lib/lexicons/social/grain/story/getStories.ts";
import type * as storyGetStory from "$lib/lexicons/social/grain/story/getStory.ts";
import type * as groupGetGroup from "$lib/lexicons/social/grain/group/getGroup.ts";
import type * as groupGetGroupHost from "$lib/lexicons/social/grain/group/getGroupHost.ts";
import type * as groupGetSubmissions from "$lib/lexicons/social/grain/group/getSubmissions.ts";
import type * as groupListGroups from "$lib/lexicons/social/grain/group/listGroups.ts";
import type * as groupGetGallery from "$lib/lexicons/social/grain/group/getGallery.ts";
import type * as groupListFeed from "$lib/lexicons/social/grain/group/listFeed.ts";
import type * as groupListGalleries from "$lib/lexicons/social/grain/group/listGalleries.ts";
import type * as serverGetSpaceSupport from "$lib/lexicons/social/grain/server/getSpaceSupport.ts";

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
    queryFn: () => getFeed("recent", { limit }, f),
    staleTime: 60_000,
  });

export const followingFeedQuery = (did: string, limit = FEED_PAGE_SIZE, f?: Fetch) =>
  queryOptions({
    queryKey: ["getFeed", "following", did],
    queryFn: () => getFeed("following", { limit }, f),
    staleTime: 60_000,
  });

export const forYouFeedQuery = (did: string, limit = FEED_PAGE_SIZE, f?: Fetch) =>
  queryOptions({
    queryKey: ["getFeed", "foryou", did],
    queryFn: () => getFeed("foryou", { limit }, f),
    staleTime: 60_000,
  });

export const actorFeedQuery = (did: string, f?: Fetch) =>
  infiniteQueryOptions({
    queryKey: ["getFeed", "actor", did],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      getFeed(
        "actor",
        { actor: did as DidString, limit: 30, ...(pageParam ? { cursor: pageParam } : {}) },
        f,
      ),
    getNextPageParam: (lastPage) => lastPage?.cursor,
    staleTime: 60_000,
  });

export const cameraFeedQuery = (camera: string, limit = FEED_PAGE_SIZE, f?: Fetch) =>
  queryOptions({
    queryKey: ["getFeed", "camera", camera],
    queryFn: () => getFeed("camera", { camera, limit }, f),
    staleTime: 60_000,
  });

/** Paged variant for the camera page's grid, mirroring the location feed. */
export const cameraFeedInfiniteQuery = (camera: string, f?: Fetch) =>
  infiniteQueryOptions({
    queryKey: ["getFeed", "camera", "infinite", camera],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      getFeed(
        "camera",
        { camera, limit: FEED_PAGE_SIZE, ...(pageParam ? { cursor: pageParam } : {}) },
        f,
      ),
    getNextPageParam: (lastPage) => lastPage?.cursor,
    staleTime: 60_000,
  });

/** Paged variant for the hashtag page's grid, mirroring the camera feed. */
export const hashtagFeedInfiniteQuery = (tag: string, f?: Fetch) =>
  infiniteQueryOptions({
    queryKey: ["getFeed", "hashtag", "infinite", tag],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      getFeed(
        "hashtag",
        { tag, limit: FEED_PAGE_SIZE, ...(pageParam ? { cursor: pageParam } : {}) },
        f,
      ),
    getNextPageParam: (lastPage) => lastPage?.cursor,
    staleTime: 60_000,
  });

export const camerasQuery = (f?: Fetch) =>
  queryOptions({
    queryKey: ["cameras"],
    queryFn: () =>
      query<typeof galleryGetCameras.main>("social.grain.gallery.getCameras", {}, f).then(
        (r) => r?.cameras ?? [],
      ),
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
    queryFn: () => getFeed("location", { location, ...(name ? { name } : {}), limit }, f),
    staleTime: 60_000,
  });

/**
 * Paged variant for the location page's grid. The plain query above still backs
 * the card feed and the SSR prefetch.
 */
export const locationFeedInfiniteQuery = (location: string, name?: string, f?: Fetch) =>
  infiniteQueryOptions({
    queryKey: ["getFeed", "location", "infinite", name || location],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      getFeed(
        "location",
        {
          location,
          ...(name ? { name } : {}),
          limit: FEED_PAGE_SIZE,
          ...(pageParam ? { cursor: pageParam } : {}),
        },
        f,
      ),
    getNextPageParam: (lastPage) => lastPage?.cursor,
    staleTime: 60_000,
  });

export const locationsQuery = (f?: Fetch) =>
  queryOptions({
    queryKey: ["locations"],
    queryFn: () =>
      query<typeof galleryGetLocations.main>("social.grain.gallery.getLocations", {}, f).then(
        (r) => r?.locations ?? [],
      ),
    staleTime: 5 * 60_000,
  });

// Every place, carrying only what the index map plots. Separate from
// locationsQuery because the shapes are wanted in different sizes: tiles need
// thumbnails for thirty places, the map needs coordinates for all seven
// hundred, and serving the rich shape for all of them is ~780KB.
export const locationPinsQuery = (f?: Fetch) =>
  queryOptions({
    queryKey: ["locationPins"],
    queryFn: () =>
      query<typeof galleryGetLocations.main>(
        "social.grain.gallery.getLocations",
        { pins: true },
        f,
      ).then((r) => r?.locations ?? []),
    staleTime: 5 * 60_000,
  });

// ─── Favorites ──────────────────────────────────────────────────────

export const actorFavoritesInfiniteQuery = (did: string, f?: Fetch) =>
  infiniteQueryOptions({
    queryKey: ["actorFavorites", did],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      query<typeof actorGetFavorites.main>(
        "social.grain.actor.getFavorites",
        {
          actor: did as AtIdentifierString,
          limit: 30,
          ...(pageParam ? { cursor: pageParam } : {}),
        },
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
      query<typeof storyGetAuthors.main>("social.grain.story.getAuthors", {}, f).then(
        (r) => r?.authors ?? [],
      ),
    staleTime: 60_000,
  });

export const storyQuery = (storyUri: string, f?: Fetch) =>
  queryOptions({
    queryKey: ["getStory", storyUri],
    queryFn: () =>
      query<typeof storyGetStory.main>(
        "social.grain.story.getStory",
        { story: storyUri as AtUriString },
        f,
      ).then((r) => r?.story ?? null),
    staleTime: 60_000,
  });

export const storiesQuery = (did: string, f?: Fetch) =>
  queryOptions({
    queryKey: ["stories", did],
    queryFn: () =>
      query<typeof storyGetStories.main>(
        "social.grain.story.getStories",
        { actor: did as AtIdentifierString },
        f,
      ).then((r) => r?.stories ?? []),
    staleTime: 30_000,
  });

export const storyArchiveQuery = (did: string, f?: Fetch) =>
  infiniteQueryOptions({
    queryKey: ["stories", "archive", did],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      query<typeof storyGetArchive.main>(
        "social.grain.story.getArchive",
        {
          actor: did as AtIdentifierString,
          limit: 30,
          ...(pageParam ? { cursor: pageParam } : {}),
        },
        f,
      ).then((r) => r ?? { stories: [], cursor: undefined }),
    getNextPageParam: (lastPage) => lastPage?.cursor,
    staleTime: 60_000,
  });

// ─── Preferences ────────────────────────────────────────────────────

export const preferencesQuery = (f?: Fetch) =>
  queryOptions({
    queryKey: ["preferences"],
    queryFn: () => readPreferences(f),
    staleTime: 60_000,
  });

// ─── Profile ────────────────────────────────────────────────────────

// The viewer each of these is asked for is the one the cookie names; `_viewer`
// stays in their signatures for the callers that key by it.

export const actorProfileQuery = (did: string, _viewer?: string, f?: Fetch) =>
  queryOptions({
    queryKey: ["actorProfile", did],
    queryFn: () =>
      query<typeof actorGetProfile.main>(
        "social.grain.actor.getProfile",
        { actor: did as AtIdentifierString },
        f,
      ),
    staleTime: 60_000,
  });

// ─── Followers / Following ───────────────────────────────────────────

export const followersQuery = (did: string, f?: Fetch) =>
  queryOptions({
    queryKey: ["followers", did],
    queryFn: () =>
      query<typeof graphGetFollowers.main>(
        "social.grain.graph.getFollowers",
        { actor: did as AtIdentifierString },
        f,
      ),
    staleTime: 60_000,
  });

export const followingQuery = (did: string, f?: Fetch) =>
  queryOptions({
    queryKey: ["following", did],
    queryFn: () =>
      query<typeof graphGetFollowing.main>(
        "social.grain.graph.getFollowing",
        { actor: did as AtIdentifierString },
        f,
      ),
    staleTime: 60_000,
  });

// ─── Blocks / Mutes ─────────────────────────────────────────────────

export const blocksQuery = (f?: Fetch) =>
  queryOptions({
    queryKey: ["blocks"],
    queryFn: () => query<typeof graphGetBlocks.main>("social.grain.graph.getBlocks", {}, f),
    staleTime: 60_000,
  });

export const mutesQuery = (f?: Fetch) =>
  queryOptions({
    queryKey: ["mutes"],
    queryFn: () => query<typeof graphGetMutes.main>("social.grain.graph.getMutes", {}, f),
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
    queryFn: () =>
      query<typeof serverGetSpaceSupport.main>("social.grain.server.getSpaceSupport", {}, f),
    staleTime: 5 * 60_000,
  });

/**
 * A group's pool: every member's galleries, read from their repos through
 * the group's space on every call. No index stands behind it — nothing in a
 * space reaches a firehose — and a viewer who is not a member gets an error
 * rather than an empty pool, so this never retries into a refusal.
 */
export const poolGalleriesQuery = (group: string, f?: Fetch) =>
  queryOptions({
    queryKey: ["poolGalleries", group],
    queryFn: () =>
      query<typeof groupListGalleries.main>(
        "social.grain.group.listGalleries",
        { group: group as DidString },
        f,
      ),
    staleTime: 30_000,
    retry: false,
  });

/**
 * Every pool the viewer is in, as one feed. Per viewer, per request — there is
 * no index behind it and no cursor to page with, so it asks for a page's worth
 * and stops.
 */
export const poolFeedQuery = (f?: Fetch) =>
  queryOptions({
    queryKey: ["poolFeed"],
    queryFn: () => query<typeof groupListFeed.main>("social.grain.group.listFeed", {}, f),
    staleTime: 30_000,
    retry: false,
  });

/** One gallery from a group's pool. */
export const poolGalleryQuery = (group: string, did: string, rkey: string, f?: Fetch) =>
  queryOptions({
    queryKey: ["poolGallery", group, did, rkey],
    queryFn: () =>
      query<typeof groupGetGallery.main>(
        "social.grain.group.getGallery",
        { group: group as DidString, did: did as DidString, rkey },
        f,
      ),
    staleTime: 30_000,
    retry: false,
  });

export const knownFollowersQuery = (did: string, viewer: string, f?: Fetch) =>
  queryOptions({
    queryKey: ["knownFollowers", did, viewer],
    queryFn: () =>
      query<typeof graphGetKnownFollowers.main>(
        "social.grain.graph.getKnownFollowers",
        { actor: did as AtIdentifierString },
        f,
      ),
    staleTime: 60_000,
  });

// ─── Search ─────────────────────────────────────────────────────────

export const searchGalleriesQuery = (q: string) =>
  queryOptions({
    queryKey: ["search", "galleries", q],
    queryFn: () =>
      query<typeof gallerySearchGalleries.main>("social.grain.gallery.searchGalleries", {
        q,
        limit: 30,
      }),
    enabled: !!q,
    staleTime: 60_000,
  });

export const searchProfilesQuery = (q: string) =>
  queryOptions({
    queryKey: ["search", "people", q],
    queryFn: () =>
      query<typeof actorSearchActors.main>("social.grain.actor.searchActors", { q, limit: 30 }),
    enabled: !!q,
    staleTime: 60_000,
  });

// ─── Gallery ────────────────────────────────────────────────────────

export const galleryQuery = (galleryUri: string, f?: Fetch) =>
  queryOptions({
    queryKey: ["getGallery", galleryUri],
    queryFn: () =>
      query<typeof galleryGetGallery.main>(
        "social.grain.gallery.getGallery",
        { gallery: galleryUri as AtUriString },
        f,
      ).then((r) => r.gallery),
    staleTime: 60_000,
  });

export const galleryFavoritesQuery = (galleryUri: string, _viewer?: string, f?: Fetch) =>
  queryOptions({
    queryKey: ["galleryFavorites", galleryUri],
    queryFn: () =>
      query<typeof galleryGetFavorites.main>(
        "social.grain.gallery.getFavorites",
        { gallery: galleryUri as AtUriString },
        f,
      ),
    staleTime: 60_000,
  });

// ─── Gallery Thread (Comments) ──────────────────────────────────────

export const commentThreadQuery = (subjectUri: string, f?: Fetch) =>
  queryOptions({
    queryKey: ["getCommentThread", subjectUri],
    queryFn: () =>
      query<typeof commentGetThread.main>(
        "social.grain.comment.getThread",
        { subject: subjectUri as AtUriString },
        f,
      ),
    staleTime: 30_000,
  });

// ─── Notifications ─────────────────────────────────────────────────

export const notificationsQuery = (viewer: string, f?: Fetch) =>
  queryOptions({
    queryKey: ["notifications", viewer],
    queryFn: () =>
      query<typeof listNotifications.main>(
        "social.grain.notification.listNotifications",
        { limit: 100 },
        f,
      ),
    staleTime: 60_000,
  });

export const unseenNotificationCountQuery = (viewer: string, f?: Fetch) =>
  queryOptions({
    queryKey: ["unseenNotificationCount", viewer],
    queryFn: () =>
      query<typeof getUnreadCount.main>("social.grain.notification.getUnreadCount", {}, f).then(
        (r) => r.count ?? 0,
      ),
    staleTime: 60_000,
  });

// ─── Groups ─────────────────────────────────────────────────────────

export const groupQuery = (actor: string, f?: Fetch) =>
  queryOptions({
    queryKey: ["group", actor],
    queryFn: () => query<typeof groupGetGroup.main>("social.grain.group.getGroup", { actor }, f),
    staleTime: 30_000,
  });

/** The group host this Grain starts groups on; empty when it starts none. */
export const groupHostQuery = (f?: Fetch) =>
  queryOptions({
    queryKey: ["groupHost"],
    queryFn: () => query<typeof groupGetGroupHost.main>("social.grain.group.getGroupHost", {}, f),
    staleTime: 60 * 60_000,
  });

/** Every group; with `gallery`, each carries the viewer's standing for it. */
export const groupsQuery = (gallery?: string, f?: Fetch) =>
  queryOptions({
    queryKey: ["groups", gallery ?? ""],
    queryFn: () =>
      query<typeof groupListGroups.main>(
        "social.grain.group.listGroups",
        gallery ? { gallery: gallery as AtUriString } : {},
        f,
      ).then((r) => r?.groups ?? []),
    staleTime: 30_000,
  });

export const groupFeedQuery = (did: string, f?: Fetch) =>
  infiniteQueryOptions({
    queryKey: ["getFeed", "group", did],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      getFeed(
        "group",
        { group: did as DidString, limit: 30, ...(pageParam ? { cursor: pageParam } : {}) },
        f,
      ),
    getNextPageParam: (lastPage) => lastPage?.cursor,
    staleTime: 60_000,
  });

export const groupsFeedQuery = (limit = FEED_PAGE_SIZE, f?: Fetch) =>
  queryOptions({
    queryKey: ["getFeed", "groups"],
    queryFn: () => getFeed("groups", { limit }, f),
    staleTime: 60_000,
  });

export const groupSubmissionsQuery = (group: string, f?: Fetch) =>
  queryOptions({
    queryKey: ["groupSubmissions", group],
    queryFn: () =>
      query<typeof groupGetSubmissions.main>(
        "social.grain.group.getSubmissions",
        { group: group as DidString },
        f,
      ).then((r) => r?.submissions ?? []),
    staleTime: 15_000,
  });
