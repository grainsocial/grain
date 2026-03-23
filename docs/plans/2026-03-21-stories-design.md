# Stories Design

## Overview

Ephemeral photo posts that disappear after 24 hours. Lower friction than galleries — just pick a photo, optionally tag a location, and post. Stories encourage casual, frequent sharing alongside the more intentional gallery format.

## Data Model

### Record: `social.grain.story`

```json
{
  "type": "record",
  "key": "tid",
  "record": {
    "required": ["media", "aspectRatio", "createdAt"],
    "properties": {
      "media": { "type": "blob", "accept": ["image/*", "video/*"], "maxSize": 5000000 },
      "aspectRatio": { "ref": "social.grain.defs#aspectRatio" },
      "location": { "ref": "social.grain.defs#location" },
      "createdAt": { "type": "string", "format": "datetime" }
    }
  }
}
```

- One record = one photo (or video in the future).
- **Active stories** = records where `createdAt > now - 24h`. No expiry field — computed at query time.
- Records stay in the repo permanently. The app view only serves active ones by default.
- V1 is images only. Video support requires no schema changes.

### View: `social.grain.story.defs#storyView`

```
uri, cid, creator (profileView), thumb, fullsize, aspectRatio, location?, createdAt
```

## Server

### XRPC Queries

**`social.grain.unspecced.getStoryAuthors`**

- Returns authors with active stories, ordered by most recent post.
- Each entry: `profileView` + story count.
- Used by the story strip.

**`social.grain.unspecced.getStories`**

- Params: `did` (required).
- Returns that author's active stories in chronological order as `storyView[]`.
- Used by the full-screen viewer.

### New Lexicons

- `lexicons/social/grain/story.json`
- `lexicons/social/grain/story/defs.json`
- `lexicons/social/grain/unspecced/getStoryAuthors.json`
- `lexicons/social/grain/unspecced/getStories.json`

### Cleanup

Old stories remain in the AT Protocol repo (no auto-deletion). The app view simply stops serving them after 24h. A background cleanup job is not needed for v1.

## Client UI

### Story Strip

- Horizontal scrollable row at the top of the home feed.
- First circle: "+" with the user's own avatar for creating a story.
- Remaining circles: authors with active stories, avatar with a colored ring.
- Tap opens the full-screen story viewer for that author.

### Story Viewer (Full-Screen Overlay)

- Photo fills the screen with a dark background.
- **Progress bars at top**: thin segmented bar, one segment per story from that author. Current segment fills left-to-right over 5 seconds, then auto-advances.
- Author name/avatar overlaid at top below progress bars.
- Location tag overlaid if present.
- **Navigation**: tap right side = next, tap left side = previous. Last tap advances to next author. Swipe to skip author.
- Close button (X) top-right.
- No interactions (hearts, replies) in v1. View-only.

### Story Creation

- Triggered from the "+" circle in the story strip.
- Opens a file picker (single photo for v1).
- Optional location tag (reuses `LocationInput` component).
- Post button. No title, no description.
- Could be a modal or a minimal page.

### New Components

- `StoryStrip.svelte` — horizontal avatar row for the feed.
- `StoryViewer.svelte` — full-screen overlay with progress bars and navigation.
- `StoryCreate.svelte` — simplified create flow (modal or page).

### Queries (in `queries.ts`)

- `storyAuthorsQuery()` — feeds the story strip.
- `storiesQuery(did)` — feeds the viewer.

## Decisions

- **24-hour expiry**, computed not stored.
- **No grouping/containers** — a "story" in the viewing sense is just all of a user's story records from the last 24h.
- **`social.grain.story`** namespace (not beta/unspecced) — ephemeral nature makes namespace caution less important.
- **Images only for v1** — schema accepts video MIME types for future support.
- **No interactions for v1** — view count could be added later, reactions/replies after that.
- **No dedicated route** — viewer is an overlay, not a page.
