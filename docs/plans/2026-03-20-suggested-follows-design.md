# Suggested Follows Design

**Goal:** Show a "Suggested for you" card strip in the feed that recommends grain profiles based on the viewer's bsky follows.

**Architecture:** Sync `app.bsky.graph.follow` records via hatk, add an XRPC endpoint that cross-references bsky follows with grain profiles, and render a horizontal card strip in FeedList after the 5th gallery.

## Data Layer

### Sync bsky follows

Add `repo:app.bsky.graph.follow` to `grainScopes` in `hatk.config.ts`. This auto-syncs bsky follow records from the firehose into an `app.bsky.graph.follow` table.

### XRPC: getSuggestedFollows

Endpoint: `social.grain.unspecced.getSuggestedFollows`

Parameters: `actor` (DID), `limit` (default 10)

Query logic:

1. Find DIDs where: viewer bsky-follows them AND they have a grain profile AND viewer does NOT grain-follow them
2. If fewer than `limit` results, backfill with other grain profiles the viewer doesn't follow (ordered by follower count descending)
3. Exclude the viewer themselves

Returns: array of profile views (did, handle, displayName, description, avatar, followerCount).

## UI Component

### SuggestedFollows.svelte

Horizontal scrolling card strip:

- Header: "Suggested for you"
- Cards: ~170px wide, avatar (64px), display name, description (2-line clamp), existing FollowButton, dismiss X button
- Dismiss: session-only (local state array), card removed with animation
- Hides entirely when all cards dismissed or followed

### FeedList integration

After the 5th GalleryCard, render `<SuggestedFollows />` if viewer is authenticated. Component fetches its own data via tanstack query. Client-side insertion only — no server feed changes.

## Seed data

Add bsky follow records so suggestions appear in dev: alice bsky-follows bob/carol, bob bsky-follows alice. Remove some grain follows so there are suggestions to show.
