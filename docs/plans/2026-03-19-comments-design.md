# Comments Feature Design

## Overview

Add gallery detail page with a comment bottom sheet, matching grain-next's UX adapted to SvelteKit + hatk.

## Gallery Detail Page

**Route:** `/profile/[did]/gallery/[rkey]`

- Auth required (server-side redirect like `/create`)
- Reuses existing `GalleryCard` component at the top
- Comment icon on card opens the bottom sheet
- Server-side load fetches gallery data + comment thread

## Comment Sheet (Bottom Sheet)

Slides up from bottom, overlays the page.

### Layout

- **Header:** "Comments" title + close button
- **Comment list:** Scrollable, oldest-first. Roots first, replies indented below parent (single-level threading)
- **Load earlier comments** button at top (cursor-based pagination, 20 per page)
- **Empty state:** "No comments yet. Be the first!"
- **Input bar** fixed at bottom: user avatar, optional focus photo thumbnail (with clear button), text input, Post button

### Each Comment

- Avatar, handle, comment text (with rich text facets), relative time
- Reply button, Delete button (owner only)
- Focus photo thumbnail (40x40) on the right if present

### Posting

1. User types text, taps Post
2. `callXrpc('dev.hatk.createRecord', { collection: 'social.grain.comment', record: { text, subject, focus?, replyTo?, facets?, createdAt } })`
3. Optimistically add comment to list
4. Parse text for facets (reuse `rich-text.ts`)

### Replies

- Tap Reply → prefill input with `@handle `, set `replyToUri`, focus input
- Reply appears indented below parent

### Deletion

- Tap Delete → `callXrpc('dev.hatk.deleteRecord', { collection: 'social.grain.comment', rkey })` → remove from list

## Server-Side: `social.grain.unspecced.getGalleryThread`

New XRPC endpoint in `server/xrpc/`:

- **Params:** `galleryUri`, `limit` (default 20), `cursor`
- **Query:** `social.grain.comment` records where `subject = galleryUri`, sorted `createdAt ASC`
- **Hydration:** Author profile (displayName, avatar), focus photo thumbnail
- **Response:** `{ comments: CommentView[], cursor?, totalCount }`

## New Files

- `server/xrpc/getGalleryThread.ts` — XRPC endpoint
- `lexicons/social/grain/unspecced/getGalleryThread.json` — Lexicon definition
- `app/routes/profile/[did]/gallery/[rkey]/+page.svelte` — Gallery detail page
- `app/routes/profile/[did]/gallery/[rkey]/+page.server.ts` — Auth guard + data loading
- `app/lib/components/organisms/CommentSheet.svelte` — Bottom sheet with comment list + input
- `app/lib/components/molecules/Comment.svelte` — Single comment display

## Modified Files

- `app/lib/components/molecules/GalleryCard.svelte` — Make comment button accept onclick handler
- `app/lib/queries.ts` — Add query for getGalleryThread

## Constraints

- Comment text max 300 graphemes / 3000 bytes
- Single-level threading only (replies to comments, not replies to replies)
- 20 comments per page
- Auth required to view and post
