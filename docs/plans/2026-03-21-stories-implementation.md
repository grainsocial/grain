# Stories Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add ephemeral 24-hour photo stories with a story strip at the top of the feed and a full-screen viewer.

**Architecture:** New `social.grain.story` record type stores a single photo with optional location. Two XRPC queries serve the story strip (authors with active stories) and viewer (a user's stories). Client adds a story strip component above the feed, a full-screen overlay viewer with progress bars, and a simple create modal.

**Tech Stack:** Svelte 5, TanStack Query, hatk framework (defineQuery, callXrpc, processPhotos), Lucide icons.

---

### Task 1: Story Record Lexicon

**Files:**

- Create: `lexicons/social/grain/story/story.json`

**Step 1: Create the lexicon**

```json
{
  "lexicon": 1,
  "id": "social.grain.story",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["media", "aspectRatio", "createdAt"],
        "properties": {
          "media": {
            "type": "blob",
            "accept": ["image/*", "video/*"],
            "maxSize": 5000000
          },
          "aspectRatio": { "type": "ref", "ref": "social.grain.defs#aspectRatio" },
          "location": { "type": "ref", "ref": "social.grain.defs#location" },
          "createdAt": { "type": "string", "format": "datetime" }
        }
      }
    }
  }
}
```

---

### Task 2: Story View Defs Lexicon

**Files:**

- Create: `lexicons/social/grain/story/defs.json`

**Step 1: Create the defs lexicon**

```json
{
  "lexicon": 1,
  "id": "social.grain.story.defs",
  "defs": {
    "storyView": {
      "type": "object",
      "required": ["uri", "cid", "creator", "thumb", "fullsize", "aspectRatio", "createdAt"],
      "properties": {
        "uri": { "type": "string", "format": "at-uri" },
        "cid": { "type": "string", "format": "cid" },
        "creator": { "type": "ref", "ref": "social.grain.actor.defs#profileView" },
        "thumb": {
          "type": "string",
          "format": "uri",
          "description": "Thumbnail URL for the story image."
        },
        "fullsize": {
          "type": "string",
          "format": "uri",
          "description": "Full-size URL for the story image."
        },
        "aspectRatio": { "type": "ref", "ref": "social.grain.defs#aspectRatio" },
        "location": { "type": "ref", "ref": "social.grain.defs#location" },
        "createdAt": { "type": "string", "format": "datetime" }
      }
    }
  }
}
```

---

### Task 3: XRPC Lexicons for Story Queries

**Files:**

- Create: `lexicons/social/grain/unspecced/getStoryAuthors.json`
- Create: `lexicons/social/grain/unspecced/getStories.json`

**Step 1: Create getStoryAuthors lexicon**

```json
{
  "lexicon": 1,
  "id": "social.grain.unspecced.getStoryAuthors",
  "defs": {
    "main": {
      "type": "query",
      "description": "Get authors who have active stories (posted within the last 24 hours).",
      "output": {
        "encoding": "application/json",
        "schema": {
          "type": "object",
          "properties": {
            "authors": {
              "type": "array",
              "items": {
                "type": "ref",
                "ref": "social.grain.unspecced.getStoryAuthors#storyAuthor"
              }
            }
          }
        }
      }
    },
    "storyAuthor": {
      "type": "object",
      "required": ["profile", "storyCount", "latestAt"],
      "properties": {
        "profile": { "type": "ref", "ref": "social.grain.actor.defs#profileView" },
        "storyCount": { "type": "integer" },
        "latestAt": { "type": "string", "format": "datetime" }
      }
    }
  }
}
```

**Step 2: Create getStories lexicon**

```json
{
  "lexicon": 1,
  "id": "social.grain.unspecced.getStories",
  "defs": {
    "main": {
      "type": "query",
      "description": "Get a user's active stories (posted within the last 24 hours).",
      "parameters": {
        "type": "params",
        "required": ["actor"],
        "properties": {
          "actor": { "type": "string", "format": "did" }
        }
      },
      "output": {
        "encoding": "application/json",
        "schema": {
          "type": "object",
          "properties": {
            "stories": {
              "type": "array",
              "items": {
                "type": "ref",
                "ref": "social.grain.story.defs#storyView"
              }
            }
          }
        }
      }
    }
  }
}
```

---

### Task 4: Register Story Collection

**Files:**

- Modify: `hatk.config.ts`

**Step 1: Add story scope**

In `hatk.config.ts`, add `"repo:social.grain.story"` to the `grainScopes` array:

```typescript
const grainScopes = [
  "atproto",
  "blob:image/*",
  "repo:social.grain.gallery",
  "repo:social.grain.gallery.item",
  "repo:social.grain.photo",
  "repo:social.grain.photo.exif",
  "repo:social.grain.actor.profile",
  "repo:social.grain.graph.follow",
  "repo:social.grain.favorite",
  "repo:social.grain.comment",
  "repo:social.grain.story",
].join(" ");
```

**Step 2: Regenerate types**

Run: `npx hatk generate`

This updates `hatk.generated.ts` and `hatk.generated.client.ts` with the new story lexicons.

---

### Task 5: Server — getStoryAuthors XRPC Query

**Files:**

- Create: `server/xrpc/getStoryAuthors.ts`

**Step 1: Implement the query**

```typescript
import { defineQuery } from "$hatk";
import { views } from "$hatk";
import type { GrainActorProfile } from "$hatk";

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export default defineQuery("social.grain.unspecced.getStoryAuthors", async (ctx) => {
  const { db, ok } = ctx;
  const cutoff = new Date(Date.now() - TWENTY_FOUR_HOURS).toISOString();

  // Get authors with active stories, ordered by most recent
  const rows = (await db.query(
    `SELECT did, COUNT(*) AS story_count, MAX(created_at) AS latest_at
       FROM "social.grain.story"
       WHERE created_at > $1
       GROUP BY did
       ORDER BY latest_at DESC`,
    [cutoff],
  )) as { did: string; story_count: number; latest_at: string }[];

  const dids = rows.map((r) => r.did);
  const profiles = await ctx.lookup<GrainActorProfile>("social.grain.actor.profile", "did", dids);

  const authors = rows.map((row) => {
    const author = profiles.get(row.did);
    return {
      profile: author
        ? views.grainActorDefsProfileView({
            cid: author.cid,
            did: author.did,
            handle: author.handle ?? author.did,
            displayName: author.value.displayName,
            avatar: ctx.blobUrl(author.did, author.value.avatar) ?? undefined,
          })
        : views.grainActorDefsProfileView({
            cid: "",
            did: row.did,
            handle: row.did,
          }),
      storyCount: row.story_count,
      latestAt: row.latest_at,
    };
  });

  return ok({ authors });
});
```

---

### Task 6: Server — getStories XRPC Query

**Files:**

- Create: `server/xrpc/getStories.ts`

**Step 1: Implement the query**

```typescript
import { defineQuery } from "$hatk";
import { views } from "$hatk";
import type { GrainActorProfile } from "$hatk";

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export default defineQuery("social.grain.unspecced.getStories", async (ctx) => {
  const { db, ok } = ctx;
  const actor = ctx.params.actor;
  if (!actor) return ok({ stories: [] });

  const cutoff = new Date(Date.now() - TWENTY_FOUR_HOURS).toISOString();

  const rows = (await db.query(
    `SELECT uri, cid, did, media, aspect_ratio_width, aspect_ratio_height,
              location, created_at
       FROM "social.grain.story"
       WHERE did = $1 AND created_at > $2
       ORDER BY created_at ASC`,
    [actor, cutoff],
  )) as {
    uri: string;
    cid: string;
    did: string;
    media: string;
    aspect_ratio_width: number;
    aspect_ratio_height: number;
    location: string | null;
    created_at: string;
  }[];

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

  const stories = rows.map((row) => {
    // hatk stores blobs as JSON — parse to get the blob ref for URL generation
    let blobRef: any;
    try {
      blobRef = typeof row.media === "string" ? JSON.parse(row.media) : row.media;
    } catch {
      blobRef = row.media;
    }

    const location = row.location ? JSON.parse(row.location) : null;

    return {
      uri: row.uri,
      cid: row.cid,
      creator: profileView,
      thumb: ctx.blobUrl(row.did, blobRef, "feed_thumbnail") ?? "",
      fullsize: ctx.blobUrl(row.did, blobRef, "feed_fullsize") ?? "",
      aspectRatio: {
        width: row.aspect_ratio_width ?? 4,
        height: row.aspect_ratio_height ?? 3,
      },
      ...(location
        ? {
            location: {
              name: location.name,
              value: location.value,
              ...(location.region ? { region: location.region } : {}),
            },
          }
        : {}),
      createdAt: row.created_at,
    };
  });

  return ok({ stories });
});
```

**Important note about hatk column naming:** hatk stores nested objects (like `aspectRatio`) as expanded columns using snake_case. So `aspectRatio: { width, height }` becomes columns `aspect_ratio_width` and `aspect_ratio_height`. Blob fields are stored as JSON strings. Location is stored as a single JSON column. If the exact column names differ from what's here, check with `SELECT * FROM "social.grain.story" LIMIT 1` after creating a test record.

---

### Task 7: Client Queries

**Files:**

- Modify: `app/lib/queries.ts`

**Step 1: Add story queries**

Add these to `app/lib/queries.ts`:

```typescript
export const storyAuthorsQuery = (f?: Fetch) =>
  queryOptions({
    queryKey: ["storyAuthors"],
    queryFn: () =>
      callXrpc("social.grain.unspecced.getStoryAuthors", undefined, f).then(
        (r) => r?.authors ?? [],
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
```

---

### Task 8: StoryStrip Component

**Files:**

- Create: `app/lib/components/molecules/StoryStrip.svelte`

**Step 1: Create the component**

This is the horizontal scrollable row of avatar circles at the top of the feed. The first circle is "+" for creating your own story (only shown when authenticated).

```svelte
<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query'
  import { Plus } from 'lucide-svelte'
  import { storyAuthorsQuery } from '$lib/queries'
  import { isAuthenticated, sessionDid } from '$lib/stores'

  let {
    onCreateStory,
    onViewStory,
  }: {
    onCreateStory: () => void
    onViewStory: (did: string) => void
  } = $props()

  const authors = createQuery(() => storyAuthorsQuery())
</script>

{#if $isAuthenticated || (authors.data && authors.data.length > 0)}
  <div class="story-strip">
    {#if $isAuthenticated}
      <button class="story-circle create" onclick={onCreateStory}>
        <div class="avatar-wrapper">
          <div class="plus-icon"><Plus size={20} /></div>
        </div>
        <span class="label">Your story</span>
      </button>
    {/if}
    {#if authors.data}
      {#each authors.data as author (author.profile.did)}
        <button class="story-circle" onclick={() => onViewStory(author.profile.did)}>
          <div class="avatar-wrapper ring">
            {#if author.profile.avatar}
              <img src={author.profile.avatar} alt={author.profile.displayName ?? author.profile.handle} />
            {:else}
              <div class="avatar-placeholder"></div>
            {/if}
          </div>
          <span class="label">{author.profile.displayName ?? author.profile.handle}</span>
        </button>
      {/each}
    {/if}
  </div>
{/if}

<style>
  .story-strip {
    display: flex;
    gap: 12px;
    padding: 12px 16px;
    overflow-x: auto;
    border-bottom: 1px solid var(--border);
    scrollbar-width: none;
  }
  .story-strip::-webkit-scrollbar { display: none; }
  .story-circle {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
  }
  .avatar-wrapper {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-elevated);
  }
  .avatar-wrapper.ring {
    border: 2px solid var(--grain);
    padding: 2px;
  }
  .avatar-wrapper img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
  }
  .avatar-placeholder {
    width: 100%;
    height: 100%;
    background: var(--bg-hover);
    border-radius: 50%;
  }
  .plus-icon {
    color: var(--grain);
  }
  .create .avatar-wrapper {
    border: 2px dashed var(--border);
  }
  .label {
    font-size: 11px;
    color: var(--text-secondary);
    max-width: 64px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font-body);
  }
</style>
```

---

### Task 9: StoryViewer Component

**Files:**

- Create: `app/lib/components/organisms/StoryViewer.svelte`

**Step 1: Create the full-screen story viewer**

This is the most complex component — full-screen overlay with progress bars, auto-advance, and tap navigation.

```svelte
<script lang="ts">
  import { createQuery, useQueryClient } from '@tanstack/svelte-query'
  import { X, MapPin } from 'lucide-svelte'
  import { storiesQuery, storyAuthorsQuery } from '$lib/queries'
  import { onMount } from 'svelte'

  let {
    initialDid,
    onclose,
  }: {
    initialDid: string
    onclose: () => void
  } = $props()

  const queryClient = useQueryClient()
  const authorsData = queryClient.getQueryData<any[]>(["storyAuthors"]) ?? []
  const authorDids = authorsData.map((a: any) => a.profile.did)

  let currentAuthorIndex = $state(authorDids.indexOf(initialDid))
  let currentStoryIndex = $state(0)
  let progress = $state(0)
  let paused = $state(false)
  let timer: ReturnType<typeof setInterval> | null = null

  const DURATION = 5000 // 5 seconds per story
  const TICK = 50

  $effect(() => {
    // Reset story index when author changes
    currentStoryIndex = 0
    progress = 0
  })

  const currentDid = $derived(authorDids[currentAuthorIndex] ?? initialDid)
  const stories = createQuery(() => storiesQuery(currentDid))

  const currentStory = $derived(stories.data?.[currentStoryIndex])
  const totalStories = $derived(stories.data?.length ?? 0)

  function startTimer() {
    stopTimer()
    progress = 0
    timer = setInterval(() => {
      if (paused) return
      progress += TICK / DURATION
      if (progress >= 1) {
        next()
      }
    }, TICK)
  }

  function stopTimer() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function next() {
    if (currentStoryIndex < totalStories - 1) {
      currentStoryIndex++
      progress = 0
    } else if (currentAuthorIndex < authorDids.length - 1) {
      currentAuthorIndex++
      // currentStoryIndex reset by $effect
    } else {
      onclose()
    }
  }

  function prev() {
    if (currentStoryIndex > 0) {
      currentStoryIndex--
      progress = 0
    } else if (currentAuthorIndex > 0) {
      currentAuthorIndex--
      // currentStoryIndex reset by $effect
    }
  }

  function handleTap(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    if (x < rect.width / 3) {
      prev()
    } else {
      next()
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose()
    if (e.key === 'ArrowRight') next()
    if (e.key === 'ArrowLeft') prev()
  }

  $effect(() => {
    if (currentStory) startTimer()
    return () => stopTimer()
  })

  onMount(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
      stopTimer()
    }
  })
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="story-overlay">
  <div class="story-container" onclick={handleTap} role="button" tabindex="0">
    <!-- Progress bars -->
    <div class="progress-bars">
      {#each Array(totalStories) as _, i}
        <div class="progress-segment">
          <div
            class="progress-fill"
            style="width: {i < currentStoryIndex ? 100 : i === currentStoryIndex ? progress * 100 : 0}%"
          ></div>
        </div>
      {/each}
    </div>

    <!-- Header -->
    {#if currentStory}
      <div class="story-header">
        <div class="author-info">
          {#if currentStory.creator.avatar}
            <img class="author-avatar" src={currentStory.creator.avatar} alt="" />
          {/if}
          <span class="author-name">
            {currentStory.creator.displayName ?? currentStory.creator.handle}
          </span>
          <span class="story-time">
            {timeAgo(currentStory.createdAt)}
          </span>
        </div>
        <button class="close-btn" onclick={onclose}>
          <X size={24} />
        </button>
      </div>

      <!-- Image -->
      <div class="story-image-wrapper">
        <img
          class="story-image"
          src={currentStory.fullsize}
          alt=""
          style="aspect-ratio: {currentStory.aspectRatio.width}/{currentStory.aspectRatio.height}"
        />
      </div>

      <!-- Location overlay -->
      {#if currentStory.location}
        <div class="story-location">
          <MapPin size={12} />
          <span>{currentStory.location.name}</span>
        </div>
      {/if}
    {/if}
  </div>
</div>

<script context="module">
  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours < 1) {
      const mins = Math.floor(diff / (1000 * 60))
      return `${mins}m`
    }
    return `${hours}h`
  }
</script>

<style>
  .story-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: black;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .story-container {
    position: relative;
    width: 100%;
    max-width: 420px;
    height: 100%;
    display: flex;
    flex-direction: column;
    outline: none;
  }

  /* Progress bars */
  .progress-bars {
    display: flex;
    gap: 3px;
    padding: 8px 8px 0;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 10;
  }
  .progress-segment {
    flex: 1;
    height: 2px;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 1px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: white;
    transition: width 50ms linear;
  }

  /* Header */
  .story-header {
    position: absolute;
    top: 16px;
    left: 0;
    right: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
  }
  .author-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .author-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
  }
  .author-name {
    color: white;
    font-size: 14px;
    font-weight: 600;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  }
  .story-time {
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  }
  .close-btn {
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    padding: 4px;
    filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.5));
  }

  /* Image */
  .story-image-wrapper {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .story-image {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  /* Location */
  .story-location {
    position: absolute;
    bottom: 24px;
    left: 12px;
    display: flex;
    align-items: center;
    gap: 4px;
    color: white;
    font-size: 13px;
    background: rgba(0, 0, 0, 0.4);
    padding: 6px 10px;
    border-radius: 16px;
    backdrop-filter: blur(4px);
  }
</style>
```

---

### Task 10: StoryCreate Component

**Files:**

- Create: `app/lib/components/molecules/StoryCreate.svelte`

**Step 1: Create the story creation modal**

Minimal create flow: file picker → optional location → post. Opens as a modal overlay.

```svelte
<script lang="ts">
  import { X, MapPin, LoaderCircle } from 'lucide-svelte'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { callXrpc } from '$hatk/client'
  import { processPhotos, type ProcessedPhoto } from '$lib/utils/image-resize'
  import { reverseGeocode, formatLocationName, formatGeoContext } from '$lib/utils/nominatim'
  import { latLonToH3 } from '$lib/utils/h3'
  import LocationInput from '$lib/components/atoms/LocationInput.svelte'
  import type { LocationData } from '$lib/components/atoms/LocationInput.svelte'
  import Button from '$lib/components/atoms/Button.svelte'

  let { onclose }: { onclose: () => void } = $props()

  let photo = $state<ProcessedPhoto | null>(null)
  let location = $state<LocationData | null>(null)
  let processing = $state(false)
  let publishing = $state(false)
  let error = $state<string | null>(null)
  let fileInput: HTMLInputElement = $state()!

  const queryClient = useQueryClient()

  function openFilePicker() {
    fileInput?.click()
  }

  async function handleFileSelected(e: Event) {
    const input = e.target as HTMLInputElement
    const files = Array.from(input.files ?? [])
    input.value = ''
    if (files.length === 0) return

    try {
      processing = true
      error = null
      const processed = await processPhotos([files[0]])
      photo = processed[0]

      // Auto-suggest location from GPS
      const gps = photo.gps
      if (gps) {
        reverseGeocode(gps.latitude, gps.longitude).then((result) => {
          if (result) {
            const name = formatLocationName(result)
            const h3Index = latLonToH3(gps.latitude, gps.longitude)
            const region = formatGeoContext(result)
            location = { name, h3Index, ...(region ? { region } : {}) }
          }
        })
      }
    } catch (err) {
      error = 'Failed to process photo.'
      console.error(err)
    } finally {
      processing = false
    }
  }

  async function publish() {
    if (!photo || publishing) return
    publishing = true
    error = null

    try {
      const now = new Date().toISOString()
      const base64 = photo.dataUrl.split(',')[1]
      const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
      const blob = new Blob([binary], { type: 'image/jpeg' })

      const uploadResult = await callXrpc('dev.hatk.uploadBlob', blob as any)

      await callXrpc('dev.hatk.createRecord', {
        collection: 'social.grain.story',
        record: {
          media: (uploadResult as any).blob,
          aspectRatio: { width: photo.width, height: photo.height },
          ...(location
            ? {
                location: {
                  name: location.name,
                  value: location.h3Index,
                  ...(location.region ? { region: location.region } : {}),
                },
              }
            : {}),
          createdAt: now,
        },
      })

      queryClient.invalidateQueries({ queryKey: ['storyAuthors'] })
      onclose()
    } catch (err: any) {
      error = err.message || 'Failed to post story.'
    } finally {
      publishing = false
    }
  }
</script>

<div class="story-create-overlay">
  <div class="story-create">
    <div class="header">
      <button class="close" onclick={onclose}><X size={20} /></button>
      <span class="title">New Story</span>
      {#if photo}
        <Button disabled={publishing} onclick={publish}>
          {#if publishing}
            <LoaderCircle size={16} class="spin" /> Posting...
          {:else}
            Post
          {/if}
        </Button>
      {:else}
        <div></div>
      {/if}
    </div>

    {#if error}
      <p class="error">{error}</p>
    {/if}

    <input
      type="file"
      accept="image/*"
      bind:this={fileInput}
      onchange={handleFileSelected}
      style="display:none"
    />

    {#if !photo}
      <div class="select-area">
        <button class="select-btn" onclick={openFilePicker} disabled={processing}>
          {#if processing}
            <LoaderCircle size={24} class="spin" />
            <span>Processing...</span>
          {:else}
            <span>Select Photo</span>
          {/if}
        </button>
      </div>
    {:else}
      <div class="preview">
        <img src={photo.dataUrl} alt="Story preview" />
      </div>
      <div class="location-field">
        <LocationInput bind:value={location} placeholder="Add location..." />
      </div>
    {/if}
  </div>
</div>

<style>
  .story-create-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .story-create {
    width: 100%;
    max-width: 420px;
    max-height: 90vh;
    background: var(--bg-root);
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
  }
  .close {
    background: none;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
    padding: 4px;
  }
  .title {
    font-weight: 600;
    font-size: 16px;
    color: var(--text-primary);
  }
  .error {
    color: #f87171;
    padding: 8px 16px;
    margin: 0;
    text-align: center;
    font-size: 13px;
  }
  .select-area {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 300px;
    padding: 32px;
  }
  .select-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    background: var(--bg-hover);
    border: 2px dashed var(--border);
    border-radius: 16px;
    padding: 40px 48px;
    cursor: pointer;
    color: var(--text-primary);
    font-size: 16px;
    font-weight: 600;
    font-family: inherit;
  }
  .select-btn:hover { border-color: var(--grain); }
  .select-btn:disabled { cursor: not-allowed; opacity: 0.6; }
  .preview {
    flex: 1;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    max-height: 50vh;
  }
  .preview img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  .location-field {
    padding: 12px 16px;
  }
</style>
```

---

### Task 11: Wire Up Story Components in Home Feed

**Files:**

- Modify: `app/routes/+page.svelte`

**Step 1: Add story strip and viewer to the home page**

```svelte
<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query'
  import FeedList from '$lib/components/organisms/FeedList.svelte'
  import FeedTabs from '$lib/components/molecules/FeedTabs.svelte'
  import StoryStrip from '$lib/components/molecules/StoryStrip.svelte'
  import StoryViewer from '$lib/components/organisms/StoryViewer.svelte'
  import StoryCreate from '$lib/components/molecules/StoryCreate.svelte'
  import { recentFeedQuery } from '$lib/queries'

  const feed = createQuery(() => recentFeedQuery())

  let showViewer = $state(false)
  let viewerDid = $state('')
  let showCreate = $state(false)

  function openViewer(did: string) {
    viewerDid = did
    showViewer = true
  }

  function closeViewer() {
    showViewer = false
  }

  function openCreate() {
    showCreate = true
  }

  function closeCreate() {
    showCreate = false
  }
</script>

<FeedTabs />
<StoryStrip onCreateStory={openCreate} onViewStory={openViewer} />
{#if feed.isLoading}
  <FeedList feed="recent" skeleton />
{:else}
  <FeedList feed="recent" initialItems={feed.data?.items ?? []} initialCursor={feed.data?.cursor} />
{/if}

{#if showViewer}
  <StoryViewer initialDid={viewerDid} onclose={closeViewer} />
{/if}

{#if showCreate}
  <StoryCreate onclose={closeCreate} />
{/if}
```

---

### Task 12: Add Seed Data

**Files:**

- Modify: `seeds/seed.ts`

**Step 1: Add story records to seed data**

Add after the existing gallery seed data, before the end of the seed function. Create a couple of stories for Alice and Bob:

```typescript
// ── Stories ──

await createRecord(
  alice,
  "social.grain.story",
  {
    media: cityNight, // reuse existing blob
    aspectRatio: { width: 4, height: 3 },
    location: { name: "Shibuya Crossing", value: "8a2f5a363ba7fff", region: "Tokyo, Japan" },
    createdAt: new Date().toISOString(), // must be within 24h to be active
  },
  { rkey: "story-alice-1" },
);

await createRecord(
  bob,
  "social.grain.story",
  {
    media: forest, // reuse existing blob
    aspectRatio: { width: 4, height: 3 },
    createdAt: new Date().toISOString(),
  },
  { rkey: "story-bob-1" },
);
```

**Note:** Stories use `new Date().toISOString()` (current time) rather than `ago()` so they appear as active (within 24h) when seeded.

---

## Execution Order

1. **Tasks 1–3**: Lexicons (schema foundation)
2. **Task 4**: Config + regenerate types
3. **Tasks 5–6**: Server queries
4. **Task 7**: Client queries
5. **Tasks 8–10**: UI components (strip, viewer, create)
6. **Task 11**: Wire into home page
7. **Task 12**: Seed data for testing
