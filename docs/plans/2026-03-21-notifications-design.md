# Notifications Design

## Overview

Add a notifications system to Grain, matching grain-next's approach: computed queries over existing records (favorites, comments, follows, mentions) with read/unread tracking via server-side timestamp.

## Notification Types

1. **gallery-favorite** — someone favorited your gallery
2. **gallery-comment** — someone commented on your gallery
3. **gallery-comment-mention** — someone mentioned you in a comment
4. **gallery-mention** — someone mentioned you in a gallery description
5. **reply** — someone replied to your comment
6. **follow** — someone followed you

## Data Layer

No new database tables. Notifications are computed by querying existing records where the target matches the viewer's DID:

- `social.grain.favorite` — `subject` is a gallery URI owned by viewer
- `social.grain.comment` — `subject` is a gallery URI owned by viewer, or facets contain a mention of viewer's DID
- `social.grain.comment` (reply) — `reply_to` references a comment by viewer
- `social.grain.graph.follow` — `subject` is viewer's DID
- `social.grain.gallery` — facets in description mention viewer's DID

### Read/Unread Tracking

Store a `lastSeenNotifications` ISO timestamp in `_preferences` via the existing `putPreference` endpoint. Notifications with `created_at` after this timestamp are "unseen."

## API

### New XRPC Query: `social.grain.unspecced.getNotifications`

- **Input:** viewer DID, cursor (optional), limit (default 20)
- **Output:** paginated edges with:
  - `reason`: one of the 6 notification types
  - `author`: hydrated profile (did, handle, displayName, avatar)
  - `subject`: gallery URI or comment URI (context-dependent)
  - `gallery`: hydrated gallery info (title, thumbnail) when applicable
  - `commentText`: comment text when applicable
  - `createdAt`: timestamp
  - `cursor`: for pagination
  - `unseenCount`: count of notifications newer than `lastSeenNotifications`

The query unions results from favorites, comments, follows, and galleries, sorted by `created_at` desc.

## UI

### Bell Icon

- **Desktop:** Left sidebar, between Home and Settings icons. Shows red badge with unseen count when > 0.
- **Mobile:** Bottom bar, between Create and Profile. Same badge behavior.

### Notifications Page (`/notifications`)

- Infinite scroll list, 20 items per page
- Each row: author avatar, action text, relative timestamp, context (gallery thumbnail, comment text)
- On mount: updates `lastSeenNotifications` to now, clears badge

### Notification Row Rendering by Type

| Type                    | Action Text                  | Context                                   |
| ----------------------- | ---------------------------- | ----------------------------------------- |
| gallery-favorite        | "favorited your gallery"     | Gallery title + thumbnail                 |
| gallery-comment         | "commented on your gallery"  | Comment text + gallery thumbnail          |
| gallery-comment-mention | "mentioned you in a comment" | Comment text + gallery thumbnail          |
| gallery-mention         | "mentioned you in a gallery" | Gallery description excerpt + thumbnail   |
| reply                   | "replied to your comment"    | Reply text + original comment + thumbnail |
| follow                  | "followed you"               | (none)                                    |

## State Management

### TanStack Query Keys

- `["notifications", did]` — paginated notification list (60s stale time)
- `["unseenNotificationCount", did]` — badge count (60s stale time)

### Mark-as-Read Flow

1. User navigates to `/notifications`
2. `onMount` calls `putPreference({ key: "lastSeenNotifications", value: now })`
3. Invalidates `["unseenNotificationCount"]` — badge clears
4. Optimistic update: set count to 0 immediately

## File Changes

### New Files

- `server/xrpc/getNotifications.ts` — XRPC query handler
- `app/routes/notifications/+page.svelte` — notifications page
- `app/lib/components/atoms/NotificationItem.svelte` — notification row component

### Modified Files

- `hatk.config.ts` — register new XRPC endpoint
- `app/lib/queries.ts` — notification list + unseen count queries
- `app/lib/components/organisms/Sidebar.svelte` — bell icon with badge
- `app/lib/components/molecules/MobileBottomBar.svelte` — bell icon with badge
