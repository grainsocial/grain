# Grain hatk Template — MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Copy hatk-template-teal and rework it into a Grain photo-sharing app with shell + auth + timeline gallery cards, running end-to-end.

**Architecture:** SvelteKit 5 + hatk framework with Grain's AT Protocol lexicons. The teal template provides the application shell, OAuth flow, and component structure. We swap the music domain (plays, artists, tracks) for the photo domain (galleries, photos, items) and write one feed (recent galleries) with hydration.

**Tech Stack:** SvelteKit 5, Svelte 5, hatk, TanStack Svelte Query, SQLite, Vite

---

### Task 1: Copy teal template files into grain project

**Files:**

- Copy from: `~/code/hatk-template-teal/` (everything except `.git/`, `node_modules/`, `.svelte-kit/`, `data/`, `*.db`)
- Copy to: `~/code/hatk-template-grain/`

**Step 1: Copy the template**

```bash
cd ~/code/hatk-template-grain
rsync -av --exclude='.git' --exclude='node_modules' --exclude='.svelte-kit' --exclude='data' --exclude='*.db' --exclude='.DS_Store' ~/code/hatk-template-teal/ .
```

**Step 2: Initialize git**

```bash
cd ~/code/hatk-template-grain
git init
```

**Step 3: Verify the copy**

```bash
ls ~/code/hatk-template-grain/app/routes/+layout.svelte
ls ~/code/hatk-template-grain/server/feeds/recent.ts
ls ~/code/hatk-template-grain/hatk.config.ts
ls ~/code/hatk-template-grain/package.json
```

Expected: all files exist.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: copy hatk-template-teal scaffold"
```

---

### Task 2: Replace lexicons

**Files:**

- Delete: `lexicons/fm/` (teal-specific)
- Delete: `lexicons/xyz/` (teal-specific appview defs)
- Delete: `lexicons/community/` (teal-specific bookmarks)
- Copy from: `~/code/grain-next/lexicons/social/` → `lexicons/social/`
- Keep: `lexicons/app/bsky/`, `lexicons/com/atproto/`, `lexicons/dev/hatk/`

**Step 1: Remove teal-specific lexicons**

```bash
cd ~/code/hatk-template-grain
rm -rf lexicons/fm lexicons/xyz lexicons/community
```

**Step 2: Copy Grain lexicons**

```bash
cp -r ~/code/grain-next/lexicons/social lexicons/social
```

**Step 3: Verify**

```bash
ls lexicons/social/grain/gallery/gallery.json
ls lexicons/social/grain/photo/photo.json
ls lexicons/social/grain/actor/profile.json
ls lexicons/social/grain/graph/follow.json
ls lexicons/social/grain/favorite/favorite.json
ls lexicons/social/grain/comment/comment.json
```

Expected: all files exist.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: replace teal lexicons with grain lexicons"
```

---

### Task 3: Update package.json and hatk.config.ts

**Files:**

- Modify: `package.json`
- Modify: `hatk.config.ts`

**Step 1: Update package.json**

Change the `name` field:

```json
"name": "hatk-template-grain"
```

**Step 2: Update hatk.config.ts**

Replace the entire file with:

```typescript
import { defineConfig } from "@hatk/hatk/config";

const isProd = process.env.NODE_ENV === "production";
const prodDomain = process.env.RAILWAY_PUBLIC_DOMAIN;

const grainScopes = [
  "atproto",
  "repo:social.grain.gallery",
  "repo:social.grain.gallery.item",
  "repo:social.grain.photo",
  "repo:social.grain.actor.profile",
  "repo:social.grain.graph.follow",
  "repo:social.grain.favorite",
  "repo:social.grain.comment",
].join(" ");

export default defineConfig({
  relay: isProd ? "wss://bsky.network" : "ws://localhost:2583",
  plc: isProd ? "https://plc.directory" : "http://localhost:2582",
  port: 3000,
  databaseEngine: "sqlite",
  database: isProd ? "/data/grain.db" : "data/grain.db",
  backfill: {
    signalCollections: ["social.grain.actor.profile"],
    fullNetwork: false,
    parallelism: 5,
  },
  oauth: {
    issuer: isProd && prodDomain ? `https://${prodDomain}` : undefined,
    scopes: grainScopes.split(" "),
    clients: [
      ...(prodDomain
        ? [
            {
              client_id: `https://${prodDomain}/oauth-client-metadata.json`,
              client_name: "grain",
              scope: grainScopes,
              redirect_uris: [`https://${prodDomain}/oauth/callback`],
            },
          ]
        : []),
      {
        client_id: "http://127.0.0.1:3000/oauth-client-metadata.json",
        client_name: "grain",
        scope: grainScopes,
        redirect_uris: ["http://127.0.0.1:3000/oauth/callback"],
      },
    ],
  },
});
```

**Step 3: Commit**

```bash
git add package.json hatk.config.ts
git commit -m "chore: update config for grain"
```

---

### Task 4: Update app.html title and branding strings

**Files:**

- Modify: `app/app.html`

**Step 1: Update title**

Change `<title>teal</title>` to `<title>grain</title>`.

**Step 2: Commit**

```bash
git add app/app.html
git commit -m "chore: update HTML title to grain"
```

---

### Task 5: Strip teal-specific server files

**Files:**

- Delete: `server/feeds/actor.ts`
- Delete: `server/feeds/artist.ts`
- Delete: `server/feeds/bookmarks.ts`
- Delete: `server/feeds/following.ts`
- Delete: `server/feeds/genre.ts`
- Delete: `server/feeds/release.ts`
- Delete: `server/feeds/track.ts`
- Delete: `server/feeds/_hydrate.ts`
- Delete: `server/xrpc/` (all files)
- Delete: `server/og/` (all files)
- Delete: `server/setup/` (all files)
- Keep: `server/feeds/recent.ts`, `server/on-login.ts`

**Step 1: Remove teal-specific server files**

```bash
cd ~/code/hatk-template-grain
rm server/feeds/actor.ts server/feeds/artist.ts server/feeds/bookmarks.ts
rm server/feeds/following.ts server/feeds/genre.ts server/feeds/release.ts
rm server/feeds/track.ts server/feeds/_hydrate.ts
rm -rf server/xrpc server/og server/setup
```

**Step 2: Verify remaining**

```bash
ls server/feeds/recent.ts
ls server/on-login.ts
```

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove teal-specific server code"
```

---

### Task 6: Write the recent galleries feed

**Files:**

- Modify: `server/feeds/recent.ts`

**Step 1: Write the feed**

Replace `server/feeds/recent.ts` with:

```typescript
import { defineFeed } from "$hatk";
import type { HydrateContext } from "$hatk";

export default defineFeed({
  collection: "social.grain.gallery",
  label: "Recent Galleries",

  async hydrate(ctx: HydrateContext<any>) {
    const dids = [...new Set(ctx.items.map((item) => item.did).filter(Boolean))];
    const profiles = await ctx.lookup<any>("social.grain.actor.profile", "did", dids);

    return ctx.items.map((item) => {
      const author = profiles.get(item.did);

      // Look up gallery items (photos linked to this gallery)
      return {
        uri: item.uri,
        cid: item.cid,
        title: item.value.title,
        description: item.value.description,
        createdAt: item.value.createdAt,
        creator: author
          ? {
              did: author.did,
              handle: author.handle,
              displayName: author.value.displayName,
              avatar: ctx.blobUrl(author.did, author.value.avatar),
            }
          : { did: item.did, handle: item.handle },
        items: [],
      };
    });
  },

  async generate(ctx) {
    const { rows, cursor } = await ctx.paginate<{ uri: string }>(
      `SELECT t.uri, t.cid, t.created_at FROM "social.grain.gallery" t
       LEFT JOIN _repos r ON t.did = r.did
       WHERE (r.status IS NULL OR r.status != 'takendown')`,
      { orderBy: "t.created_at" },
    );

    return ctx.ok({ uris: rows.map((r) => r.uri), cursor });
  },
});
```

**Step 2: Commit**

```bash
git add server/feeds/recent.ts
git commit -m "feat: add recent galleries feed"
```

---

### Task 7: Update queries.ts for grain

**Files:**

- Modify: `app/lib/queries.ts`

**Step 1: Replace queries.ts**

Replace the entire file with:

```typescript
import { queryOptions } from "@tanstack/svelte-query";
import { callXrpc } from "$hatk/client";

type Fetch = typeof globalThis.fetch;

// ─── Feeds ──────────────────────────────────────────────────────────

export const recentFeedQuery = (limit = 50, f?: Fetch) =>
  queryOptions({
    queryKey: ["getFeed", "recent"],
    queryFn: () => callXrpc("dev.hatk.getFeed", { feed: "recent", limit }, f),
    staleTime: 60_000,
  });
```

**Step 2: Commit**

```bash
git add app/lib/queries.ts
git commit -m "feat: replace teal queries with grain feed query"
```

---

### Task 8: Simplify preferences.ts

**Files:**

- Modify: `app/lib/preferences.ts`

**Step 1: Replace preferences.ts**

Replace the entire file with:

```typescript
import { writable } from "svelte/store";

export interface PinnedFeed {
  id: string;
  label: string;
  type: string;
  path: string;
}

export const DEFAULT_PINNED: PinnedFeed[] = [
  { id: "recent", label: "Recent", type: "feed", path: "/" },
];

export const pinnedFeeds = writable<PinnedFeed[]>(DEFAULT_PINNED);

export function resetPreferences(): void {
  pinnedFeeds.set(DEFAULT_PINNED);
}
```

**Step 2: Commit**

```bash
git add app/lib/preferences.ts
git commit -m "feat: simplify preferences to single recent feed"
```

---

### Task 9: Update +layout.svelte to remove preferences fetching

**Files:**

- Modify: `app/routes/+layout.svelte`

**Step 1: Replace +layout.svelte**

Replace the entire file with:

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte'
  import '../app.css'
  import Shell from '$lib/components/templates/Shell.svelte'
  import '$lib/auth'
  import { QueryClientProvider } from '@tanstack/svelte-query'
  import { isAuthenticated, viewer } from '$lib/stores'

  let { data, children }: { data: any; children: Snippet } = $props()

  $effect(() => {
    if (data.viewer) {
      $isAuthenticated = true
      $viewer = { did: data.viewer.did, handle: data.viewer.handle ?? null, displayName: data.viewer.handle ?? data.viewer.did.slice(0, 18), avatar: null }
    } else {
      $isAuthenticated = false
      $viewer = null
    }
  })
</script>

<QueryClientProvider client={data.queryClient}>
  <Shell>
    {@render children()}
  </Shell>
</QueryClientProvider>
```

**Step 2: Commit**

```bash
git add app/routes/+layout.svelte
git commit -m "feat: simplify layout to remove teal-specific data"
```

---

### Task 10: Update +layout.server.ts to remove teal profile fetch

**Files:**

- Modify: `app/routes/+layout.server.ts`

**Step 1: Replace +layout.server.ts**

Replace the entire file with:

```typescript
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ cookies }) => {
  const parseSessionCookie = (globalThis as any).__hatk_parseSessionCookie;
  const cookieName: string = (globalThis as any).__hatk_sessionCookieName ?? "__hatk_session";
  let viewer: { did: string; handle?: string } | null = null;

  if (parseSessionCookie) {
    const cookieValue = cookies.get(cookieName);
    if (cookieValue) {
      try {
        const request = new Request("http://localhost", {
          headers: { cookie: `${cookieName}=${cookieValue}` },
        });
        viewer = await parseSessionCookie(request);
      } catch {}
    }
  }

  if (viewer) {
    (globalThis as any).__hatk_viewer = viewer;
  }

  return { viewer };
};
```

**Step 2: Commit**

```bash
git add app/routes/+layout.server.ts
git commit -m "feat: simplify layout server to basic session parsing"
```

---

### Task 11: Update +layout.ts to remove teal prefetch queries

**Files:**

- Modify: `app/routes/+layout.ts`

**Step 1: Replace +layout.ts**

Replace the entire file with:

```typescript
import { browser } from "$app/environment";
import { QueryClient } from "@tanstack/svelte-query";
import type { LayoutLoad } from "./$types";

let browserClient: QueryClient;

function getQueryClient() {
  if (browser) {
    if (!browserClient) {
      browserClient = new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: true,
          },
        },
      });
    }
    return browserClient;
  }

  return new QueryClient({
    defaultOptions: {
      queries: {
        enabled: false,
        staleTime: 60_000,
      },
    },
  });
}

export const load: LayoutLoad = async ({ data }) => {
  const queryClient = getQueryClient();
  return { ...data, queryClient };
};
```

**Step 2: Commit**

```bash
git add app/routes/+layout.ts
git commit -m "feat: simplify layout loader to basic query client"
```

---

### Task 12: Strip teal-specific routes

**Files:**

- Delete: `app/routes/artist/` (entire directory)
- Delete: `app/routes/bookmarks/` (entire directory)
- Delete: `app/routes/feeds/` (entire directory)
- Delete: `app/routes/following/` (entire directory)
- Delete: `app/routes/genre/` (entire directory)
- Delete: `app/routes/play/` (entire directory)
- Delete: `app/routes/release/` (entire directory)
- Delete: `app/routes/search/` (entire directory)
- Delete: `app/routes/track/` (entire directory)
- Delete: `app/routes/preferences.remote.ts`
- Keep: `app/routes/+page.svelte`, `app/routes/+page.ts`, `app/routes/+layout.*`, `app/routes/+error.svelte`, `app/routes/oauth/`, `app/routes/profile/`

**Step 1: Remove teal routes**

```bash
cd ~/code/hatk-template-grain
rm -rf app/routes/artist app/routes/bookmarks app/routes/feeds
rm -rf app/routes/following app/routes/genre app/routes/play
rm -rf app/routes/release app/routes/search app/routes/track
rm app/routes/preferences.remote.ts
```

**Step 2: Commit**

```bash
git add -A
git commit -m "chore: remove teal-specific routes"
```

---

### Task 13: Strip teal-specific components

**Files:**

- Delete: `app/lib/components/atoms/AlbumArt.svelte`
- Delete: `app/lib/components/atoms/AvatarLightbox.svelte`
- Delete: `app/lib/components/atoms/Badge.svelte`
- Delete: `app/lib/components/atoms/OGMeta.svelte`
- Delete: `app/lib/components/atoms/TimeAgo.svelte`
- Delete: `app/lib/components/molecules/BookmarkButton.svelte`
- Delete: `app/lib/components/molecules/DetailHeader.svelte`
- Delete: `app/lib/components/molecules/ExternalLink.svelte`
- Delete: `app/lib/components/molecules/PinButton.svelte`
- Delete: `app/lib/components/molecules/PlayCard.svelte`
- Delete: `app/lib/components/molecules/ProfileChip.svelte`
- Delete: `app/lib/components/molecules/ShareMenu.svelte`
- Delete: `app/lib/components/molecules/StatBar.svelte`
- Delete: `app/lib/components/molecules/TrendingStrip.svelte`
- Delete: `app/lib/components/organisms/ScrobbleModal.svelte`

**Step 1: Remove teal-specific components**

```bash
cd ~/code/hatk-template-grain
rm app/lib/components/atoms/AlbumArt.svelte
rm app/lib/components/atoms/AvatarLightbox.svelte
rm app/lib/components/atoms/Badge.svelte
rm app/lib/components/atoms/OGMeta.svelte
rm app/lib/components/atoms/TimeAgo.svelte
rm app/lib/components/molecules/BookmarkButton.svelte
rm app/lib/components/molecules/DetailHeader.svelte
rm app/lib/components/molecules/ExternalLink.svelte
rm app/lib/components/molecules/PinButton.svelte
rm app/lib/components/molecules/PlayCard.svelte
rm app/lib/components/molecules/ProfileChip.svelte
rm app/lib/components/molecules/ShareMenu.svelte
rm app/lib/components/molecules/StatBar.svelte
rm app/lib/components/molecules/TrendingStrip.svelte
rm app/lib/components/organisms/ScrobbleModal.svelte
```

**Step 2: Commit**

```bash
git add -A
git commit -m "chore: remove teal-specific components"
```

---

### Task 14: Update Sidebar.svelte for grain

**Files:**

- Modify: `app/lib/components/organisms/Sidebar.svelte`

**Step 1: Replace Sidebar.svelte**

Remove the scrobble button and update branding:

```svelte
<script lang="ts">
  import { Home } from 'lucide-svelte'
  import AuthBar from './AuthBar.svelte'
  import Avatar from '../atoms/Avatar.svelte'
  import { isAuthenticated, viewer } from '$lib/stores'
  import { page } from '$app/state'
</script>

<nav class="sidebar-left">
  <div class="sidebar-top">
    {#if $isAuthenticated && $viewer}
      <a href="/profile/{$viewer.did}" class="sidebar-avatar-link">
        <Avatar did={$viewer.did} src={$viewer.avatar} name={$viewer.displayName || $viewer.handle} size={42} />
      </a>
    {:else}
      <a href="/" class="logo-text">grain</a>
    {/if}
  </div>
  <div class="nav-items">
    <a href="/" class="nav-item" class:active={page.url.pathname === '/'} title="Home">
      <Home size={22} />
    </a>
  </div>
  <div class="sidebar-bottom">
    <AuthBar />
  </div>
</nav>

<style>
  .sidebar-left {
    position: sticky;
    top: 0;
    height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    padding: 16px 12px 16px 0;
    border-right: 1px solid var(--border);
    z-index: 101;
  }
  .sidebar-top {
    margin-bottom: 28px;
  }
  .logo-text {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 15px;
    display: block;
    text-align: center;
    color: var(--teal);
    text-decoration: none;
  }
  .sidebar-avatar-link { text-decoration: none; }
  .nav-items {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: center;
  }
  .nav-item {
    width: 42px;
    height: 42px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s;
    text-decoration: none;
    background: none;
    border: none;
    padding: 0;
    font: inherit;
  }
  .nav-item:hover { background: var(--bg-hover); color: var(--text-primary); }
  .nav-item.active { color: var(--teal); background: var(--teal-glow); }
  .sidebar-bottom {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: flex-end;
  }

  @media (max-width: 600px) {
    .sidebar-left { display: none; }
  }
</style>
```

**Step 2: Commit**

```bash
git add app/lib/components/organisms/Sidebar.svelte
git commit -m "feat: update sidebar for grain branding"
```

---

### Task 15: Update SidebarRight.svelte for grain

**Files:**

- Modify: `app/lib/components/organisms/SidebarRight.svelte`

**Step 1: Replace SidebarRight.svelte**

Strip trending artists and genres, keep search bar and basic feeds:

```svelte
<script lang="ts">
  import { Search } from 'lucide-svelte'
  import { page } from '$app/state'
  import { pinnedFeeds } from '$lib/preferences'
</script>

<aside class="sidebar-right">
  <form action="/search" class="search-wrapper">
    <span class="search-icon"><Search size={16} /></span>
    <input
      type="text"
      name="q"
      class="search-input"
      placeholder="Search..."
    />
  </form>

  <div class="sidebar-card">
    <div class="sidebar-card-header">Feeds</div>
    {#each $pinnedFeeds as feed (feed.id)}
      <a
        href={feed.path}
        class="sidebar-link"
        class:active={page.url.pathname === feed.path}
      >
        {feed.label}
      </a>
    {/each}
  </div>

  <div class="sidebar-footer">Powered by <a href="https://atproto.com">AT Protocol</a></div>
</aside>

<style>
  .sidebar-right {
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .sidebar-right::-webkit-scrollbar { width: 0; }

  .search-wrapper { position: relative; }
  .search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-faint);
    font-size: 14px;
    pointer-events: none;
    display: flex;
    align-items: center;
  }
  .search-input {
    width: 100%;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 9px 16px 9px 36px;
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 16px;
    outline: none;
    transition: border-color 0.15s, background 0.15s;
  }
  .search-input::placeholder { color: var(--text-faint); }
  .search-input:focus { border-color: var(--teal); background: var(--bg-root); }

  .sidebar-card {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 14px;
  }
  .sidebar-card-header {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 17px;
    padding: 12px 16px;
  }
  .sidebar-link {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    font-size: 14px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: background 0.12s;
    text-decoration: none;
  }
  .sidebar-link:hover { background: var(--bg-hover); color: var(--text-primary); }
  .sidebar-link:last-child { border-radius: 0 0 14px 14px; }
  .sidebar-link.active { color: var(--teal); font-weight: 600; }

  .sidebar-footer {
    padding: 12px 16px;
    font-size: 11px;
    color: var(--text-faint);
    line-height: 1.8;
  }
  .sidebar-footer a { color: var(--text-muted); text-decoration: none; }
  .sidebar-footer a:hover { text-decoration: underline; }

  @media (max-width: 1060px) { .sidebar-right { display: none; } }
</style>
```

**Step 2: Commit**

```bash
git add app/lib/components/organisms/SidebarRight.svelte
git commit -m "feat: simplify right sidebar for grain"
```

---

### Task 16: Update MobileTopBar, MobileBottomBar, MobileDrawer for grain

**Files:**

- Modify: `app/lib/components/molecules/MobileTopBar.svelte`
- Modify: `app/lib/components/molecules/MobileBottomBar.svelte`
- Modify: `app/lib/components/organisms/MobileDrawer.svelte`

**Step 1: Update MobileTopBar.svelte**

Change the logo text from "teal" to "grain":

In `MobileTopBar.svelte`, change:

```html
<span class="mobile-logo">teal</span>
```

to:

```html
<span class="mobile-logo">grain</span>
```

**Step 2: Update MobileBottomBar.svelte**

Remove the scrobble button and the `ScrobbleModal` import. Replace the file with:

```svelte
<script lang="ts">
  import { Image, Search } from 'lucide-svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { isAuthenticated, viewer } from '$lib/stores'
  import Avatar from '../atoms/Avatar.svelte'

  let { onSearch }: { onSearch: () => void } = $props()
</script>

<div class="mobile-bottom">
  <button
    class="mobile-tab"
    class:active={page.url.pathname === '/'}
    onclick={() => goto('/')}
  >
    <Image size={22} />
  </button>
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

<style>
  .mobile-bottom {
    display: none;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--bg-root);
    border-top: 1px solid var(--border);
    padding: 0 0 env(safe-area-inset-bottom, 0px);
    z-index: 100;
    justify-content: space-around;
    align-items: center;
    height: calc(50px + env(safe-area-inset-bottom, 0px));
  }
  .mobile-tab {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 22px;
    padding: 8px 16px;
    cursor: pointer;
    transition: color 0.12s;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .mobile-tab.active {
    color: var(--teal);
  }

  @media (max-width: 600px) {
    .mobile-bottom {
      display: flex;
      touch-action: none;
    }
  }
</style>
```

**Step 3: Update MobileDrawer.svelte**

Replace file — remove trending artists, genres, scrobble references. Change "teal" to "grain":

```svelte
<script lang="ts">
  import { Image } from 'lucide-svelte'
  import { goto } from '$app/navigation'
  import { isAuthenticated, viewer } from '$lib/stores'
  import Avatar from '../atoms/Avatar.svelte'
  import { pinnedFeeds, resetPreferences } from '$lib/preferences'
  import { logout } from '$lib/auth'
  import LoginModal from './LoginModal.svelte'

  let { open = $bindable(false) }: { open: boolean } = $props()
  let loginOpen = $state(false)

  function nav(path: string) {
    open = false
    goto(path)
  }

  async function doLogout() {
    await logout()
    resetPreferences()
    $isAuthenticated = false
    $viewer = null
    window.location.reload()
  }
</script>

<LoginModal bind:open={loginOpen} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="drawer-overlay" class:open onclick={() => open = false}></div>
<div class="drawer" class:open>
  <div class="drawer-header">
    <button type="button" class="drawer-logo" onclick={() => nav('/')}>grain</button>
  </div>

  {#each $pinnedFeeds as feed (feed.id)}
    <button class="drawer-link" onclick={() => nav(feed.path)}>
      <span class="drawer-link-icon"><Image size={18} /></span> {feed.label}
    </button>
  {/each}

  <div class="drawer-auth">
    {#if $isAuthenticated && $viewer}
      <div class="drawer-auth-info">
        <Avatar did={$viewer.did} src={$viewer.avatar} name={$viewer.displayName || $viewer.handle} size={32} />
        <span class="drawer-handle">{$viewer.handle || $viewer.displayName}</span>
      </div>
      <button class="drawer-btn drawer-btn-ghost" onclick={() => { open = false; doLogout() }}>Sign Out</button>
    {:else}
      <button class="drawer-btn drawer-btn-primary" onclick={() => { open = false; loginOpen = true }}>Sign In</button>
    {/if}
  </div>
</div>

<style>
  .drawer-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 200;
  }
  .drawer-overlay.open {
    display: block;
  }
  .drawer {
    position: fixed;
    top: 0;
    left: -280px;
    bottom: 0;
    width: 280px;
    background: var(--bg-surface);
    border-right: 1px solid var(--border);
    z-index: 201;
    transition: left 0.25s ease;
    overflow-y: auto;
    padding: 20px 16px;
    display: flex;
    flex-direction: column;
  }
  .drawer.open {
    left: 0;
  }
  .drawer-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
  }
  .drawer-logo {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 18px;
    color: var(--teal);
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
  }
  .drawer-link {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 8px;
    border-radius: 8px;
    color: var(--text-secondary);
    font-size: 15px;
    cursor: pointer;
    transition: background 0.12s;
    background: none;
    border: none;
    font-family: var(--font-body);
    width: 100%;
    text-align: left;
  }
  .drawer-link:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  .drawer-link-icon {
    width: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .drawer-auth {
    margin-top: auto;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }
  .drawer-auth-info {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
  }
  .drawer-handle {
    font-size: 14px;
    color: var(--text-secondary);
  }
  .drawer-btn {
    width: 100%;
    padding: 10px;
    border-radius: 20px;
    border: none;
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    margin-top: 8px;
  }
  .drawer-btn-primary {
    background: var(--teal);
    color: #000;
  }
  .drawer-btn-ghost {
    background: var(--bg-elevated);
    color: var(--text-secondary);
    border: 1px solid var(--border);
  }
</style>
```

**Step 4: Commit**

```bash
git add app/lib/components/molecules/MobileTopBar.svelte app/lib/components/molecules/MobileBottomBar.svelte app/lib/components/organisms/MobileDrawer.svelte
git commit -m "feat: update mobile components for grain"
```

---

### Task 17: Create GalleryCard.svelte

**Files:**

- Create: `app/lib/components/molecules/GalleryCard.svelte`

**Step 1: Create the component**

```svelte
<script lang="ts">
  import Avatar from '../atoms/Avatar.svelte'
  import { relativeTime } from '$lib/utils'

  let { gallery }: { gallery: any } = $props()

  const displayName = $derived(
    gallery.creator?.displayName || (gallery.creator?.handle ? `@${gallery.creator.handle}` : gallery.creator?.did?.slice(0, 18) + '\u2026')
  )
  const avatarSrc = $derived(gallery.creator?.avatar ?? null)
  const timeStr = $derived(relativeTime(gallery.createdAt || ''))
  const photoCount = $derived(gallery.items?.length ?? 0)
</script>

<div class="gallery-card">
  <div class="gallery-row">
    <a href="/profile/{gallery.creator?.did}" class="avatar-link">
      <Avatar did={gallery.creator?.did ?? ''} src={avatarSrc} size={40} />
    </a>
    <div class="gallery-body">
      <div class="gallery-meta">
        <a href="/profile/{gallery.creator?.did}" class="gallery-author">{displayName}</a>
        <span class="gallery-handle">
          {gallery.creator?.handle ? `@${gallery.creator.handle}` : ''}
        </span>
        <span class="gallery-time">{timeStr}</span>
      </div>
      <div class="gallery-content">
        <div class="gallery-title">{gallery.title}</div>
        {#if gallery.description}
          <div class="gallery-description">{gallery.description}</div>
        {/if}
        {#if photoCount > 0}
          <div class="gallery-photo-count">{photoCount} photo{photoCount !== 1 ? 's' : ''}</div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .gallery-card {
    padding: 16px;
    border-bottom: 1px solid var(--border);
    transition: background 0.12s;
  }
  .gallery-card:hover { background: var(--bg-surface); }
  .gallery-row { display: flex; gap: 12px; }
  .avatar-link { flex-shrink: 0; text-decoration: none; }
  .gallery-body { flex: 1; min-width: 0; }
  .gallery-meta {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin-bottom: 6px;
  }
  .gallery-author {
    font-weight: 600;
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-decoration: none;
    color: inherit;
    cursor: pointer;
  }
  .gallery-author:hover { text-decoration: underline; }
  .gallery-handle {
    font-size: 12px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .gallery-time {
    font-size: 12px;
    color: var(--text-muted);
    margin-left: auto;
    flex-shrink: 0;
  }
  .gallery-content {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px;
  }
  .gallery-title {
    font-weight: 600;
    font-size: 15px;
    margin-bottom: 4px;
  }
  .gallery-description {
    font-size: 13px;
    color: var(--text-secondary);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin-bottom: 4px;
  }
  .gallery-photo-count {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 6px;
  }
</style>
```

**Step 2: Commit**

```bash
git add app/lib/components/molecules/GalleryCard.svelte
git commit -m "feat: add GalleryCard component"
```

---

### Task 18: Update FeedList.svelte and FeedTabs.svelte for grain

**Files:**

- Modify: `app/lib/components/organisms/FeedList.svelte`
- Modify: `app/lib/components/molecules/FeedTabs.svelte`

**Step 1: Update FeedList.svelte**

Replace the file — swap `PlayCard` for `GalleryCard`, remove `PlayView` type:

```svelte
<script lang="ts">
  import { RefreshCw } from 'lucide-svelte'
  import GalleryCard from '../molecules/GalleryCard.svelte'
  import Skeleton from '../atoms/Skeleton.svelte'
  import { queryFeed } from '$lib/feed'

  let {
    feed,
    params = {},
    initialItems,
    initialCursor,
    skeleton = false,
  }: {
    feed: string
    params?: Record<string, string>
    initialItems?: any[]
    initialCursor?: string
    skeleton?: boolean
  } = $props()

  let items: any[] = $state([])
  let cursor: string | undefined = $state(undefined)
  let loading = $state(true)
  let loadingMore = $state(false)
  let error: string | null = $state(null)

  async function load() {
    loading = true
    error = null
    try {
      const result = await queryFeed(feed, { limit: '50', ...params })
      items = result.items ?? []
      cursor = result.cursor
    } catch (e: any) {
      error = e.message
    } finally {
      loading = false
    }
  }

  async function loadMore() {
    if (!cursor || loadingMore) return
    loadingMore = true
    try {
      const result = await queryFeed(feed, { limit: '50', cursor, ...params })
      items = [...items, ...(result.items ?? [])]
      cursor = result.cursor
    } finally {
      loadingMore = false
    }
  }

  $effect(() => {
    if (skeleton) {
      loading = true
      return
    }
    void feed
    void params
    if (initialItems) {
      items = initialItems
      cursor = initialCursor
      loading = false
    } else {
      load()
    }
  })
</script>

{#if !loading || items.length > 0}
  <div class="feed-status">
    <span>{items.length} gallerie{items.length !== 1 ? 's' : 'y'}{cursor ? '+' : ''}</span>
    <button class="refresh" onclick={() => load()} title="Refresh"><RefreshCw size={14} /></button>
  </div>
{/if}

{#if loading && items.length === 0}
  {#each {length: 4} as _}
    <div class="skeleton-card">
      <div class="skeleton-card-row">
        <Skeleton circle height="40px" />
        <div class="skeleton-card-info">
          <Skeleton width="120px" height="14px" />
          <div style="margin-top:6px"><Skeleton width="80px" height="12px" /></div>
        </div>
      </div>
      <div class="skeleton-card-body">
        <Skeleton width="100%" height="60px" radius="10px" />
      </div>
    </div>
  {/each}
{:else if error && items.length === 0}
  <div class="error-state">{error}</div>
{:else if items.length === 0 && !loading}
  <div class="empty-state">
    <span class="empty-icon">&#128247;</span>
    No galleries found.
  </div>
{:else}
  {#each items as item, i (`${item.uri}:${i}`)}
    <GalleryCard gallery={item} />
  {/each}

  {#if cursor}
    <div class="load-more">
      <button class="load-more-btn" onclick={() => loadMore()} disabled={loadingMore}>
        {loadingMore ? 'Loading\u2026' : 'Load more'}
      </button>
    </div>
  {/if}
{/if}

<style>
  .feed-status {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    font-size: 12px;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border);
  }
  .refresh {
    margin-left: auto;
    cursor: pointer;
    font-size: 14px;
    color: var(--text-muted);
    transition: color 0.15s;
    background: none;
    border: none;
    font-family: inherit;
  }
  .refresh:hover { color: var(--teal); }
  .skeleton-card {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
  }
  .skeleton-card-row {
    display: flex; gap: 10px; align-items: center;
  }
  .skeleton-card-info { flex: 1; }
  .skeleton-card-body { padding-left: 50px; margin-top: 8px; }
  .error-state, .empty-state {
    padding: 48px;
    text-align: center;
    color: var(--text-secondary);
  }
  .error-state { color: var(--danger); }
  .empty-state { display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .empty-icon { font-size: 32px; opacity: 0.5; }
  .load-more { padding: 16px; text-align: center; }
  .load-more-btn {
    padding: 10px 24px;
    border-radius: 20px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    color: var(--text-secondary);
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.12s;
  }
  .load-more-btn:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  .load-more-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
```

**Step 2: FeedTabs.svelte is already fine**

The `FeedTabs.svelte` component reads from `$pinnedFeeds` which now only has "Recent". No changes needed.

**Step 3: Commit**

```bash
git add app/lib/components/organisms/FeedList.svelte
git commit -m "feat: update FeedList to render GalleryCards"
```

---

### Task 19: Update home page (+page.svelte and +page.ts)

**Files:**

- Modify: `app/routes/+page.svelte`
- Modify: `app/routes/+page.ts`

**Step 1: Update +page.svelte**

Replace the file — remove TrendingStrip, simplify:

```svelte
<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query'
  import FeedList from '$lib/components/organisms/FeedList.svelte'
  import FeedTabs from '$lib/components/molecules/FeedTabs.svelte'
  import { recentFeedQuery } from '$lib/queries'

  const feed = createQuery(() => recentFeedQuery())
</script>

<FeedTabs />
{#if feed.isLoading}
  <FeedList feed="recent" skeleton />
{:else}
  <FeedList feed="recent" initialItems={feed.data?.items ?? []} initialCursor={feed.data?.cursor} />
{/if}
```

**Step 2: +page.ts is already correct**

The existing `+page.ts` uses `recentFeedQuery` which we've already updated. No changes needed.

**Step 3: Commit**

```bash
git add app/routes/+page.svelte
git commit -m "feat: update home page for grain timeline"
```

---

### Task 20: Update profile placeholder page

**Files:**

- Modify: `app/routes/profile/[did]/+page.svelte`
- Modify: `app/routes/profile/[did]/+page.ts`

**Step 1: Simplify profile page to placeholder**

Replace `app/routes/profile/[did]/+page.svelte` with:

```svelte
<script lang="ts">
  import { page } from '$app/state'

  const did = $derived(decodeURIComponent(page.params.did))
</script>

<div class="profile-placeholder">
  <h2>Profile</h2>
  <p class="profile-did">{did}</p>
  <p class="profile-coming-soon">Full profile coming soon.</p>
</div>

<style>
  .profile-placeholder {
    padding: 48px 24px;
    text-align: center;
  }
  .profile-placeholder h2 {
    font-family: var(--font-display);
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 8px;
  }
  .profile-did {
    font-size: 12px;
    color: var(--text-muted);
    font-family: monospace;
    word-break: break-all;
    margin-bottom: 16px;
  }
  .profile-coming-soon {
    font-size: 14px;
    color: var(--text-secondary);
  }
</style>
```

Replace `app/routes/profile/[did]/+page.ts` with:

```typescript
// Profile page — no data loading for MVP
```

**Step 2: Commit**

```bash
git add app/routes/profile/
git commit -m "feat: add placeholder profile page"
```

---

### Task 21: Clean up remaining teal references

**Files:**

- Modify: `app/lib/utils.ts` (keep as-is, all helpers are generic)
- Delete: `test/` (teal-specific test fixtures and tests)
- Delete: `seeds/` (teal-specific seed data)
- Delete: `data/` contents (MusicBrainz artist data)
- Delete: `Dockerfile` and `docker-compose.yml` (rebuild later)
- Delete: `.dockerignore` and `.railwayignore` (rebuild later)

**Step 1: Remove teal-specific data and tests**

```bash
cd ~/code/hatk-template-grain
rm -rf test seeds
rm -rf data/artist data/artist.tar.xz
rm -f Dockerfile docker-compose.yml .dockerignore .railwayignore 2>/dev/null
```

**Step 2: Commit**

```bash
git add -A
git commit -m "chore: remove teal-specific test data, seeds, and deploy config"
```

---

### Task 22: Install dependencies and verify build

**Step 1: Install dependencies**

```bash
cd ~/code/hatk-template-grain
npm install
```

Expected: installs successfully.

**Step 2: Generate types from lexicons**

```bash
npx hatk generate types
```

Expected: generates `hatk.generated.ts` and `hatk.generated.client.ts` with Grain types.

**Step 3: Run type check**

```bash
npx svelte-check
```

Expected: no type errors (may have warnings).

**Step 4: Commit generated types**

```bash
git add hatk.generated.ts hatk.generated.client.ts
git commit -m "chore: generate types from grain lexicons"
```

---

### Task 23: Final verification

**Step 1: Start dev server**

```bash
cd ~/code/hatk-template-grain
npm run dev
```

Expected: SvelteKit dev server starts on port 3000. The page should load showing the 3-column shell with "grain" branding, empty feed (no data yet), login button, and search placeholder.

**Step 2: Verify in browser**

Open `http://localhost:3000` and verify:

- 3-column layout renders
- Left sidebar shows "grain" logo and home icon
- Right sidebar shows search bar and "Feeds" card with "Recent"
- Main content shows "No galleries found" empty state
- No console errors related to missing components or imports

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "feat: grain hatk template MVP complete"
```
