# Blocks and Mutes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Bluesky-style blocking and muting so users can control who they see and who can interact with them.

**Architecture:** Blocks are public AT Protocol records (like follows) stored in the user's repo — bidirectional, meaning neither party sees the other's content. Mutes are private server-side state (not records) — only hide content from the muter, the muted user never knows. Both filter feeds, notifications, and profile interactions.

**Tech Stack:** hatk (defineQuery, defineFeed, lexicons), SvelteKit 2, tanstack-query, Svelte 5 runes

---

### Task 1: Block Lexicon

**Files:**
- Create: `lexicons/social/grain/graph/block.json`

**Step 1: Create the block record lexicon**

```json
{
  "lexicon": 1,
  "id": "social.grain.graph.block",
  "defs": {
    "main": {
      "key": "tid",
      "type": "record",
      "record": {
        "type": "object",
        "required": ["subject", "createdAt"],
        "properties": {
          "subject": {
            "type": "string",
            "format": "did"
          },
          "createdAt": {
            "type": "string",
            "format": "datetime"
          }
        }
      }
    }
  }
}
```

This mirrors `social.grain.graph.follow` exactly — same structure, same key type (tid).

**Step 2: Regenerate types**

Run: `npx hatk generate types`
Expected: `Generated ./hatk.generated.ts` with new `GrainGraphBlock` type

**Step 3: Commit**

```bash
git add lexicons/social/grain/graph/block.json hatk.generated.ts hatk.generated.client.ts
git commit -m "feat: add social.grain.graph.block lexicon"
```

---

### Task 2: Mute XRPC Procedures

Mutes are server-side state, not records. We need a `_mutes` table and two XRPC procedures.

**Files:**
- Create: `server/xrpc/muteActor.ts`
- Create: `server/xrpc/unmuteActor.ts`
- Create: `lexicons/social/grain/graph/muteActor.json`
- Create: `lexicons/social/grain/graph/unmuteActor.json`

**Step 1: Create the muteActor lexicon**

```json
{
  "lexicon": 1,
  "id": "social.grain.graph.muteActor",
  "defs": {
    "main": {
      "type": "procedure",
      "description": "Mute an actor. Mutes are private and only affect the muter's feeds.",
      "input": {
        "encoding": "application/json",
        "schema": {
          "type": "object",
          "required": ["actor"],
          "properties": {
            "actor": {
              "type": "string",
              "format": "did"
            }
          }
        }
      }
    }
  }
}
```

**Step 2: Create the unmuteActor lexicon**

```json
{
  "lexicon": 1,
  "id": "social.grain.graph.unmuteActor",
  "defs": {
    "main": {
      "type": "procedure",
      "description": "Unmute an actor.",
      "input": {
        "encoding": "application/json",
        "schema": {
          "type": "object",
          "required": ["actor"],
          "properties": {
            "actor": {
              "type": "string",
              "format": "did"
            }
          }
        }
      }
    }
  }
}
```

**Step 3: Implement muteActor handler**

```typescript
// server/xrpc/muteActor.ts
import { defineQuery, InvalidRequestError } from "$hatk";

export default defineQuery("social.grain.graph.muteActor", async (ctx) => {
  const { ok, params, db, viewer } = ctx;
  if (!viewer) throw new InvalidRequestError("Authentication required");

  const { actor } = params;
  if (actor === viewer.did) throw new InvalidRequestError("Cannot mute yourself");

  await db.query(
    `INSERT INTO _mutes (did, subject, created_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (did, subject) DO NOTHING`,
    [viewer.did, actor, new Date().toISOString()],
  );

  return ok({});
});
```

**Step 4: Implement unmuteActor handler**

```typescript
// server/xrpc/unmuteActor.ts
import { defineQuery, InvalidRequestError } from "$hatk";

export default defineQuery("social.grain.graph.unmuteActor", async (ctx) => {
  const { ok, params, db, viewer } = ctx;
  if (!viewer) throw new InvalidRequestError("Authentication required");

  await db.query(
    `DELETE FROM _mutes WHERE did = $1 AND subject = $2`,
    [viewer.did, params.actor],
  );

  return ok({});
});
```

**Step 5: Create the _mutes table**

hatk auto-creates tables for records, but since mutes aren't records we need a migration. Check if hatk has a migration mechanism, or create the table via a startup hook. If neither exists, we can create it via a raw SQL initialization.

The table schema:
```sql
CREATE TABLE IF NOT EXISTS _mutes (
  did TEXT NOT NULL,
  subject TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (did, subject)
);
CREATE INDEX IF NOT EXISTS idx_mutes_did ON _mutes (did);
CREATE INDEX IF NOT EXISTS idx_mutes_subject ON _mutes (subject);
```

Check how the project handles custom tables (look for any existing `CREATE TABLE` statements or migration files). If hatk supports `ctx.db.query` for DDL, use an `on-start` hook or similar.

**Step 6: Regenerate types and commit**

Run: `npx hatk generate types`

```bash
git add lexicons/social/grain/graph/muteActor.json lexicons/social/grain/graph/unmuteActor.json \
  server/xrpc/muteActor.ts server/xrpc/unmuteActor.ts hatk.generated.ts hatk.generated.client.ts
git commit -m "feat: add mute/unmute actor XRPC procedures"
```

---

### Task 3: Extend Viewer State with Block/Mute Info

**Files:**
- Modify: `lexicons/social/grain/actor/defs.json` — add `blocking`, `blockedBy`, `muted` to `viewerState`
- Modify: `server/xrpc/getActorProfile.ts` — query block/mute relationships

**Step 1: Update viewerState in lexicon**

In `lexicons/social/grain/actor/defs.json`, update the `viewerState` definition:

```json
"viewerState": {
  "type": "object",
  "description": "Metadata about the requesting account's relationship with the subject account. Only has meaningful content for authed requests.",
  "properties": {
    "following": { "type": "string", "format": "at-uri" },
    "followedBy": { "type": "string", "format": "at-uri" },
    "blocking": { "type": "string", "format": "at-uri" },
    "blockedBy": { "type": "boolean" },
    "muted": { "type": "boolean" }
  }
}
```

- `blocking`: AT-URI of the viewer's block record (so client can delete it to unblock)
- `blockedBy`: boolean — the subject blocks the viewer
- `muted`: boolean — the viewer has muted the subject

**Step 2: Add block/mute queries to getActorProfile.ts**

In the `Promise.all` block (after the follow queries), add:

```typescript
// viewer blocks actor
ctx.db.query(
  `SELECT uri FROM "social.grain.graph.block" WHERE did = $1 AND subject = $2 LIMIT 1`,
  [viewer, actor],
) as Promise<{ uri: string }[]>,

// actor blocks viewer
ctx.db.query(
  `SELECT uri FROM "social.grain.graph.block" WHERE did = $1 AND subject = $2 LIMIT 1`,
  [actor, viewer],
) as Promise<{ uri: string }[]>,

// viewer mutes actor
ctx.db.query(
  `SELECT 1 FROM _mutes WHERE did = $1 AND subject = $2 LIMIT 1`,
  [viewer, actor],
) as Promise<{ 1: number }[]>,
```

Then in the response, extend the viewer object:

```typescript
viewer: {
  ...(viewerFollowing ? { following: viewerFollowing } : {}),
  ...(followedBy ? { followedBy } : {}),
  ...(viewerBlocking ? { blocking: viewerBlocking } : {}),
  ...(blockedBy ? { blockedBy: true } : {}),
  ...(viewerMuted ? { muted: true } : {}),
},
```

**Important behavior when blocked:** When `blockedBy` is true, strip out `following`/`followedBy` from viewer state (Bluesky convention — blocks hide the follow relationship). When `blocking` is set, also hide follows.

**Step 3: Regenerate types and commit**

Run: `npx hatk generate types`

```bash
git add lexicons/social/grain/actor/defs.json server/xrpc/getActorProfile.ts \
  hatk.generated.ts hatk.generated.client.ts
git commit -m "feat: return block/mute status in profile viewer state"
```

---

### Task 4: Filter Feeds by Blocks and Mutes

All feeds should exclude galleries from users the viewer has blocked or muted, and from users who have blocked the viewer.

**Files:**
- Create: `server/filters/blockMute.ts` — shared SQL filter helper
- Modify: `server/feeds/following.ts`
- Modify: `server/feeds/recent.ts`
- Modify: `server/feeds/foryou.ts`
- Modify: `server/feeds/camera.ts`
- Modify: `server/feeds/hashtag.ts`
- Modify: `server/feeds/location.ts`

**Step 1: Create shared filter helper**

```typescript
// server/filters/blockMute.ts

/**
 * Returns a SQL fragment that excludes rows from blocked/muted users.
 * @param didColumn - the column containing the gallery creator's DID (e.g. "t.did")
 * @param viewerParam - the SQL parameter number for the viewer DID (e.g. "$1")
 */
export function blockMuteFilter(didColumn: string, viewerParam: string): string {
  return `
    AND ${didColumn} NOT IN (
      SELECT subject FROM "social.grain.graph.block" WHERE did = ${viewerParam}
    )
    AND ${didColumn} NOT IN (
      SELECT did FROM "social.grain.graph.block" WHERE subject = ${viewerParam}
    )
    AND ${didColumn} NOT IN (
      SELECT subject FROM _mutes WHERE did = ${viewerParam}
    )
  `;
}
```

Three subqueries:
1. Users the viewer has blocked
2. Users who have blocked the viewer (bidirectional)
3. Users the viewer has muted

**Step 2: Add filter to following feed**

In `server/feeds/following.ts`, import `blockMuteFilter` and add it to the query. The actor param is `$1`, so:

```typescript
import { blockMuteFilter } from "../filters/blockMute.ts";

// In generate():
const { rows, cursor } = await ctx.paginate<{ uri: string }>(
  `SELECT t.uri, t.cid, t.created_at FROM "social.grain.gallery" t
   LEFT JOIN _repos r ON t.did = r.did
   WHERE (r.status IS NULL OR r.status != 'takendown')
     AND t.did IN (SELECT subject FROM "social.grain.graph.follow" WHERE did = $1)
     AND ${hideLabelsFilter("t.uri")}
     AND (SELECT count(*) FROM "social.grain.gallery.item" gi WHERE gi.gallery = t.uri) > 0
     ${blockMuteFilter("t.did", "$1")}`,
  { orderBy: "t.created_at", params: [actor] },
);
```

**Step 3: Add filter to recent feed**

The recent feed has no actor param. We need to conditionally add the filter only when there's a viewer. Pass the viewer DID as a param:

```typescript
import { blockMuteFilter } from "../filters/blockMute.ts";

async generate(ctx) {
  const viewer = ctx.params.actor; // viewer DID if authenticated
  const filterSql = viewer ? blockMuteFilter("t.did", "$1") : "";
  const filterParams = viewer ? [viewer] : [];

  const { rows, cursor } = await ctx.paginate<{ uri: string }>(
    `SELECT t.uri, t.cid, t.created_at FROM "social.grain.gallery" t
     LEFT JOIN _repos r ON t.did = r.did
     WHERE (r.status IS NULL OR r.status != 'takendown')
       AND ${hideLabelsFilter("t.uri")}
       AND (SELECT count(*) FROM "social.grain.gallery.item" gi WHERE gi.gallery = t.uri) > 0
       ${filterSql}`,
    { orderBy: "t.created_at", ...(filterParams.length ? { params: filterParams } : {}) },
  );

  return ctx.ok({ uris: rows.map((r) => r.uri), cursor });
},
```

**Step 4: Repeat for camera, hashtag, location, foryou feeds**

Same pattern — import `blockMuteFilter`, add the SQL fragment. For the For You feed which does scoring in JS, filter blocked/muted users from the candidate set before scoring.

Check each feed's param structure to use the correct parameter number.

**Step 5: Commit**

```bash
git add server/filters/blockMute.ts server/feeds/*.ts
git commit -m "feat: filter blocked and muted users from all feeds"
```

---

### Task 5: Filter Notifications by Blocks and Mutes

**Files:**
- Modify: `server/xrpc/getNotifications.ts`

**Step 1: Add block/mute filtering to notification queries**

Import the filter helper and add exclusions to each UNION branch in `notificationUnion()`. Each branch has a `did` column representing the notification author. Add:

```sql
AND did NOT IN (SELECT subject FROM "social.grain.graph.block" WHERE did = $1)
AND did NOT IN (SELECT did FROM "social.grain.graph.block" WHERE subject = $1)
AND did NOT IN (SELECT subject FROM _mutes WHERE did = $1)
```

Since `$1` is already the viewer DID in all branches, this works directly.

**Step 2: Commit**

```bash
git add server/xrpc/getNotifications.ts
git commit -m "feat: filter blocked and muted users from notifications"
```

---

### Task 6: Block/Mute UI — Profile Menu

**Files:**
- Modify: `app/routes/profile/[did]/+page.svelte` — add OverflowMenu with block/mute options
- Modify: `app/lib/queries.ts` — add block/mute mutation helpers if needed

**Step 1: Add three-dot menu to profile page**

In the `.actions` div where FollowButton lives, add an OverflowMenu with Block and Mute options. Pattern from GalleryCard.svelte:

```svelte
<OverflowMenu>
  <button class="menu-item" type="button" onclick={handleMute}>
    {p.viewer?.muted ? 'Unmute' : 'Mute'} @{p.handle}
  </button>
  <button class="menu-item danger" type="button" onclick={handleBlock}>
    {p.viewer?.blocking ? 'Unblock' : 'Block'} @{p.handle}
  </button>
</OverflowMenu>
```

**Step 2: Implement block handler**

Block creates a record (like follow):

```typescript
async function handleBlock() {
  if (!requireAuth()) return
  if (p.viewer?.blocking) {
    // Unblock — delete the record
    const rkey = p.viewer.blocking.split('/').pop()!
    await callXrpc('dev.hatk.deleteRecord', {
      collection: 'social.grain.graph.block',
      rkey,
    })
  } else {
    // Block — create the record
    await callXrpc('dev.hatk.createRecord', {
      collection: 'social.grain.graph.block',
      record: { subject: did, createdAt: new Date().toISOString() },
    })
  }
  queryClient.invalidateQueries({ queryKey: ['actorProfile', did] })
}
```

**Step 3: Implement mute handler**

Mute calls the procedure:

```typescript
async function handleMute() {
  if (!requireAuth()) return
  if (p.viewer?.muted) {
    await callXrpc('social.grain.graph.unmuteActor', { actor: did })
  } else {
    await callXrpc('social.grain.graph.muteActor', { actor: did })
  }
  queryClient.invalidateQueries({ queryKey: ['actorProfile', did] })
}
```

**Step 4: Show blocked state on profile**

When `p.viewer?.blockedBy` or `p.viewer?.blocking`, show a notice instead of the user's content:

```svelte
{#if p.viewer?.blocking}
  <div class="block-notice">
    <p>You have blocked this user.</p>
    <button onclick={handleBlock}>Unblock</button>
  </div>
{:else if p.viewer?.blockedBy}
  <div class="block-notice">
    <p>This user has blocked you.</p>
  </div>
{/if}
```

Hide the gallery tab content, followers count, etc. when either party blocks the other.

**Step 5: Commit**

```bash
git add app/routes/profile/[did]/+page.svelte app/lib/queries.ts
git commit -m "feat: add block and mute UI to profile page"
```

---

### Task 7: Block/Mute Settings Pages

**Files:**
- Create: `app/routes/settings/blocked/+page.svelte` — list of blocked users
- Create: `app/routes/settings/blocked/+page.ts` — loader
- Create: `app/routes/settings/muted/+page.svelte` — list of muted users
- Create: `app/routes/settings/muted/+page.ts` — loader
- Create: `server/xrpc/getBlocks.ts` — XRPC to list blocked users
- Create: `server/xrpc/getMutes.ts` — XRPC to list muted users
- Create: `lexicons/social/grain/unspecced/getBlocks.json`
- Create: `lexicons/social/grain/unspecced/getMutes.json`

**Step 1: Create getBlocks XRPC**

```typescript
// server/xrpc/getBlocks.ts
import { defineQuery, InvalidRequestError } from "$hatk";
import type { GrainActorProfile } from "$hatk";
import { views } from "$hatk";

export default defineQuery("social.grain.unspecced.getBlocks", async (ctx) => {
  const { ok, params, db, viewer, lookup, blobUrl } = ctx;
  if (!viewer) throw new InvalidRequestError("Authentication required");

  const limit = params.limit ?? 50;
  const rows = (await db.query(
    `SELECT b.subject, b.uri, b.created_at
     FROM "social.grain.graph.block" b
     WHERE b.did = $1
     ORDER BY b.created_at DESC
     LIMIT $2`,
    [viewer.did, limit],
  )) as { subject: string; uri: string; created_at: string }[];

  const dids = rows.map((r) => r.subject);
  const profiles = await lookup<GrainActorProfile>("social.grain.actor.profile", "did", dids);

  const blocks = rows.map((row) => {
    const profile = profiles.get(row.subject);
    return {
      blockUri: row.uri,
      actor: profile
        ? views.grainActorDefsProfileView({
            cid: profile.cid,
            did: profile.did,
            handle: profile.handle ?? profile.did,
            displayName: profile.value.displayName,
            avatar: blobUrl(profile.did, profile.value.avatar) ?? undefined,
          })
        : views.grainActorDefsProfileView({
            cid: "",
            did: row.subject,
            handle: row.subject,
          }),
    };
  });

  return ok({ blocks });
});
```

**Step 2: Create getMutes XRPC** (similar pattern, querying `_mutes` table)

**Step 3: Create settings pages**

Each page shows a list of blocked/muted users with their avatar, name, handle, and an Unblock/Unmute button. Follow the pattern of existing settings pages in the app.

**Step 4: Add navigation links to settings**

Check the existing settings layout/nav and add "Blocked users" and "Muted users" links.

**Step 5: Commit**

```bash
git add server/xrpc/getBlocks.ts server/xrpc/getMutes.ts \
  lexicons/social/grain/unspecced/getBlocks.json lexicons/social/grain/unspecced/getMutes.json \
  app/routes/settings/blocked/ app/routes/settings/muted/ \
  hatk.generated.ts hatk.generated.client.ts
git commit -m "feat: add blocked/muted user settings pages"
```

---

### Task 8: Prevent Interactions When Blocked

**Files:**
- Modify: `server/xrpc/getGalleryThread.ts` (or equivalent gallery detail handler) — check blocks before returning
- Modify: gallery comment submission handler — reject comments from blocked users
- Modify: favorite handler — reject favorites from blocked users

**Step 1: Add block checks to interaction endpoints**

When user A has blocked user B:
- B cannot favorite A's galleries
- B cannot comment on A's galleries
- B cannot follow A (and vice versa)

Check the commit hooks (`server/hooks/`) for any `on-commit-*` handlers that should also respect blocks.

In comment/favorite creation, add a pre-check:

```typescript
// Check if gallery owner has blocked the commenter
const blockRows = await db.query(
  `SELECT 1 FROM "social.grain.graph.block"
   WHERE (did = $1 AND subject = $2) OR (did = $2 AND subject = $1) LIMIT 1`,
  [galleryOwnerDid, viewer.did],
);
if (blockRows.length > 0) {
  throw new InvalidRequestError("Blocked");
}
```

**Step 2: Commit**

```bash
git add server/xrpc/*.ts server/hooks/*.ts
git commit -m "feat: prevent interactions between blocked users"
```

---

### Task 9: Seed Data and Manual Testing

**Files:**
- Modify: `seeds/seed.ts` — add block and mute relationships for testing

**Step 1: Add test data**

Add blocks and mutes to the seed:
- Alice blocks Eve (or a new test user)
- Bob mutes Carol
- This lets us verify feed filtering and profile states

**Step 2: Test manually**

1. Reseed: `npx hatk seed` (or however seeds are run)
2. Log in as Alice → verify Eve's galleries don't appear in feeds
3. View Eve's profile → should show "You have blocked this user"
4. Log in as Bob → verify Carol's galleries are hidden from feeds
5. View Carol's profile → should look normal (mutes are invisible to muted user)
6. Check notifications → blocked/muted user actions should be hidden

**Step 3: Commit**

```bash
git add seeds/seed.ts
git commit -m "test: add block and mute seed data"
```
