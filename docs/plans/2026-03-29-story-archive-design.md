# Story Archive Design

## Summary

Add a private story archive on the user's own profile page, allowing them to browse and view all past stories (not just the last 24 hours). Old story records already persist in the database — this feature surfaces them.

## Data Layer

**New XRPC endpoint: `social.grain.unspecced.getStoryArchive`**

- Params: `actor` (DID, required), `limit` (default 50), `cursor` (string, optional)
- Returns: `{ stories: StoryView[], cursor?: string }`
- Same logic as `getStories` but without the 24-hour cutoff
- Ordered by `created_at DESC` (newest first)
- Cursor-based pagination (cursor is the `created_at` of the last item)
- Applies label moderation (hide-severity filtering) and cross-post hydration

Client query: `storyArchiveQuery(did, cursor?)` in `queries.ts`.

## UI

**Entry point:** A button on the profile page, visible only when `isOwnProfile`. Small archive/clock icon with "Story Archive" label.

**Archive grid:** Inline collapsible section on the profile page.

- 3-column grid of square thumbnails using the story `thumb` URL
- Date overlay on each thumbnail (e.g., "Mar 15")
- Tap opens StoryViewer for that single story
- Infinite scroll with cursor pagination
- Empty state: "No stories yet"

**StoryViewer adjustments:**

- When opened from archive, show a single story (no author swiping)
- Existing delete button works as-is
- `timeAgo` updated to show full date (e.g., "Mar 15") for stories older than 24 hours

## Files

**New:**
- `server/xrpc/getStoryArchive.ts`
- `lexicons/social/grain/unspecced/getStoryArchive.json`
- `app/lib/components/molecules/StoryArchive.svelte`

**Modified:**
- `app/lib/queries.ts` — add `storyArchiveQuery`
- `app/routes/profile/[did]/+page.svelte` — archive button + grid section
- `app/lib/components/organisms/StoryViewer.svelte` — single-story mode, full date for old stories

## Out of Scope

- Highlights / pinning stories to profile
- Separate `/profile/{did}/stories` route
- Retention limits or bulk delete
- Archive visible to other users
