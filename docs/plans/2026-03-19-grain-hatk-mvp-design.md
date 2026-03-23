# Grain hatk Template — MVP Design

## Goal

Rebuild grain-next (Lit Web Components + GraphQL/Quickslice) as a hatk-powered SvelteKit app, using hatk-template-teal as the scaffold. MVP: shell + auth + timeline with gallery cards, running end-to-end.

## Source Projects

- **hatk-template-teal** (`~/code/hatk-template-teal`): SvelteKit 5 + hatk scaffold for teal.fm music tracker. Provides the application shell, auth flow, component architecture, and build tooling.
- **grain-next** (`~/code/grain-next`): Lit Web Components PWA for Grain photo sharing. Provides lexicons, data models, and feature reference.

## Architecture

### Stack

- SvelteKit 5 + Svelte 5 (from teal template)
- hatk framework (XRPC endpoints, feeds, OAuth, SQLite)
- TanStack Svelte Query (client-side data fetching/caching)
- Vite build tooling

### Key Translation

| grain-next                | hatk-template-grain          |
| ------------------------- | ---------------------------- |
| Lit Web Components        | Svelte 5 components          |
| GraphQL via Quickslice    | hatk XRPC + feeds            |
| Client-side SPA router    | SvelteKit file-based routing |
| Custom query/record cache | TanStack Svelte Query        |
| Quickslice OAuth          | hatk OAuth                   |

## Project Setup

1. Copy hatk-template-teal structure wholesale into hatk-template-grain.
2. Replace `lexicons/fm/teal/` with `lexicons/social/grain/` (copied from grain-next).
3. Keep `lexicons/app/bsky/`, `lexicons/com/atproto/`, `lexicons/dev/hatk/`.
4. Regenerate types with `npx hatk generate types`.
5. Update `hatk.config.ts`:
   - `signalCollections: ["social.grain.actor.profile"]`
   - OAuth scopes for all Grain collections (request upfront).
6. Update `package.json` name/description.

## Styling

Keep teal's dark theme and CSS variables unchanged. Tweak later.

## Routes (MVP)

```
app/routes/
├── +layout.svelte          # Shell (3-column, from teal)
├── +layout.server.ts       # Session parsing
├── +layout.ts              # Query client setup
├── +page.svelte            # Timeline (gallery cards)
├── +page.ts                # Timeline feed query
├── oauth/callback/         # OAuth redirect
└── profile/[did]/          # Profile page (placeholder)
```

## Server (MVP)

```
server/
├── feeds/
│   └── recent.ts           # Recent galleries feed
└── xrpc/                   # Empty for now
```

## Components

### Keep from teal (as-is)

- `Shell.svelte` — 3-column layout
- `Sidebar.svelte` — left nav (logo, home, auth)
- `SidebarRight.svelte` — right sidebar (strip trending artists/genres, keep search bar placeholder)
- `Avatar.svelte`, `Button.svelte`, `Skeleton.svelte`, `Modal.svelte` — generic atoms
- `AuthBar.svelte`, `LoginModal.svelte` — auth organisms

### Replace

| teal                    | grain                           |
| ----------------------- | ------------------------------- |
| `PlayCard.svelte`       | `GalleryCard.svelte`            |
| `ScrobbleModal.svelte`  | Remove                          |
| `BookmarkButton.svelte` | Remove                          |
| `FeedTabs.svelte`       | Simplify to single "Recent" tab |

### GalleryCard.svelte

Displays:

- Thumbnail grid (first ~4 photos from gallery)
- Gallery title
- Author chip (avatar + handle)
- Photo count

## Feed: Recent Galleries

**Server (`server/feeds/recent.ts`):**

- Query `social.grain.gallery` ordered by `created_at DESC`
- Hydrate with author profile (`social.grain.actor.profile`)
- Join `social.grain.gallery.item` for photo refs, then `social.grain.photo` for blobs/aspect ratios
- Cursor-based pagination

**Client:**

- `+page.ts` calls `dev.hatk.getFeed` with feed `recent`
- TanStack Query caches + paginates
- `+page.svelte` renders `GalleryCard` list

## Auth

Identical to teal's hatk OAuth flow. Update scopes to:

```
atproto
repo:social.grain.gallery
repo:social.grain.gallery.item
repo:social.grain.photo
repo:social.grain.actor.profile
repo:social.grain.graph.follow
repo:social.grain.favorite
repo:social.grain.comment
```

## hatk.config.ts

```typescript
signalCollections: ["social.grain.actor.profile"];
```

## What's Deferred

- Comments, favorites, notifications
- Search / explore
- Gallery create/edit UI
- Photo upload
- EXIF extraction
- Profile editing
- Follow/unfollow
- Rich text / facets
- PWA / service worker
- Custom accent color / branding
