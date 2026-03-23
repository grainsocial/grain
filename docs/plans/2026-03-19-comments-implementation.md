# Comments Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add gallery detail page with comment bottom sheet — view, create, reply, delete comments.

**Architecture:** New XRPC endpoint `getGalleryThread` fetches comments server-side. Gallery detail page at `/profile/[did]/gallery/[rkey]` reuses `GalleryCard` and opens a `CommentSheet` bottom sheet. Comments created/deleted via `callXrpc` with `dev.hatk.createRecord`/`dev.hatk.deleteRecord`.

**Tech Stack:** SvelteKit 5, Svelte 5 runes, hatk XRPC (`defineQuery`, `callXrpc`), TanStack Svelte Query.

---

### Task 1: Lexicon for getGalleryThread

**Files:**

- Create: `lexicons/social/grain/unspecced/getGalleryThread.json`

**Step 1: Create the lexicon definition**

Follow the same pattern as `lexicons/social/grain/unspecced/getActorProfile.json`.

```json
{
  "lexicon": 1,
  "id": "social.grain.unspecced.getGalleryThread",
  "defs": {
    "main": {
      "type": "query",
      "description": "Get comments for a gallery, sorted oldest-first with author profiles.",
      "parameters": {
        "type": "params",
        "required": ["gallery"],
        "properties": {
          "gallery": {
            "type": "string",
            "format": "at-uri",
            "description": "The gallery URI to fetch comments for."
          },
          "limit": { "type": "integer", "minimum": 1, "maximum": 100, "default": 20 },
          "cursor": { "type": "string" }
        }
      },
      "output": {
        "encoding": "application/json",
        "schema": {
          "type": "object",
          "required": ["comments"],
          "properties": {
            "comments": {
              "type": "array",
              "items": { "type": "ref", "ref": "social.grain.comment.defs#commentView" }
            },
            "cursor": { "type": "string" },
            "totalCount": { "type": "integer" }
          }
        }
      }
    }
  }
}
```

**Step 2: Regenerate hatk types**

Run: `npx hatk generate` (or whatever the project uses to regenerate `hatk.generated.ts` and `hatk.generated.client.ts` from lexicons).

Check that `social.grain.unspecced.getGalleryThread` appears in the `XrpcSchema` type in `hatk.generated.ts`.

---

### Task 2: Server-side getGalleryThread Endpoint

**Files:**

- Create: `server/xrpc/getGalleryThread.ts`

**Step 1: Create the XRPC handler**

Follow the pattern from `server/xrpc/getActorProfile.ts` using `defineQuery`. Use `ctx.db.query` for SQL, `ctx.lookup` for profiles, `ctx.blobUrl` for avatars, and the `views.commentView()` validator.

```typescript
import { defineQuery } from "$hatk";
import type { GrainActorProfile, Comment, Photo } from "$hatk";
import { views } from "$hatk";

export default defineQuery("social.grain.unspecced.getGalleryThread", async (ctx) => {
  const { ok, params, db, lookup, blobUrl, getRecords } = ctx;
  const { gallery, limit = 20, cursor } = params;

  // Count total comments for this gallery
  const countRows = (await db.query(
    `SELECT count(*) as cnt FROM "social.grain.comment" WHERE subject = $1`,
    [gallery],
  )) as { cnt: number }[];
  const totalCount = countRows[0]?.cnt ?? 0;

  // Fetch comments with cursor-based pagination (oldest first)
  let query = `SELECT uri, did, cid, value, created_at
    FROM "social.grain.comment"
    WHERE subject = $1`;
  const queryParams: any[] = [gallery];

  if (cursor) {
    query += ` AND created_at > $2`;
    queryParams.push(cursor);
  }

  query += ` ORDER BY created_at ASC LIMIT $${queryParams.length + 1}`;
  queryParams.push(limit + 1); // fetch one extra for cursor

  const rows = (await db.query(query, queryParams)) as Array<{
    uri: string;
    did: string;
    cid: string;
    value: any;
    created_at: string;
  }>;

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1]?.created_at : undefined;

  // Hydrate author profiles
  const dids = [...new Set(items.map((r) => r.did))];
  const profiles = await lookup<GrainActorProfile>("social.grain.actor.profile", "did", dids);

  // Hydrate focus photos
  const focusUris = items.map((r) => r.value.focus).filter(Boolean) as string[];
  const focusPhotos =
    focusUris.length > 0 ? await getRecords<Photo>("social.grain.photo", focusUris) : new Map();

  const comments = items.map((row) => {
    const author = profiles.get(row.did);
    const focusPhoto = row.value.focus ? focusPhotos.get(row.value.focus) : null;

    return views.commentView({
      uri: row.uri,
      cid: row.cid,
      text: row.value.text,
      facets: row.value.facets,
      replyTo: row.value.replyTo,
      createdAt: row.value.createdAt ?? row.created_at,
      author: author
        ? views.grainActorDefsProfileView({
            cid: author.cid,
            did: author.did,
            handle: author.handle ?? author.did,
            displayName: author.value.displayName,
            avatar: blobUrl(author.did, author.value.avatar) ?? undefined,
          })
        : views.grainActorDefsProfileView({
            cid: row.cid,
            did: row.did,
            handle: row.did,
          }),
      ...(focusPhoto
        ? {
            focus: views.photoView({
              uri: focusPhoto.uri,
              cid: focusPhoto.cid,
              thumb: blobUrl(focusPhoto.did, focusPhoto.value.photo, "feed_thumbnail") ?? "",
              fullsize: blobUrl(focusPhoto.did, focusPhoto.value.photo, "feed_fullsize") ?? "",
              alt: focusPhoto.value.alt,
              aspectRatio: focusPhoto.value.aspectRatio ?? { width: 4, height: 3 },
            }),
          }
        : {}),
    });
  });

  return ok({ comments, ...(nextCursor ? { cursor: nextCursor } : {}), totalCount });
});
```

**Step 2: Verify it compiles**

Run: `npm run dev` — hatk should auto-register the endpoint. Test with curl:

```
curl "http://127.0.0.1:3000/xrpc/social.grain.unspecced.getGalleryThread?gallery=at://did:plc:xxx/social.grain.gallery/xxx"
```

---

### Task 3: Query Helper and GalleryCard Modification

**Files:**

- Modify: `app/lib/queries.ts`
- Modify: `app/lib/components/molecules/GalleryCard.svelte`

**Step 1: Add query helper to `app/lib/queries.ts`**

Add after the existing queries:

```typescript
// ─── Gallery Thread (Comments) ──────────────────────────────────────

export const galleryThreadQuery = (galleryUri: string, f?: Fetch) =>
  queryOptions({
    queryKey: ["getGalleryThread", galleryUri],
    queryFn: () => callXrpc("social.grain.unspecced.getGalleryThread", { gallery: galleryUri }, f),
    staleTime: 30_000,
  });
```

**Step 2: Make GalleryCard comment button accept an onclick prop**

In `app/lib/components/molecules/GalleryCard.svelte`, change the props to accept an optional `onCommentClick` callback:

```typescript
let { gallery, onCommentClick }: { gallery: GalleryView; onCommentClick?: () => void } = $props();
```

Update the comment button (around line 140):

```svelte
<button class="stat" type="button" onclick={onCommentClick}>
  <MessageCircle size={18} />
  {#if commentCount > 0}<span class="stat-count">{commentCount}</span>{/if}
</button>
```

---

### Task 4: Comment Component

**Files:**

- Create: `app/lib/components/molecules/Comment.svelte`

**Step 1: Create the comment display component**

```svelte
<script lang="ts">
  import type { CommentView } from '$hatk/client'
  import Avatar from '../atoms/Avatar.svelte'
  import { relativeTime } from '$lib/utils'
  import { viewer } from '$lib/stores'

  let {
    comment,
    onReply,
    onDelete,
  }: {
    comment: CommentView
    onReply?: (uri: string, handle: string) => void
    onDelete?: (uri: string) => void
  } = $props()

  const isOwner = $derived($viewer?.did === comment.author?.did)
  const timeStr = $derived(relativeTime(comment.createdAt || ''))
  const isReply = $derived(!!comment.replyTo)
</script>

<div class="comment" class:reply={isReply}>
  <Avatar did={comment.author?.did ?? ''} src={comment.author?.avatar ?? null} size={28} />
  <div class="content">
    <div class="text-line">
      <a href="/profile/{comment.author?.did}" class="handle">{comment.author?.handle ?? comment.author?.did}</a>
      <span class="text">{comment.text}</span>
    </div>
    <div class="meta">
      <span class="time">{timeStr}</span>
      {#if onReply}
        <button class="meta-btn" onclick={() => onReply?.(comment.uri, comment.author?.handle ?? '')}>Reply</button>
      {/if}
      {#if isOwner && onDelete}
        <button class="meta-btn delete" onclick={() => onDelete?.(comment.uri)}>Delete</button>
      {/if}
    </div>
  </div>
  {#if comment.focus?.thumb}
    <img class="focus-thumb" src={comment.focus.thumb} alt={comment.focus?.alt ?? ''} />
  {/if}
</div>

<style>
  .comment {
    display: flex;
    gap: 10px;
    padding: 8px 0;
  }
  .comment.reply {
    padding-left: 38px;
  }
  .content {
    flex: 1;
    min-width: 0;
  }
  .text-line {
    font-size: 14px;
    color: var(--text-primary);
    line-height: 1.4;
    word-break: break-word;
  }
  .handle {
    font-weight: 600;
    text-decoration: none;
    color: inherit;
    margin-right: 6px;
  }
  .handle:hover { text-decoration: underline; }
  .text { }
  .meta {
    display: flex;
    gap: 12px;
    margin-top: 4px;
  }
  .time {
    font-size: 12px;
    color: var(--text-muted);
  }
  .meta-btn {
    font-size: 12px;
    color: var(--text-muted);
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-weight: 600;
    font-family: inherit;
  }
  .meta-btn:hover { color: var(--text-primary); }
  .meta-btn.delete:hover { color: #f87171; }
  .focus-thumb {
    width: 40px;
    height: 40px;
    border-radius: 4px;
    object-fit: cover;
    flex-shrink: 0;
  }
</style>
```

---

### Task 5: Comment Sheet Component

**Files:**

- Create: `app/lib/components/organisms/CommentSheet.svelte`

**Step 1: Create the bottom sheet**

This is the main comment interaction component. It handles:

- Fetching and displaying comments (organized: roots first, then replies)
- Posting new comments with rich text facet parsing
- Replying to comments
- Deleting own comments
- Pagination ("Load earlier comments")
- Focus photo indicator in input

```svelte
<script lang="ts">
  import type { CommentView } from '$hatk/client'
  import { callXrpc } from '$hatk/client'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { viewer } from '$lib/stores'
  import { parseTextToFacets } from '$lib/utils/rich-text'
  import CommentItem from '../molecules/Comment.svelte'
  import Avatar from '../atoms/Avatar.svelte'
  import { X, LoaderCircle } from 'lucide-svelte'

  let {
    open = false,
    galleryUri,
    focusPhotoUri = null,
    focusPhotoThumb = null,
    onClose,
  }: {
    open: boolean
    galleryUri: string
    focusPhotoUri?: string | null
    focusPhotoThumb?: string | null
    onClose: () => void
  } = $props()

  let comments = $state<CommentView[]>([])
  let totalCount = $state(0)
  let cursor = $state<string | undefined>(undefined)
  let loading = $state(false)
  let loadingMore = $state(false)
  let posting = $state(false)
  let inputValue = $state('')
  let replyToUri = $state<string | null>(null)
  let replyToHandle = $state<string | null>(null)
  let localFocusUri = $state<string | null>(null)
  let localFocusThumb = $state<string | null>(null)
  let error = $state<string | null>(null)
  let inputEl: HTMLInputElement

  const queryClient = useQueryClient()

  // Organize comments: roots first, then their replies
  const organized = $derived.by(() => {
    const roots = comments.filter((c) => !c.replyTo)
    const replyMap = new Map<string, CommentView[]>()
    for (const c of comments) {
      if (c.replyTo) {
        if (!replyMap.has(c.replyTo)) replyMap.set(c.replyTo, [])
        replyMap.get(c.replyTo)!.push(c)
      }
    }
    const result: CommentView[] = []
    for (const root of roots) {
      result.push(root)
      const replies = replyMap.get(root.uri) ?? []
      result.push(...replies)
    }
    return result
  })

  // Load comments when sheet opens
  $effect(() => {
    if (open && galleryUri) {
      localFocusUri = focusPhotoUri
      localFocusThumb = focusPhotoThumb
      loadComments()
    }
  })

  async function loadComments() {
    loading = true
    error = null
    try {
      const res = await callXrpc('social.grain.unspecced.getGalleryThread', {
        gallery: galleryUri,
        limit: 20,
      } as any)
      comments = (res as any).comments ?? []
      cursor = (res as any).cursor
      totalCount = (res as any).totalCount ?? 0
    } catch (err: any) {
      error = 'Failed to load comments'
      console.error(err)
    } finally {
      loading = false
    }
  }

  async function loadMore() {
    if (!cursor || loadingMore) return
    loadingMore = true
    try {
      const res = await callXrpc('social.grain.unspecced.getGalleryThread', {
        gallery: galleryUri,
        limit: 20,
        cursor,
      } as any)
      const older = (res as any).comments ?? []
      comments = [...older, ...comments]
      cursor = (res as any).cursor
    } catch (err: any) {
      console.error(err)
    } finally {
      loadingMore = false
    }
  }

  async function handlePost() {
    if (!inputValue.trim() || posting) return
    posting = true
    error = null

    try {
      const text = inputValue.trim()
      const now = new Date().toISOString()

      // Parse facets
      const parsed = await parseTextToFacets(text)
      const facets = parsed.facets.length > 0 ? parsed.facets : undefined

      const result = await callXrpc('dev.hatk.createRecord', {
        collection: 'social.grain.comment',
        record: {
          text,
          subject: galleryUri,
          ...(facets ? { facets } : {}),
          ...(replyToUri ? { replyTo: replyToUri } : {}),
          ...(localFocusUri ? { focus: localFocusUri } : {}),
          createdAt: now,
        },
      })

      // Optimistic add
      const newComment: CommentView = {
        uri: (result as any).uri,
        cid: (result as any).cid,
        text,
        facets,
        author: {
          did: $viewer!.did,
          handle: $viewer!.handle ?? $viewer!.did,
          displayName: $viewer!.displayName,
          avatar: $viewer!.avatar ?? undefined,
          cid: '',
        },
        replyTo: replyToUri ?? undefined,
        ...(localFocusUri && localFocusThumb
          ? { focus: { uri: localFocusUri, cid: '', thumb: localFocusThumb, fullsize: '', aspectRatio: { width: 1, height: 1 } } }
          : {}),
        createdAt: now,
      } as any

      comments = [...comments, newComment]
      totalCount++
      inputValue = ''
      replyToUri = null
      replyToHandle = null

      // Invalidate feed queries to update comment counts
      queryClient.invalidateQueries({ queryKey: ['getFeed'], refetchType: 'none' })
    } catch (err: any) {
      error = 'Failed to post comment'
      console.error(err)
    } finally {
      posting = false
    }
  }

  async function handleDelete(uri: string) {
    const rkey = uri.split('/').pop()!
    try {
      await callXrpc('dev.hatk.deleteRecord', {
        collection: 'social.grain.comment',
        rkey,
      })
      comments = comments.filter((c) => c.uri !== uri)
      totalCount--
      queryClient.invalidateQueries({ queryKey: ['getFeed'], refetchType: 'none' })
    } catch (err: any) {
      console.error('Failed to delete comment:', err)
    }
  }

  function handleReply(uri: string, handle: string) {
    replyToUri = uri
    replyToHandle = handle
    inputValue = `@${handle} `
    inputEl?.focus()
  }

  function clearFocus() {
    localFocusUri = null
    localFocusThumb = null
  }

  function cancelReply() {
    replyToUri = null
    replyToHandle = null
    inputValue = ''
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="overlay" onclick={onClose}></div>
  <div class="sheet">
    <div class="sheet-header">
      <span class="sheet-title">Comments</span>
      <button class="close-btn" onclick={onClose}>
        <X size={20} />
      </button>
    </div>

    <div class="comment-list">
      {#if cursor}
        <button class="load-more" onclick={loadMore} disabled={loadingMore}>
          {#if loadingMore}
            <LoaderCircle size={14} class="spin" /> Loading...
          {:else}
            Load earlier comments
          {/if}
        </button>
      {/if}

      {#if loading}
        <div class="empty"><LoaderCircle size={24} class="spin" /></div>
      {:else if organized.length === 0}
        <div class="empty">No comments yet. Be the first!</div>
      {:else}
        {#each organized as comment (comment.uri)}
          <CommentItem {comment} onReply={handleReply} onDelete={handleDelete} />
        {/each}
      {/if}
    </div>

    {#if error}
      <p class="error">{error}</p>
    {/if}

    {#if replyToHandle}
      <div class="reply-bar">
        <span>Replying to @{replyToHandle}</span>
        <button class="cancel-reply" onclick={cancelReply}>
          <X size={14} />
        </button>
      </div>
    {/if}

    <div class="input-bar">
      {#if $viewer}
        <Avatar did={$viewer.did} src={$viewer.avatar} size={28} />
      {/if}
      {#if localFocusThumb}
        <div class="focus-indicator">
          <img src={localFocusThumb} alt="Focused photo" />
          <button class="clear-focus" onclick={clearFocus}>&times;</button>
        </div>
      {/if}
      <div class="input-wrapper">
        <input
          type="text"
          placeholder="Add a comment..."
          bind:value={inputValue}
          bind:this={inputEl}
          disabled={posting}
          onkeydown={(e) => e.key === 'Enter' && handlePost()}
        />
        <button class="send-btn" onclick={handlePost} disabled={!inputValue.trim() || posting}>
          {#if posting}
            <LoaderCircle size={14} class="spin" />
          {:else}
            Post
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 200;
  }
  .sheet {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    max-height: 70vh;
    background: var(--bg-root);
    border-radius: 16px 16px 0 0;
    z-index: 201;
    display: flex;
    flex-direction: column;
  }
  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .sheet-title {
    font-weight: 600;
    font-size: 16px;
  }
  .close-btn {
    background: none;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
    padding: 4px;
    display: flex;
  }

  .comment-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px 16px;
  }
  .empty {
    text-align: center;
    color: var(--text-muted);
    padding: 32px 0;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .load-more {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    padding: 8px;
    margin-bottom: 8px;
    background: none;
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text-secondary);
    font-size: 13px;
    cursor: pointer;
    font-family: inherit;
  }
  .load-more:hover { background: var(--bg-hover); }
  .load-more:disabled { opacity: 0.5; cursor: not-allowed; }

  .error {
    color: #f87171;
    font-size: 13px;
    text-align: center;
    margin: 0;
    padding: 8px 16px;
  }

  .reply-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: var(--bg-hover);
    font-size: 13px;
    color: var(--text-secondary);
    border-top: 1px solid var(--border);
  }
  .cancel-reply {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 2px;
    display: flex;
  }

  .input-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }
  .focus-indicator {
    position: relative;
    flex-shrink: 0;
  }
  .focus-indicator img {
    width: 32px;
    height: 32px;
    border-radius: 4px;
    object-fit: cover;
  }
  .clear-focus {
    position: absolute;
    top: -4px;
    right: -4px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--text-primary);
    color: var(--bg-root);
    border: none;
    cursor: pointer;
    font-size: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }
  .input-wrapper {
    flex: 1;
    display: flex;
    align-items: center;
    background: var(--bg-hover);
    border-radius: 20px;
    padding: 6px 6px 6px 14px;
  }
  .input-wrapper input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    font-size: 14px;
    color: var(--text-primary);
    font-family: inherit;
  }
  .input-wrapper input::placeholder {
    color: var(--text-muted);
  }
  .send-btn {
    background: none;
    border: none;
    color: var(--grain);
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    padding: 4px 8px;
    font-family: inherit;
    display: flex;
    align-items: center;
  }
  .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  :global(.spin) {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
```

---

### Task 6: Gallery Detail Page

**Files:**

- Create: `app/routes/profile/[did]/gallery/[rkey]/+page.server.ts`
- Create: `app/routes/profile/[did]/gallery/[rkey]/+page.svelte`

**Step 1: Create the server-side auth guard and data loader**

`app/routes/profile/[did]/gallery/[rkey]/+page.server.ts`:

```typescript
import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ parent }) => {
  const { viewer } = await parent();
  if (!viewer) throw redirect(302, "/");
};
```

**Step 2: Create the detail page**

`app/routes/profile/[did]/gallery/[rkey]/+page.svelte`:

This page fetches the actor's galleries via the existing `actorFeedQuery`, finds the specific gallery by rkey, displays it with `GalleryCard`, and manages the `CommentSheet`.

```svelte
<script lang="ts">
  import { page } from '$app/state'
  import { createQuery } from '@tanstack/svelte-query'
  import { actorFeedQuery } from '$lib/queries'
  import GalleryCard from '$lib/components/molecules/GalleryCard.svelte'
  import CommentSheet from '$lib/components/organisms/CommentSheet.svelte'
  import type { GalleryView, PhotoView } from '$hatk/client'

  const did = $derived(decodeURIComponent(page.params.did))
  const rkey = $derived(page.params.rkey)

  const feed = createQuery(() => actorFeedQuery(did))

  const gallery = $derived.by(() => {
    const items = (feed.data as any)?.items as GalleryView[] | undefined
    if (!items) return null
    return items.find((g) => g.uri.endsWith(`/${rkey}`)) ?? null
  })

  let commentSheetOpen = $state(false)
  let focusPhotoUri = $state<string | null>(null)
  let focusPhotoThumb = $state<string | null>(null)

  function openComments() {
    // Get current photo from gallery if available
    const photos = (gallery?.items ?? []) as PhotoView[]
    if (photos.length > 0) {
      focusPhotoUri = photos[0].uri
      focusPhotoThumb = photos[0].thumb ?? null
    }
    commentSheetOpen = true
  }
</script>

<div class="detail-page">
  {#if feed.isLoading}
    <p class="loading">Loading...</p>
  {:else if !gallery}
    <p class="not-found">Gallery not found</p>
  {:else}
    <GalleryCard {gallery} onCommentClick={openComments} />

    <CommentSheet
      open={commentSheetOpen}
      galleryUri={gallery.uri}
      {focusPhotoUri}
      {focusPhotoThumb}
      onClose={() => { commentSheetOpen = false }}
    />
  {/if}
</div>

<style>
  .detail-page {
    max-width: 600px;
    margin: 0 auto;
  }
  .loading, .not-found {
    text-align: center;
    color: var(--text-muted);
    padding: 48px 16px;
    font-size: 14px;
  }
</style>
```

---

### Task 7: Link GalleryCard to Detail Page

**Files:**

- Modify: `app/lib/components/molecules/GalleryCard.svelte`

The gallery card title or the card itself should link to the detail page. Add a link on the title:

In the `card-content` section of GalleryCard.svelte, wrap the title in an anchor:

```svelte
<div class="card-content">
  <a href="/profile/{gallery.creator?.did}/gallery/{gallery.uri.split('/').pop()}" class="title-link">
    <p class="title">{gallery.title}</p>
  </a>
  {#if gallery.description}
    <p class="description">{gallery.description}</p>
  {/if}
  <time class="timestamp">{timeStr}</time>
</div>
```

Add style:

```css
.title-link {
  text-decoration: none;
  color: inherit;
}
.title-link:hover .title {
  text-decoration: underline;
}
```

---

### Task 8: End-to-End Verification

**Step 1: Full flow test**

1. Log in
2. Navigate to a gallery detail page via the title link on a GalleryCard
3. Click the comment icon → sheet opens
4. Post a comment → appears optimistically
5. Reply to a comment → input prefills with @handle
6. Delete your own comment → disappears
7. Close sheet, verify comment count updated

**Step 2: Edge cases**

1. Gallery with no comments → "No comments yet" empty state
2. Post with special characters / @mentions / URLs → facets parsed
3. Unauthenticated → redirects to home
4. Load more pagination (need >20 comments)
