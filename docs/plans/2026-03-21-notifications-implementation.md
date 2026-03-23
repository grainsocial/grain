# Notifications Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a notifications system with 6 notification types (favorite, comment, mention, reply, follow) and read/unread tracking via server-side timestamp.

**Architecture:** Notifications are computed by querying existing records (favorites, comments, follows) where the target is the viewer. No new database tables. Read/unread tracked via `lastSeenNotifications` timestamp in `_preferences`. New XRPC query endpoint serves paginated notifications. Bell icon with badge in sidebar + mobile bottom bar.

**Tech Stack:** SvelteKit 5, TanStack Query, hatk XRPC framework, SQLite, lucide-svelte icons

---

### Task 1: Create the Notification Lexicon

**Files:**

- Create: `lexicons/social/grain/unspecced/getNotifications.json`

**Step 1: Create the lexicon file**

```json
{
  "lexicon": 1,
  "id": "social.grain.unspecced.getNotifications",
  "defs": {
    "main": {
      "type": "query",
      "description": "Get notifications for the authenticated user.",
      "parameters": {
        "type": "params",
        "required": ["viewer"],
        "properties": {
          "viewer": {
            "type": "string",
            "format": "did",
            "description": "The DID of the viewer to fetch notifications for."
          },
          "limit": { "type": "integer", "minimum": 1, "maximum": 100, "default": 20 },
          "cursor": { "type": "string" }
        }
      },
      "output": {
        "encoding": "application/json",
        "schema": {
          "type": "object",
          "required": ["notifications"],
          "properties": {
            "notifications": {
              "type": "array",
              "items": { "type": "ref", "ref": "#notificationItem" }
            },
            "cursor": { "type": "string" },
            "unseenCount": { "type": "integer" }
          }
        }
      }
    },
    "notificationItem": {
      "type": "object",
      "required": ["uri", "reason", "createdAt", "author"],
      "properties": {
        "uri": { "type": "string", "format": "at-uri" },
        "reason": {
          "type": "string",
          "knownValues": [
            "gallery-favorite",
            "gallery-comment",
            "gallery-comment-mention",
            "gallery-mention",
            "reply",
            "follow"
          ]
        },
        "createdAt": { "type": "string", "format": "datetime" },
        "author": { "type": "ref", "ref": "social.grain.actor.defs#profileView" },
        "galleryUri": { "type": "string", "format": "at-uri" },
        "galleryTitle": { "type": "string" },
        "galleryThumb": { "type": "string" },
        "commentText": { "type": "string" },
        "replyToText": { "type": "string" }
      }
    }
  }
}
```

**Step 2: Regenerate types**

Run: `npx hatk generate`
Expected: `hatk.generated.ts` updated with new `GetNotifications` type and `NotificationItem` view type.

---

### Task 2: Create the XRPC Query Handler

**Files:**

- Create: `server/xrpc/getNotifications.ts`

**Step 1: Write the handler**

This handler computes notifications by querying favorites, comments, follows, and galleries where the viewer is the target. It unions all results, sorts by `created_at` desc, and paginates.

```typescript
import { defineQuery } from "$hatk";
import type { GrainActorProfile, Photo, Gallery } from "$hatk";
import { views } from "$hatk";

export default defineQuery("social.grain.unspecced.getNotifications", async (ctx) => {
  const { ok, params, db, lookup, blobUrl, getRecords } = ctx;
  const { viewer, limit = 20, cursor } = params;

  // Get lastSeenNotifications from preferences
  const prefRows = (await db.query(
    `SELECT value FROM _preferences WHERE did = $1 AND key = 'lastSeenNotifications'`,
    [viewer],
  )) as { value: string }[];
  const lastSeen = prefRows[0]?.value ?? null;

  // Build union query for all notification sources
  const cursorFilter = cursor ? `AND created_at < '${cursor}'` : "";

  // 1. Favorites on viewer's galleries
  // 2. Comments on viewer's galleries (not by viewer)
  // 3. Replies to viewer's comments (not by viewer)
  // 4. Follows of viewer
  // 5. Gallery mentions of viewer (checked in app code via facets)
  // 6. Comment mentions of viewer (checked in app code via facets)

  const unionQuery = `
    SELECT uri, did, created_at, 'favorite' as source, subject as gallery_uri, NULL as text, NULL as facets, NULL as reply_to, NULL as focus
    FROM "social.grain.favorite"
    WHERE subject IN (SELECT uri FROM "social.grain.gallery" WHERE did = $1)
      AND did != $1
      ${cursorFilter}

    UNION ALL

    SELECT uri, did, created_at, 'comment' as source, subject as gallery_uri, text, facets, reply_to, focus
    FROM "social.grain.comment"
    WHERE subject IN (SELECT uri FROM "social.grain.gallery" WHERE did = $1)
      AND did != $1
      AND reply_to IS NULL
      ${cursorFilter}

    UNION ALL

    SELECT c.uri, c.did, c.created_at, 'reply' as source, c.subject as gallery_uri, c.text, c.facets, c.reply_to, c.focus
    FROM "social.grain.comment" c
    WHERE c.reply_to IN (SELECT uri FROM "social.grain.comment" WHERE did = $1)
      AND c.did != $1
      ${cursorFilter}

    UNION ALL

    SELECT uri, did, created_at, 'follow' as source, NULL as gallery_uri, NULL as text, NULL as facets, NULL as reply_to, NULL as focus
    FROM "social.grain.graph.follow"
    WHERE subject = $1
      AND did != $1
      ${cursorFilter}

    UNION ALL

    SELECT uri, did, created_at, 'comment-mention' as source, subject as gallery_uri, text, facets, NULL as reply_to, focus
    FROM "social.grain.comment"
    WHERE facets LIKE '%' || $1 || '%'
      AND did != $1
      ${cursorFilter}

    UNION ALL

    SELECT uri, did, created_at, 'gallery-mention' as source, uri as gallery_uri, description as text, facets, NULL as reply_to, NULL as focus
    FROM "social.grain.gallery"
    WHERE facets LIKE '%' || $1 || '%'
      AND did != $1
      ${cursorFilter}

    ORDER BY created_at DESC
    LIMIT $2
  `;

  const rows = (await db.query(unionQuery, [viewer, limit + 1])) as Array<{
    uri: string;
    did: string;
    created_at: string;
    source: string;
    gallery_uri: string | null;
    text: string | null;
    facets: string | null;
    reply_to: string | null;
    focus: string | null;
  }>;

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1]?.created_at : undefined;

  // Determine notification reason
  function getReason(row: (typeof items)[0]): string {
    if (row.source === "favorite") return "gallery-favorite";
    if (row.source === "follow") return "follow";
    if (row.source === "comment-mention") return "gallery-comment-mention";
    if (row.source === "gallery-mention") return "gallery-mention";
    if (row.source === "reply") return "reply";
    // Regular comment — check for mention facets
    if (row.facets) {
      try {
        const facets = JSON.parse(row.facets);
        const hasMention =
          Array.isArray(facets) &&
          facets.some((f: any) =>
            f.features?.some(
              (feat: any) =>
                feat.$type === "app.bsky.richtext.facet#mention" && feat.did === viewer,
            ),
          );
        if (hasMention) return "gallery-comment-mention";
      } catch {}
    }
    return "gallery-comment";
  }

  // Hydrate author profiles
  const dids = [...new Set(items.map((r) => r.did))];
  const profiles = await lookup<GrainActorProfile>("social.grain.actor.profile", "did", dids);

  // Hydrate galleries for thumbnails
  const galleryUris = [...new Set(items.map((r) => r.gallery_uri).filter(Boolean))] as string[];
  const galleries =
    galleryUris.length > 0
      ? await getRecords<Gallery>("social.grain.gallery", galleryUris)
      : new Map();

  // Get first photo thumbnail for each gallery
  const galleryItemRows =
    galleryUris.length > 0
      ? ((await db.query(
          `SELECT gallery, item FROM "social.grain.gallery.item"
         WHERE gallery IN (${galleryUris.map((_, i) => `$${i + 1}`).join(",")})
         ORDER BY position ASC`,
          galleryUris,
        )) as Array<{ gallery: string; item: string }>)
      : [];

  const firstPhotoByGallery = new Map<string, string>();
  for (const row of galleryItemRows) {
    if (!firstPhotoByGallery.has(row.gallery)) {
      firstPhotoByGallery.set(row.gallery, row.item);
    }
  }

  const allPhotoUris = [...new Set(firstPhotoByGallery.values())];
  const photos =
    allPhotoUris.length > 0
      ? await getRecords<Photo>("social.grain.photo", allPhotoUris)
      : new Map();

  // Hydrate reply-to texts
  const replyToUris = items.map((r) => r.reply_to).filter(Boolean) as string[];
  const replyToComments =
    replyToUris.length > 0
      ? ((await db.query(
          `SELECT uri, text FROM "social.grain.comment"
         WHERE uri IN (${replyToUris.map((_, i) => `$${i + 1}`).join(",")})`,
          replyToUris,
        )) as Array<{ uri: string; text: string }>)
      : [];
  const replyToTextMap = new Map<string, string>();
  for (const row of replyToComments) replyToTextMap.set(row.uri, row.text);

  // Count unseen
  let unseenCount = 0;
  if (lastSeen) {
    const countRows = (await db.query(
      `SELECT count(*) as cnt FROM (
        SELECT created_at FROM "social.grain.favorite"
        WHERE subject IN (SELECT uri FROM "social.grain.gallery" WHERE did = $1)
          AND did != $1 AND created_at > $2
        UNION ALL
        SELECT created_at FROM "social.grain.comment"
        WHERE (subject IN (SELECT uri FROM "social.grain.gallery" WHERE did = $1)
          OR reply_to IN (SELECT uri FROM "social.grain.comment" WHERE did = $1)
          OR facets LIKE '%' || $1 || '%')
          AND did != $1 AND created_at > $2
        UNION ALL
        SELECT created_at FROM "social.grain.graph.follow"
        WHERE subject = $1 AND did != $1 AND created_at > $2
        UNION ALL
        SELECT created_at FROM "social.grain.gallery"
        WHERE facets LIKE '%' || $1 || '%' AND did != $1 AND created_at > $2
      )`,
      [viewer, lastSeen],
    )) as { cnt: number }[];
    unseenCount = countRows[0]?.cnt ?? 0;
  }

  const notifications = items.map((row) => {
    const author = profiles.get(row.did);
    const gallery = row.gallery_uri ? galleries.get(row.gallery_uri) : null;
    const photoUri = row.gallery_uri ? firstPhotoByGallery.get(row.gallery_uri) : null;
    const photo = photoUri ? photos.get(photoUri) : null;
    const thumb = photo
      ? (blobUrl(photo.did, photo.value.photo, "feed_thumbnail") ?? undefined)
      : undefined;

    return {
      uri: row.uri,
      reason: getReason(row),
      createdAt: row.created_at,
      author: author
        ? views.grainActorDefsProfileView({
            cid: author.cid,
            did: author.did,
            handle: author.handle ?? author.did,
            displayName: author.value.displayName,
            avatar: blobUrl(author.did, author.value.avatar) ?? undefined,
          })
        : views.grainActorDefsProfileView({
            cid: row.uri,
            did: row.did,
            handle: row.did,
          }),
      ...(gallery ? { galleryUri: row.gallery_uri!, galleryTitle: gallery.value.title } : {}),
      ...(thumb ? { galleryThumb: thumb } : {}),
      ...(row.text ? { commentText: row.text } : {}),
      ...(row.reply_to && replyToTextMap.has(row.reply_to)
        ? { replyToText: replyToTextMap.get(row.reply_to) }
        : {}),
    };
  });

  return ok({ notifications, ...(nextCursor ? { cursor: nextCursor } : {}), unseenCount });
});
```

**Step 2: Verify the server starts**

Run: `npm run dev` (check for TypeScript errors)
Expected: Server starts without errors. The new endpoint is registered automatically by hatk when it finds the file.

---

### Task 3: Add Query Helpers and Unseen Count Store

**Files:**

- Modify: `app/lib/queries.ts`
- Modify: `app/lib/preferences.ts`

**Step 1: Add notification queries to `queries.ts`**

Add at the end of the file, before the closing content:

```typescript
// ─── Notifications ─────────────────────────────────────────────────

export const notificationsQuery = (viewer: string, f?: Fetch) =>
  queryOptions({
    queryKey: ["notifications", viewer],
    queryFn: () => callXrpc("social.grain.unspecced.getNotifications", { viewer, limit: 20 }, f),
    staleTime: 60_000,
  });

export const unseenNotificationCountQuery = (viewer: string, f?: Fetch) =>
  queryOptions({
    queryKey: ["unseenNotificationCount", viewer],
    queryFn: () =>
      callXrpc("social.grain.unspecced.getNotifications", { viewer, limit: 1 }, f).then(
        (r: any) => (r?.unseenCount ?? 0) as number,
      ),
    staleTime: 60_000,
  });
```

**Step 2: Add mark-as-seen helper to `preferences.ts`**

Add at the end of the file:

```typescript
export async function markNotificationsSeen(): Promise<void> {
  await callXrpc("dev.hatk.putPreference", {
    key: "lastSeenNotifications",
    value: new Date().toISOString(),
  });
}
```

---

### Task 4: Add Bell Icon to Desktop Sidebar

**Files:**

- Modify: `app/lib/components/organisms/Sidebar.svelte`

**Step 1: Update the sidebar**

Add the Bell import and unseen count query, then add the bell icon between Home and Settings:

The `<script>` block becomes:

```svelte
<script lang="ts">
  import { Home, Plus, Settings, Bell } from 'lucide-svelte'
  import AuthBar from './AuthBar.svelte'
  import Avatar from '../atoms/Avatar.svelte'
  import { isAuthenticated, viewer } from '$lib/stores'
  import { page } from '$app/state'
  import { createQuery } from '@tanstack/svelte-query'
  import { unseenNotificationCountQuery } from '$lib/queries'

  const unseenCount = createQuery(() => ({
    ...unseenNotificationCountQuery($viewer?.did ?? ''),
    enabled: !!$viewer?.did,
  }))
</script>
```

In the `.nav-items` div, add the bell icon after the Home link and before the `{#if $isAuthenticated}` block. The full `.nav-items` section becomes:

```svelte
  <div class="nav-items">
    <a href="/" class="nav-item" class:active={page.url.pathname === '/'} title="Home">
      <Home size={22} />
    </a>
    {#if $isAuthenticated}
      <a href="/notifications" class="nav-item" class:active={page.url.pathname === '/notifications'} title="Notifications">
        <span class="bell-wrap">
          <Bell size={22} />
          {#if (unseenCount.data ?? 0) > 0}
            <span class="badge">{unseenCount.data! > 99 ? '99+' : unseenCount.data}</span>
          {/if}
        </span>
      </a>
      <a href="/settings/profile" class="nav-item" class:active={page.url.pathname.startsWith('/settings')} title="Settings">
        <Settings size={22} />
      </a>
      <a href="/create" class="nav-item" class:active={page.url.pathname === '/create'} title="Create">
        <Plus size={22} />
      </a>
    {/if}
  </div>
```

Add styles for the badge inside the `<style>` block:

```css
.bell-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.badge {
  position: absolute;
  top: -6px;
  right: -8px;
  background: var(--grain);
  color: #000;
  font-size: 10px;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  font-family: var(--font-body);
}
```

---

### Task 5: Add Bell Icon to Mobile Bottom Bar

**Files:**

- Modify: `app/lib/components/molecules/MobileBottomBar.svelte`

**Step 1: Update the mobile bottom bar**

Add the Bell import, unseen count query, and bell button between Create and Search:

The `<script>` block becomes:

```svelte
<script lang="ts">
  import { Image, Search, Plus, Bell } from 'lucide-svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { isAuthenticated, viewer } from '$lib/stores'
  import Avatar from '../atoms/Avatar.svelte'
  import { createQuery } from '@tanstack/svelte-query'
  import { unseenNotificationCountQuery } from '$lib/queries'

  let { onSearch }: { onSearch: () => void } = $props()

  const unseenCount = createQuery(() => ({
    ...unseenNotificationCountQuery($viewer?.did ?? ''),
    enabled: !!$viewer?.did,
  }))
</script>
```

In the template, add the bell button after the Create button and before the Search button. The full template becomes:

```svelte
<div class="mobile-bottom">
  <button
    class="mobile-tab"
    class:active={page.url.pathname === '/'}
    onclick={() => goto('/')}
  >
    <Image size={22} />
  </button>
  {#if $isAuthenticated}
    <button
      class="mobile-tab"
      class:active={page.url.pathname === '/create'}
      onclick={() => goto('/create')}
    >
      <Plus size={22} />
    </button>
    <button
      class="mobile-tab"
      class:active={page.url.pathname === '/notifications'}
      onclick={() => goto('/notifications')}
    >
      <span class="bell-wrap">
        <Bell size={22} />
        {#if (unseenCount.data ?? 0) > 0}
          <span class="badge">{unseenCount.data! > 99 ? '99+' : unseenCount.data}</span>
        {/if}
      </span>
    </button>
  {/if}
  <button class="mobile-tab" onclick={onSearch}>
    <Search size={22} />
  </button>
  {#if $isAuthenticated && $viewer}
    <button
      class="mobile-tab"
      class:active={page.url.pathname.startsWith('/profile/')}
      onclick={() => goto(`/profile/${encodeURIComponent($viewer!.did)}`)}
    >
      <Avatar did={$viewer.did} src={$viewer.avatar} name={$viewer.displayName || $viewer.handle} size={24} />
    </button>
  {/if}
</div>
```

Add badge styles to the `<style>` block:

```css
.bell-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.badge {
  position: absolute;
  top: -4px;
  right: -6px;
  background: var(--grain);
  color: #000;
  font-size: 9px;
  font-weight: 700;
  min-width: 14px;
  height: 14px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
  font-family: var(--font-body);
}
```

---

### Task 6: Create the Notifications Page

**Files:**

- Create: `app/routes/notifications/+page.svelte`

**Step 1: Create the page component**

```svelte
<script lang="ts">
  import { onMount } from 'svelte'
  import { createQuery, useQueryClient } from '@tanstack/svelte-query'
  import { notificationsQuery } from '$lib/queries'
  import { markNotificationsSeen } from '$lib/preferences'
  import { viewer as viewerStore } from '$lib/stores'
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import NotificationItem from '$lib/components/atoms/NotificationItem.svelte'
  import Spinner from '$lib/components/atoms/Spinner.svelte'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'
  import { callXrpc } from '$hatk/client'

  const viewerDid = $derived($viewerStore?.did)
  const queryClient = useQueryClient()

  const notifications = createQuery(() => ({
    ...notificationsQuery(viewerDid ?? ''),
    enabled: !!viewerDid,
  }))

  let loadingMore = $state(false)
  let allItems: any[] = $state([])
  let currentCursor: string | undefined = $state(undefined)
  let hasMore = $state(true)
  let sentinel: HTMLDivElement | undefined = $state(undefined)

  $effect(() => {
    if (notifications.data) {
      allItems = notifications.data.notifications ?? []
      currentCursor = notifications.data.cursor
      hasMore = !!notifications.data.cursor
    }
  })

  onMount(async () => {
    if (viewerDid) {
      await markNotificationsSeen()
      queryClient.setQueryData(['unseenNotificationCount', viewerDid], 0)
    }
  })

  async function loadMore() {
    if (loadingMore || !hasMore || !viewerDid || !currentCursor) return
    loadingMore = true
    try {
      const result = await callXrpc('social.grain.unspecced.getNotifications', {
        viewer: viewerDid,
        limit: 20,
        cursor: currentCursor,
      }) as any
      const newItems = result?.notifications ?? []
      allItems = [...allItems, ...newItems]
      currentCursor = result?.cursor
      hasMore = !!result?.cursor
    } finally {
      loadingMore = false
    }
  }

  $effect(() => {
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) loadMore() },
      { rootMargin: '200px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  })
</script>

<OGMeta title="Notifications - grain" />
<DetailHeader label="Notifications" />

{#if notifications.isLoading}
  <div class="center"><Spinner /></div>
{:else if allItems.length === 0}
  <div class="empty">No notifications yet</div>
{:else}
  <div class="notification-list">
    {#each allItems as notif (notif.uri)}
      <NotificationItem {notif} />
    {/each}
    {#if hasMore}
      <div bind:this={sentinel} class="sentinel">
        {#if loadingMore}<Spinner />{/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .center {
    display: flex;
    justify-content: center;
    padding: 40px;
  }
  .empty {
    text-align: center;
    padding: 60px 20px;
    color: var(--text-muted);
    font-size: 14px;
  }
  .notification-list {
    display: flex;
    flex-direction: column;
  }
  .sentinel {
    display: flex;
    justify-content: center;
    padding: 20px;
  }
</style>
```

---

### Task 7: Create the NotificationItem Component

**Files:**

- Create: `app/lib/components/atoms/NotificationItem.svelte`

**Step 1: Create the component**

```svelte
<script lang="ts">
  import Avatar from './Avatar.svelte'
  import { relativeTime } from '$lib/utils'

  let { notif }: { notif: any } = $props()

  const reasonText: Record<string, string> = {
    'gallery-favorite': 'favorited your gallery',
    'gallery-comment': 'commented on your gallery',
    'gallery-comment-mention': 'mentioned you in a comment',
    'gallery-mention': 'mentioned you in a gallery',
    'reply': 'replied to your comment',
    'follow': 'followed you',
  }

  const action = $derived(reasonText[notif.reason] ?? '')
  const timeStr = $derived(relativeTime(notif.createdAt || ''))
  const authorDid = $derived(notif.author?.did ?? '')
  const authorName = $derived(notif.author?.displayName || notif.author?.handle || authorDid.slice(0, 18))
  const authorAvatar = $derived(notif.author?.avatar ?? null)
</script>

<a class="notif" href={notif.galleryUri ? `/profile/${notif.galleryUri.split('/')[2]}/gallery/${notif.galleryUri.split('/').pop()}` : `/profile/${authorDid}`}>
  <div class="notif-avatar">
    <Avatar did={authorDid} src={authorAvatar} name={authorName} size={38} />
  </div>
  <div class="notif-body">
    <div class="notif-header">
      <span class="notif-author">{authorName}</span>
      <span class="notif-action">{action}</span>
      <span class="notif-time">{timeStr}</span>
    </div>
    {#if notif.reason === 'reply' && notif.replyToText}
      <div class="notif-quote">{notif.replyToText}</div>
    {/if}
    {#if notif.commentText}
      <div class="notif-comment">{notif.commentText}</div>
    {/if}
    {#if notif.galleryTitle && notif.reason !== 'follow'}
      <div class="notif-gallery-title">{notif.galleryTitle}</div>
    {/if}
  </div>
  {#if notif.galleryThumb}
    <img src={notif.galleryThumb} alt="" class="notif-thumb" loading="lazy" />
  {/if}
</a>

<style>
  .notif {
    display: flex;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    text-decoration: none;
    color: inherit;
    transition: background 0.12s;
    align-items: flex-start;
  }
  .notif:hover {
    background: var(--bg-hover);
  }
  .notif-avatar {
    flex-shrink: 0;
  }
  .notif-body {
    flex: 1;
    min-width: 0;
  }
  .notif-header {
    font-size: 13px;
    line-height: 1.4;
  }
  .notif-author {
    font-weight: 600;
    color: var(--text-primary);
  }
  .notif-action {
    color: var(--text-secondary);
    margin-left: 4px;
  }
  .notif-time {
    color: var(--text-muted);
    margin-left: 4px;
    font-size: 12px;
  }
  .notif-quote {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 4px;
    padding: 4px 8px;
    border-left: 2px solid var(--border);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .notif-comment {
    font-size: 13px;
    color: var(--text-secondary);
    margin-top: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .notif-gallery-title {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 2px;
  }
  .notif-thumb {
    width: 48px;
    height: 48px;
    border-radius: 6px;
    object-fit: cover;
    flex-shrink: 0;
  }
</style>
```

---

### Task 8: Verify End-to-End

**Step 1: Regenerate types**

Run: `npx hatk generate`

**Step 2: Start the dev server**

Run: `npm run dev`

**Step 3: Test manually**

1. Log in as a user who has received favorites/comments/follows
2. Check that the bell icon appears in the sidebar and mobile bottom bar
3. Navigate to `/notifications` and verify notifications render
4. Check that the badge shows the unseen count
5. After visiting the page, verify the badge clears
6. Scroll to trigger infinite scroll pagination
