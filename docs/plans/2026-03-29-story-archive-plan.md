# Story Archive Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users browse all their past stories (beyond 24h) in a thumbnail grid on their own profile page.

**Architecture:** New XRPC endpoint mirrors getStories without the 24-hour cutoff, with cursor pagination. A StoryArchive grid component renders thumbnails inline on the profile page (own profile only). StoryViewer gains a single-story mode for opening archived stories.

**Tech Stack:** hatk (XRPC server framework), Svelte 5, TanStack Query, existing StoryView types.

---

### Task 1: Lexicon + Server Endpoint

**Files:**

- Create: `lexicons/social/grain/unspecced/getStoryArchive.json`
- Create: `server/xrpc/getStoryArchive.ts`

**Step 1: Create the lexicon file**

Create `lexicons/social/grain/unspecced/getStoryArchive.json`:

```json
{
  "lexicon": 1,
  "id": "social.grain.unspecced.getStoryArchive",
  "defs": {
    "main": {
      "type": "query",
      "description": "Get all stories for an actor, including expired ones. For archive browsing.",
      "parameters": {
        "type": "params",
        "required": ["actor"],
        "properties": {
          "actor": { "type": "string", "format": "did" },
          "limit": { "type": "integer", "minimum": 1, "maximum": 100, "default": 50 },
          "cursor": { "type": "string" }
        }
      },
      "output": {
        "encoding": "application/json",
        "schema": {
          "type": "object",
          "required": ["stories"],
          "properties": {
            "stories": {
              "type": "array",
              "items": { "type": "ref", "ref": "social.grain.story.defs#storyView" }
            },
            "cursor": { "type": "string" }
          }
        }
      }
    }
  }
}
```

**Step 2: Create the server endpoint**

Create `server/xrpc/getStoryArchive.ts`. This mirrors `server/xrpc/getStories.ts` with these differences:

- No 24-hour cutoff
- `ORDER BY created_at DESC` (newest first, not ASC)
- Cursor-based pagination using `created_at` timestamp

```typescript
import { defineQuery } from "$hatk";
import { views } from "$hatk";
import type { GrainActorProfile, Story, Label } from "$hatk";
import { HIDE_LABELS } from "../labels/_hidden.ts";
import { lookupCrossPosts } from "../feeds/_hydrate.ts";

export default defineQuery("social.grain.unspecced.getStoryArchive", async (ctx) => {
  const { db, ok } = ctx;
  const actor = ctx.params.actor;
  if (!actor) return ok({ stories: [] });

  const limit = Math.min(Number(ctx.params.limit) || 50, 100);
  const cursor = ctx.params.cursor as string | undefined;

  const queryParams: (string | number)[] = [actor, limit + 1];
  let cursorClause = "";
  if (cursor) {
    cursorClause = ` AND s.created_at < $3`;
    queryParams.push(cursor);
  }

  const rows = (await db.query(
    `SELECT s.uri, s.cid, s.did, s.media, s.aspect_ratio, s.location, s.address, s.created_at
       FROM "social.grain.story" s
       LEFT JOIN _repos r ON s.did = r.did
       WHERE s.did = $1
         AND (r.status IS NULL OR r.status != 'takendown')
         ${cursorClause}
       ORDER BY s.created_at DESC
       LIMIT $2`,
    queryParams,
  )) as {
    uri: string;
    cid: string;
    did: string;
    media: string;
    aspect_ratio: string;
    location: string | null;
    address: string | null;
    created_at: string;
  }[];

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  // Resolve author profile
  const profiles = await ctx.lookup<GrainActorProfile>("social.grain.actor.profile", "did", [
    actor,
  ]);
  const author = profiles.get(actor);
  const profileView = author
    ? views.grainActorDefsProfileView({
        cid: author.cid,
        did: author.did,
        handle: author.handle ?? author.did,
        displayName: author.value.displayName,
        avatar: ctx.blobUrl(author.did, author.value.avatar) ?? undefined,
      })
    : views.grainActorDefsProfileView({
        cid: "",
        did: actor,
        handle: actor,
      });

  // Hydrate external labels
  const storyUris = pageRows.map((r) => r.uri);
  const labelsByUri =
    storyUris.length > 0
      ? ((await ctx.labels(storyUris)) as Map<string, Label[]>)
      : new Map<string, Label[]>();

  // Filter stories with hide-severity labels
  const visibleRows = pageRows.filter((row) => {
    const labels = labelsByUri.get(row.uri);
    if (!labels) return true;
    const latestByVal = new Map<string, Label>();
    for (const l of labels) {
      const prev = latestByVal.get(l.val);
      if (!prev || l.cts > prev.cts) latestByVal.set(l.val, l);
    }
    return ![...latestByVal.values()].some((l) => HIDE_LABELS.has(l.val) && !l.neg);
  });

  // Cross-post lookup
  const crossPosts = await lookupCrossPosts(db, visibleRows, "story");

  const stories = visibleRows.map((row) => {
    let blobRef: any;
    try {
      blobRef = typeof row.media === "string" ? JSON.parse(row.media) : row.media;
    } catch {
      blobRef = row.media;
    }

    let aspectRatio: { width: number; height: number };
    try {
      aspectRatio =
        typeof row.aspect_ratio === "string" ? JSON.parse(row.aspect_ratio) : row.aspect_ratio;
    } catch {
      aspectRatio = { width: 4, height: 3 };
    }

    let location: Story["location"] | null = null;
    if (row.location) {
      try {
        location = typeof row.location === "string" ? JSON.parse(row.location) : row.location;
      } catch {
        location = null;
      }
    }

    let address: Story["address"] | null = null;
    if (row.address) {
      try {
        address = typeof row.address === "string" ? JSON.parse(row.address) : row.address;
      } catch {
        address = null;
      }
    }

    return views.storyView({
      uri: row.uri,
      cid: row.cid,
      creator: profileView,
      thumb: ctx.blobUrl(row.did, blobRef, "feed_thumbnail") ?? "",
      fullsize: ctx.blobUrl(row.did, blobRef, "feed_fullsize") ?? "",
      aspectRatio,
      ...(location
        ? {
            location: { name: location.name, value: location.value },
            ...(address ? { address } : {}),
          }
        : {}),
      createdAt: row.created_at,
      ...(labelsByUri.has(row.uri) ? { labels: labelsByUri.get(row.uri) } : {}),
      ...(crossPosts.has(row.uri) ? { crossPost: { url: crossPosts.get(row.uri)! } } : {}),
    });
  });

  const nextCursor = hasMore ? pageRows[pageRows.length - 1].created_at : undefined;

  return ok({ stories, ...(nextCursor ? { cursor: nextCursor } : {}) });
});
```

**Step 3: Regenerate types**

Run: `npx hatk generate types`
Expected: Output includes `GetStoryArchive` in the generated types list.

**Step 4: Commit**

```bash
git add lexicons/social/grain/unspecced/getStoryArchive.json server/xrpc/getStoryArchive.ts hatk.generated.ts hatk.generated.client.ts
git commit -m "feat: add getStoryArchive endpoint (no 24h cutoff, cursor pagination)"
```

---

### Task 2: Client Query

**Files:**

- Modify: `app/lib/queries.ts` (add after `storiesQuery` around line 89)

**Step 1: Add `storyArchiveQuery` to queries.ts**

Add after the existing `storiesQuery` definition:

```typescript
export const storyArchiveQuery = (did: string, cursor?: string, f?: Fetch) =>
  queryOptions({
    queryKey: ["stories", "archive", did, cursor],
    queryFn: () =>
      callXrpc(
        "social.grain.unspecced.getStoryArchive",
        { actor: did, ...(cursor ? { cursor } : {}) },
        f,
      ).then((r) => r ?? { stories: [], cursor: undefined }),
    staleTime: 60_000,
  });
```

**Step 2: Verify types**

Run: `npx svelte-check --workspace app 2>&1 | grep -E 'ERROR|COMPLETED'`
Expected: 0 ERRORS

**Step 3: Commit**

```bash
git add app/lib/queries.ts
git commit -m "feat: add storyArchiveQuery client query"
```

---

### Task 3: StoryViewer — Single-Story Mode + Date Formatting

**Files:**

- Modify: `app/lib/components/organisms/StoryViewer.svelte`

**Step 1: Add `singleStory` prop**

Add a new optional prop to the `$props()` destructuring at lines 12-18:

```typescript
let {
  initialDid,
  onclose,
  singleStory,
}: {
  initialDid: string;
  onclose: () => void;
  singleStory?: { uri: string } | null;
} = $props();
```

**Step 2: Override story loading in single-story mode**

When `singleStory` is provided, use `storyQuery` instead of `storiesQuery` and disable author swiping.

Add a new import at line 6:

```typescript
import { storiesQuery, storyAuthorsQuery, storyQuery } from "$lib/queries";
```

Add after the `storyAuthors` query (around line 23):

```typescript
// Single-story mode: load just one story by URI
const singleStoryData = createQuery(() => ({
  ...storyQuery(singleStory?.uri ?? ""),
  enabled: !!singleStory,
}));
```

Override `stories` and `authorDids` derivations. Replace the existing `stories` line (line 55) and `totalStories` (line 58) with:

```typescript
const stories = createQuery(() =>
  singleStory ? { ...storyQuery(singleStory.uri), enabled: true } : storiesQuery(currentDid),
);

const currentStory = $derived(
  singleStory ? (singleStoryData.data ?? undefined) : stories.data?.[currentStoryIndex],
);
const totalStories = $derived(singleStory ? 1 : (stories.data?.length ?? 0));
```

**Step 3: Disable author swiping in single-story mode**

In the `next()` function (line 148), wrap the author-advance logic:

```typescript
function next() {
  if (currentStoryIndex < totalStories - 1) {
    currentStoryIndex++;
    progress = 0;
  } else if (!singleStory && currentAuthorIndex < authorDids.length - 1) {
    currentAuthorIndex++;
  } else {
    onclose();
  }
}
```

In the `prev()` function (line 160):

```typescript
function prev() {
  if (currentStoryIndex > 0) {
    currentStoryIndex--;
    progress = 0;
  } else if (!singleStory && currentAuthorIndex > 0) {
    currentAuthorIndex--;
  }
}
```

**Step 4: Update `timeAgo` for old stories**

Replace the `timeAgo` function (lines 119-127) with:

```typescript
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) {
    const mins = Math.floor(diff / (1000 * 60));
    return `${mins}m`;
  }
  if (hours < 24) {
    return `${hours}h`;
  }
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
```

**Step 5: Verify types**

Run: `npx svelte-check --workspace app 2>&1 | grep -E 'ERROR|COMPLETED'`
Expected: 0 ERRORS

**Step 6: Commit**

```bash
git add app/lib/components/organisms/StoryViewer.svelte
git commit -m "feat: add single-story mode and full date display to StoryViewer"
```

---

### Task 4: StoryArchive Grid Component

**Files:**

- Create: `app/lib/components/molecules/StoryArchive.svelte`

**Step 1: Create the component**

This component shows a 3-column grid of square story thumbnails with date overlays. It uses cursor pagination with a "Load more" button. Tapping a thumbnail opens StoryViewer in single-story mode.

```svelte
<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query'
  import type { StoryView } from '$hatk/client'
  import { storyArchiveQuery } from '$lib/queries'
  import StoryViewer from '$lib/components/organisms/StoryViewer.svelte'
  import { callXrpc } from '$hatk/client'

  let { did }: { did: string } = $props()

  const initial = createQuery(() => storyArchiveQuery(did))

  let allStories = $state<StoryView[]>([])
  let cursor = $state<string | undefined>(undefined)
  let loadingMore = $state(false)
  let viewingStory = $state<{ uri: string } | null>(null)

  // Sync initial query data into local state
  $effect(() => {
    const data = initial.data as { stories?: StoryView[]; cursor?: string } | undefined
    if (data?.stories) {
      allStories = data.stories
      cursor = data.cursor
    }
  })

  async function loadMore() {
    if (!cursor || loadingMore) return
    loadingMore = true
    try {
      const result = await callXrpc('social.grain.unspecced.getStoryArchive', { actor: did, cursor }) as { stories?: StoryView[]; cursor?: string }
      allStories = [...allStories, ...(result.stories ?? [])]
      cursor = result.cursor
    } finally {
      loadingMore = false
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }
</script>

{#if initial.isLoading}
  <div class="archive-grid">
    {#each { length: 6 } as _}
      <div class="cell placeholder"></div>
    {/each}
  </div>
{:else if allStories.length === 0}
  <div class="empty">No stories yet.</div>
{:else}
  <div class="archive-grid">
    {#each allStories as story (story.uri)}
      <button class="cell" onclick={() => (viewingStory = { uri: story.uri })}>
        <img
          src={story.thumb}
          alt=""
          decoding="async"
          loading="lazy"
          onload={(e) => (e.currentTarget as HTMLImageElement).classList.add('loaded')}
        />
        <span class="date-badge">{formatDate(story.createdAt)}</span>
      </button>
    {/each}
  </div>

  {#if cursor}
    <div class="load-more">
      <button class="load-more-btn" onclick={loadMore} disabled={loadingMore}>
        {loadingMore ? 'Loading…' : 'Load more'}
      </button>
    </div>
  {/if}
{/if}

{#if viewingStory}
  <StoryViewer initialDid={did} singleStory={viewingStory} onclose={() => (viewingStory = null)} />
{/if}

<style>
  .archive-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2px;
  }
  .cell {
    display: block;
    aspect-ratio: 1;
    background: var(--bg-elevated);
    position: relative;
    overflow: hidden;
    border: none;
    padding: 0;
    cursor: pointer;
  }
  .cell img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  .cell img:global(.loaded) {
    opacity: 1;
  }
  .placeholder {
    animation: pulse 1.5s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.7; }
  }
  .date-badge {
    position: absolute;
    bottom: 6px;
    left: 6px;
    font-size: 11px;
    font-weight: 600;
    color: #fff;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
  }
  .load-more {
    display: flex;
    justify-content: center;
    padding: 16px;
  }
  .load-more-btn {
    background: none;
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 8px 24px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    cursor: pointer;
    font-family: inherit;
  }
  .load-more-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  .load-more-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .empty {
    padding: 32px;
    text-align: center;
    color: var(--text-muted);
    font-size: 14px;
  }
</style>
```

**Step 2: Verify types**

Run: `npx svelte-check --workspace app 2>&1 | grep -E 'ERROR|COMPLETED'`
Expected: 0 ERRORS

**Step 3: Commit**

```bash
git add app/lib/components/molecules/StoryArchive.svelte
git commit -m "feat: add StoryArchive thumbnail grid component"
```

---

### Task 5: Wire Into Profile Page

**Files:**

- Modify: `app/routes/profile/[did]/+page.svelte`

**Step 1: Add imports and state**

Add to the imports (after the StoryViewer import, line 15):

```typescript
import StoryArchive from "$lib/components/molecules/StoryArchive.svelte";
import { Archive } from "lucide-svelte";
```

Add state variable (after `showStoryViewer` at line 21):

```typescript
let showArchive = $state(false);
```

Add derived (after `hasStory` at line 30):

```typescript
const isOwnProfile = $derived(viewerDid === did);
```

**Step 2: Add archive button to the profile header**

Insert after the `.links-row` div (after line 83, before the knownFollowers block):

```svelte
{#if isOwnProfile}
  <button class="archive-btn" onclick={() => (showArchive = !showArchive)}>
    <Archive size={14} />
    Story Archive
  </button>
{/if}
```

**Step 3: Add archive section to the page body**

Insert after the view-toggle section (after line 116, before the grid/list content):

```svelte
{#if showArchive && isOwnProfile}
  <div class="archive-section">
    <div class="archive-header">
      <h3 class="archive-title">Story Archive</h3>
      <button class="archive-close" onclick={() => (showArchive = false)}>&times;</button>
    </div>
    <StoryArchive {did} />
  </div>
{/if}
```

**Step 4: Add styles**

Add to the `<style>` block:

```css
.archive-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 20px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  font-family: inherit;
  transition: all 0.12s;
}
.archive-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.archive-section {
  border-bottom: 1px solid var(--border);
}
.archive-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
}
.archive-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
}
.archive-close {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 20px;
  cursor: pointer;
  padding: 4px 8px;
  line-height: 1;
}
.archive-close:hover {
  color: var(--text-primary);
}
```

**Step 5: Reset archive on profile change**

Update the existing `$effect` at line 24 to also reset archive state:

```typescript
$effect(() => {
  void did;
  void profile.data;
  followersOffset = 0;
  showArchive = false;
});
```

**Step 6: Verify types**

Run: `npx svelte-check --workspace app 2>&1 | grep -E 'ERROR|COMPLETED'`
Expected: 0 ERRORS

**Step 7: Commit**

```bash
git add app/routes/profile/[did]/+page.svelte
git commit -m "feat: add Story Archive section to own profile page"
```
