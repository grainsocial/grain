# Gallery Creation Feature Design

## Overview

Add gallery creation to hatk-template-grain, matching the UX flow from grain-next adapted to SvelteKit 5 + hatk.

## Create Flow

Single `/create` route with 3 steps managed by Svelte 5 `$state`:

### Step 1: Photo Selection

- "+" button in sidebar nav (desktop) and mobile bottom nav, visible only when authenticated
- Opens native file picker (images only, multiple selection, max 10)
- Client-side processing: resize to max 2000x2000px, compress to <900KB JPEG via binary search on quality
- Horizontal thumbnail strip with remove buttons

### Step 2: Gallery Metadata

- Title input (required, max 100 chars) — enables "Next" button
- Description textarea (optional, max 1000 chars)
- Description parsed for rich text facets (@mentions, URLs, hashtags)

### Step 3: Alt Text

- Each photo displayed with alt text input (max 1000 chars)
- Alt text is optional
- "Post" button publishes the gallery

Back navigation between steps preserves all state. Only a full page leave discards the draft.

## Publish Sequence

1. Upload each photo blob via hatk client (`agent.uploadBlob`)
2. Create `social.grain.photo` records (blob ref, dimensions, alt text, createdAt)
3. Create `social.grain.gallery` record (title, description, facets, createdAt)
4. Create `social.grain.gallery.item` records (gallery URI, photo URI, position index, createdAt)
5. On success: invalidate TanStack Query feed caches, navigate to home feed

## Error Handling

- Blob upload failure: stop, show error on that photo, allow retry
- Gallery record failure: stop, orphaned blobs acceptable (AT Protocol handles this)
- Gallery item link failure: partial gallery visible, allow retry
- Disable "Post" button during publish, show progress indicator

## New Files

- `app/routes/create/+page.svelte` — 3-step create flow
- `app/lib/utils/image-resize.ts` — `processPhotos()`, `resizeImage()`, `readFileAsDataURL()`
- `app/lib/utils/rich-text.ts` — `parseTextToFacets()` for mentions, URLs, hashtags

## Modified Files

- Sidebar/nav components — add "+" create button (auth-gated)
- `app/lib/queries.ts` — add mutation helpers for blob upload, photo/gallery/item creation

## Constraints

- Max 10 photos per gallery
- Max 2000x2000px resolution
- Max 900KB per compressed image
- Title max 100 chars
- Description max 1000 chars
- Alt text max 1000 chars per photo

## Draft State

No sessionStorage or external service needed. All draft state lives in `+page.svelte` via Svelte 5 `$state` runes since it's a single route.
