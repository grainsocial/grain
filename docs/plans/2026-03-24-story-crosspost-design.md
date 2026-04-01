# Story Cross-Posting & Permalinks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add story permalinks, Bluesky cross-posting for stories, and extract shared Bluesky posting logic into a reusable utility.

**Architecture:** Extract Bluesky post creation from gallery create into `$lib/utils/bsky-post.ts`. Add story permalink route at `/profile/[did]/story/[rkey]`. Add "Post to Bluesky" checkbox to StoryCreate. Add cross-post hydration to story views.

**Tech Stack:** SvelteKit, TanStack Query, hatk (AT Protocol framework), Bluesky API

---

### Task 1: Extract shared Bluesky post utility

**Files:**

- Create: `app/lib/utils/bsky-post.ts`
- Modify: `app/routes/create/+page.svelte` (lines 187-275)

**Step 1: Create `app/lib/utils/bsky-post.ts`**

This extracts the Bluesky posting logic from gallery create into a reusable function.

```ts
import { callXrpc } from "$hatk/client";
import { parseTextToFacets } from "$lib/utils/rich-text";

interface BskyPostOptions {
  /** The grain permalink URL */
  url: string;
  /** Optional location data */
  location?: {
    name: string;
    address?: {
      locality?: string;
      region?: string;
      country?: string;
    };
  } | null;
  /** Optional description text (will be truncated to fit 300 grapheme limit) */
  description?: string;
  /** Images to embed (max 4 for Bluesky) */
  images: Array<{
    dataUrl: string;
    alt?: string;
    width: number;
    height: number;
  }>;
}

export async function createBskyPost(options: BskyPostOptions): Promise<void> {
  const { url, location, description, images } = options;

  const graphemeLength = (s: string) => [...new Intl.Segmenter().segment(s)].length;

  const lines: string[] = [];
  if (location) {
    lines.push(`📍 ${location.name}`);
    if (location.address) {
      const parts: string[] = [];
      if (location.address.locality) parts.push(location.address.locality);
      if (location.address.region) parts.push(location.address.region);
      if (location.address.country) parts.push(location.address.country);
      if (parts.length > 0) lines.push(parts.join(", "));
    }
  }

  const suffix = `\n\n${url}\n\n#grainsocial`;
  const prefixText = lines.length > 0 ? lines.join("\n") + "\n" : "";
  const overhead = graphemeLength(prefixText + suffix);
  const maxDesc = 300 - overhead;

  if (description?.trim()) {
    let desc = description.trim();
    if (graphemeLength(desc) > maxDesc) {
      const segments = [...new Intl.Segmenter().segment(desc)];
      desc =
        segments
          .slice(0, Math.max(0, maxDesc - 1))
          .map((s) => s.segment)
          .join("") + "…";
    }
    if (desc) {
      lines.push("");
      lines.push(desc);
    }
  }
  lines.push("");
  lines.push(url);
  lines.push("");
  lines.push("#grainsocial");

  const postText = lines.join("\n");

  // Resolve Bluesky handles for mentions
  const resolveHandle = async (handle: string): Promise<string | null> => {
    try {
      const res = await fetch(
        `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`,
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data.did ?? null;
    } catch {
      return null;
    }
  };
  const postFacets = (await parseTextToFacets(postText, resolveHandle)).facets;

  // Upload images (max 4)
  const imageRefs: Array<{
    image: any;
    alt: string;
    aspectRatio?: { width: number; height: number };
  }> = [];
  for (const img of images.slice(0, 4)) {
    const base64 = img.dataUrl.split(",")[1];
    const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const blob = new Blob([binary], { type: "image/jpeg" });
    const uploadResult = await callXrpc("dev.hatk.uploadBlob", blob as any);
    imageRefs.push({
      image: (uploadResult as any).blob,
      alt: img.alt || "",
      aspectRatio: { width: img.width, height: img.height },
    });
  }

  await callXrpc("dev.hatk.createRecord", {
    collection: "app.bsky.feed.post",
    record: {
      $type: "app.bsky.feed.post",
      text: postText,
      facets: postFacets.length > 0 ? postFacets : undefined,
      embed:
        imageRefs.length > 0 ? { $type: "app.bsky.embed.images", images: imageRefs } : undefined,
      tags: ["grainsocial"],
      createdAt: new Date().toISOString(),
    },
  });
}
```

**Step 2: Refactor gallery create to use the shared utility**

In `app/routes/create/+page.svelte`, replace lines 187-275 (the `if (postToBluesky && $viewer)` block) with:

```ts
import { createBskyPost } from "$lib/utils/bsky-post";

// ... inside publish(), after step 4 (gallery items created):

// 5. Create Bluesky post if opted in
if (postToBluesky && $viewer) {
  const galleryRkey = galleryUri.split("/").pop();
  const galleryUrl = `https://grain.social/profile/${$viewer.did}/gallery/${galleryRkey}`;
  await createBskyPost({
    url: galleryUrl,
    location: location
      ? {
          name: location.name,
          address: location.address,
        }
      : null,
    description: description.trim() || undefined,
    images: photos,
  });
}
```

**Step 3: Verify the gallery create flow still works**

Run: `cd /Users/chadmiller/code/grain && node /Users/chadmiller/code/hatk/packages/hatk/dist/cli.js dev`
Expected: Dev server starts, gallery creation with "Post to Bluesky" still functions.

**Step 4: Commit**

```bash
git add app/lib/utils/bsky-post.ts app/routes/create/+page.svelte
git commit -m "refactor: extract shared Bluesky post utility from gallery create"
```

---

### Task 2: Add story permalink route

**Files:**

- Create: `app/routes/profile/[did]/story/[rkey]/+page.ts`
- Create: `app/routes/profile/[did]/story/[rkey]/+page.svelte`

**Step 1: Create the page load file**

`app/routes/profile/[did]/story/[rkey]/+page.ts` — follows same pattern as gallery `+page.ts`:

```ts
import { browser } from "$app/environment";
import { storyQuery } from "$lib/queries";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params, parent, fetch }) => {
  const did = decodeURIComponent(params.did);
  const rkey = params.rkey;
  const storyUri = `at://${did}/social.grain.story/${rkey}`;
  const { queryClient } = await parent();
  const prefetch = queryClient.prefetchQuery(storyQuery(storyUri, fetch));
  if (!browser) await prefetch;
  return { did, rkey, storyUri };
};
```

**Step 2: Add `storyQuery` to `app/lib/queries.ts`**

Add after the existing `storiesQuery`:

```ts
export const storyQuery = (storyUri: string, f?: Fetch) =>
  queryOptions({
    queryKey: ["getStory", storyUri],
    queryFn: () =>
      callXrpc("social.grain.unspecced.getStory", { story: storyUri }, f).then(
        (r) => r?.story ?? null,
      ),
    staleTime: 60_000,
  });
```

**Step 3: Create the XRPC endpoint `server/xrpc/getStory.ts`**

This is like `getStories.ts` but fetches a single story by URI with NO 24h filter:

```ts
import { defineQuery } from "$hatk";
import { views } from "$hatk";
import type { GrainActorProfile, Story } from "$hatk";

export default defineQuery("social.grain.unspecced.getStory", async (ctx) => {
  const { db, ok } = ctx;
  const storyUri = ctx.params.story;
  if (!storyUri) return ok({ story: null });

  const rows = (await db.query(
    `SELECT uri, cid, did, media, aspect_ratio, location, address, created_at
     FROM "social.grain.story"
     WHERE uri = $1`,
    [storyUri],
  )) as {
    uri: string;
    cid: string;
    did: string;
    media: string;
    aspect_ratio: string;
    location: string | null;
    address: string | null;
    created_at: string;
  }[];

  const row = rows[0];
  if (!row) return ok({ story: null });

  // Resolve author profile
  const profiles = await ctx.lookup<GrainActorProfile>("social.grain.actor.profile", "did", [
    row.did,
  ]);
  const author = profiles.get(row.did);
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
        did: row.did,
        handle: row.did,
      });

  let blobRef: any;
  try {
    blobRef = typeof row.media === "string" ? JSON.parse(row.media) : row.media;
  } catch {
    blobRef = row.media;
  }

  let aspectRatio: { width: number; height: number };
  try {
    aspectRatio =
      typeof row.aspect_ratio === "string" ? JSON.parse(row.aspect_ratio) : row.aspect_ratio;
  } catch {
    aspectRatio = { width: 4, height: 3 };
  }

  let location: Story["location"] | null = null;
  if (row.location) {
    try {
      location = typeof row.location === "string" ? JSON.parse(row.location) : row.location;
    } catch {
      location = null;
    }
  }

  let address: Story["address"] | null = null;
  if (row.address) {
    try {
      address = typeof row.address === "string" ? JSON.parse(row.address) : row.address;
    } catch {
      address = null;
    }
  }

  // Cross-post lookup
  let crossPost: { url: string } | undefined;
  const rkey = row.uri.split("/").pop();
  const searchUrl = `grain.social/profile/${row.did}/story/${rkey}`;
  const postRows = (await db.query(
    `SELECT uri FROM "app.bsky.feed.post" WHERE did = $1 AND "text" LIKE '%' || $2 || '%' LIMIT 1`,
    [row.did, searchUrl],
  )) as Array<{ uri: string }>;
  if (postRows.length) {
    const postRkey = postRows[0].uri.split("/").pop();
    crossPost = { url: `https://bsky.app/profile/${row.did}/post/${postRkey}` };
  }

  const story = views.storyView({
    uri: row.uri,
    cid: row.cid,
    creator: profileView,
    thumb: ctx.blobUrl(row.did, blobRef, "feed_thumbnail") ?? "",
    fullsize: ctx.blobUrl(row.did, blobRef, "feed_fullsize") ?? "",
    aspectRatio,
    ...(location
      ? {
          location: { name: location.name, value: location.value },
          ...(address ? { address } : {}),
        }
      : {}),
    ...(crossPost ? { crossPost } : {}),
    createdAt: row.created_at,
  });

  return ok({ story });
});
```

**Step 4: Create the lexicon `lexicons/social/grain/unspecced/getStory.json`**

```json
{
  "lexicon": 1,
  "id": "social.grain.unspecced.getStory",
  "defs": {
    "main": {
      "type": "query",
      "parameters": {
        "type": "params",
        "required": ["story"],
        "properties": {
          "story": { "type": "string", "format": "at-uri" }
        }
      },
      "output": {
        "encoding": "application/json",
        "schema": {
          "type": "object",
          "properties": {
            "story": { "type": "ref", "ref": "social.grain.story.defs#storyView" }
          }
        }
      }
    }
  }
}
```

**Step 5: Add `crossPost` to `storyView` in `lexicons/social/grain/story/defs.json`**

Add to properties:

```json
"crossPost": { "type": "ref", "ref": "social.grain.gallery.defs#crossPostInfo" }
```

**Step 6: Create the permalink page `app/routes/profile/[did]/story/[rkey]/+page.svelte`**

```svelte
<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query'
  import { storyQuery } from '$lib/queries'
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'
  import { MapPin } from 'lucide-svelte'
  import type { StoryView } from '$hatk/client'

  let { data } = $props()

  const storyUri = $derived(data.storyUri)
  const storyQ = createQuery(() => storyQuery(storyUri))
  const story = $derived((storyQ.data as StoryView) ?? null)
  const bskyUrl = $derived((story as any)?.crossPost?.url ?? null)
</script>

<OGMeta
  title={story ? `Story by @${story.creator.handle} — Grain` : 'Story — Grain'}
  description="Photo story on Grain"
  image={story?.fullsize}
/>
<DetailHeader label="Story">
  {#snippet actions()}
    {#if bskyUrl}
      <a class="bsky-link" href={bskyUrl} target="_blank" rel="noopener noreferrer" title="View on Bluesky">
        <svg width="18" height="18" viewBox="0 0 568 501" fill="currentColor"><path d="M123.121 33.664C188.241 82.553 258.281 181.68 284 234.873c25.719-53.192 95.759-152.32 160.879-201.21C491.866-1.611 568-28.906 568 57.947c0 17.346-9.945 145.713-15.778 166.555-20.275 72.453-94.155 90.933-159.875 79.748C507.222 323.8 536.444 388.56 473.333 453.32c-119.86 122.992-172.272-30.859-185.702-70.281-2.462-7.227-3.614-10.608-3.631-7.733-.017-2.875-1.169.506-3.631 7.733-13.43 39.422-65.842 193.273-185.702 70.281-63.111-64.76-33.889-129.52 80.986-149.071-65.72 11.185-139.6-7.295-159.875-79.748C10.945 203.659 1 75.291 1 57.946 1-28.906 76.135-1.612 123.121 33.664Z"/></svg>
      </a>
    {/if}
  {/snippet}
</DetailHeader>
<div class="detail-page">
  {#if storyQ.isLoading}
    <p class="status">Loading...</p>
  {:else if !story}
    <p class="status">Story not found</p>
  {:else}
    <div class="story-card">
      <a class="creator" href="/profile/{story.creator.did}">
        {#if story.creator.avatar}
          <img class="avatar" src={story.creator.avatar} alt="" />
        {/if}
        <span class="name">{story.creator.displayName ?? story.creator.handle}</span>
      </a>
      <div class="image-wrapper">
        <img
          src={story.fullsize}
          alt=""
          style="aspect-ratio: {story.aspectRatio.width}/{story.aspectRatio.height}"
        />
      </div>
      {#if story.location}
        <div class="location">
          <MapPin size={14} />
          <span>{story.location.name}</span>
        </div>
      {/if}
      <time class="time">{new Date(story.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>
    </div>
  {/if}
</div>

<style>
  .detail-page {
    max-width: 600px;
    margin: 0 auto;
  }
  .status {
    text-align: center;
    color: var(--text-muted);
    padding: 48px 16px;
    font-size: 14px;
  }
  .story-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
  }
  .creator {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    color: var(--text-primary);
  }
  .avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
  }
  .name {
    font-weight: 600;
    font-size: 15px;
  }
  .image-wrapper img {
    width: 100%;
    border-radius: 8px;
    object-fit: contain;
    background: var(--bg-hover);
  }
  .location {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--text-secondary);
    font-size: 13px;
  }
  .time {
    color: var(--text-muted);
    font-size: 13px;
  }
  .bsky-link {
    color: var(--text-muted);
    display: flex;
    align-items: center;
    padding: 4px;
    transition: color 0.15s;
  }
  .bsky-link:hover {
    color: #0085ff;
  }
</style>
```

**Step 7: Regenerate types and commit**

```bash
node /Users/chadmiller/code/hatk/packages/hatk/dist/cli.js generate types
git add app/routes/profile/\[did\]/story/\[rkey\]/ server/xrpc/getStory.ts lexicons/social/grain/unspecced/getStory.json lexicons/social/grain/story/defs.json app/lib/queries.ts hatk.generated.ts
git commit -m "feat: add story permalink route with cross-post hydration"
```

---

### Task 3: Add "Post to Bluesky" to StoryCreate

**Files:**

- Modify: `app/lib/components/molecules/StoryCreate.svelte`

**Step 1: Add checkbox and Bluesky posting to StoryCreate**

Add imports:

```ts
import Checkbox from "$lib/components/atoms/Checkbox.svelte";
import { createBskyPost } from "$lib/utils/bsky-post";
import { viewer } from "$lib/stores";
```

Add state:

```ts
let postToBluesky = $state(false);
```

After the existing `await callXrpc('dev.hatk.createRecord', ...)` in `publish()`, add:

```ts
const storyUri = (result as any).uri as string;

// Post to Bluesky if opted in
if (postToBluesky && $viewer) {
  const storyRkey = storyUri.split("/").pop();
  const storyUrl = `https://grain.social/profile/${$viewer.did}/story/${storyRkey}`;
  await createBskyPost({
    url: storyUrl,
    location: location
      ? {
          name: location.name,
          address: location.address,
        }
      : null,
    images: [
      {
        dataUrl: photo.dataUrl,
        alt: "",
        width: photo.width,
        height: photo.height,
      },
    ],
  });
}
```

Add checkbox in the template below the LocationInput:

```svelte
<Checkbox bind:checked={postToBluesky} label="Post to Bluesky" />
```

**Step 2: Commit**

```bash
git add app/lib/components/molecules/StoryCreate.svelte
git commit -m "feat: add Post to Bluesky option to story creation"
```

---

### Task 4: OG image endpoint for stories (optional but recommended)

**Files:**

- Create: `server/og/story.ts`

**Step 1: Create `server/og/story.ts`**

Simpler than gallery OG — single image with author info:

```ts
import { defineOG } from "$hatk";
import type { GrainActorProfile, Story } from "$hatk";

export default defineOG("/og/profile/:did/story/:rkey", async (ctx) => {
  const { db, params, fetchImage, lookup, blobUrl } = ctx;
  const { did, rkey } = params;

  const storyUri = `at://${did}/social.grain.story/${rkey}`;

  const rows = (await db.query(
    `SELECT uri, did, cid, media, aspect_ratio FROM "social.grain.story" WHERE uri = $1`,
    [storyUri],
  )) as Array<{
    uri: string;
    did: string;
    cid: string;
    media: string;
    aspect_ratio: string;
  }>;

  const row = rows[0];
  if (!row) {
    return {
      element: {
        type: "div",
        props: {
          style: {
            display: "flex",
            width: "100%",
            height: "100%",
            background: "#ffffff",
            color: "#171717",
            alignItems: "center",
            justifyContent: "center",
          },
          children: "Story not found",
        },
      },
    };
  }

  let blobRef: any;
  try {
    blobRef = typeof row.media === "string" ? JSON.parse(row.media) : row.media;
  } catch {
    blobRef = row.media;
  }

  const imageUrl = blobUrl(row.did, blobRef, "feed_fullsize");
  const imageDataUrl = imageUrl ? await fetchImage(imageUrl) : null;

  const profiles = await lookup<GrainActorProfile>("social.grain.actor.profile", "did", [did]);
  const author = profiles.get(did);
  const avatarRef = author ? blobUrl(did, author.value.avatar) : null;
  const avatarDataUrl = avatarRef ? await fetchImage(avatarRef) : null;

  return {
    element: {
      type: "div",
      props: {
        style: {
          display: "flex",
          width: "100%",
          height: "100%",
          backgroundColor: "#000000",
          position: "relative",
        },
        children: [
          ...(imageDataUrl
            ? [
                {
                  type: "img",
                  props: {
                    src: imageDataUrl,
                    style: { width: "100%", height: "100%", objectFit: "contain" },
                  },
                },
              ]
            : []),
          {
            type: "div",
            props: {
              style: {
                position: "absolute",
                bottom: "0",
                left: "0",
                right: "0",
                height: "80px",
                background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
                display: "flex",
                alignItems: "flex-end",
                padding: "0 24px 16px 24px",
                gap: "12px",
              },
              children: [
                ...(avatarDataUrl
                  ? [
                      {
                        type: "img",
                        props: {
                          src: avatarDataUrl,
                          style: {
                            width: "44px",
                            height: "44px",
                            borderRadius: "22px",
                            objectFit: "cover" as const,
                          },
                        },
                      },
                    ]
                  : []),
                {
                  type: "div",
                  props: {
                    style: { display: "flex", flexDirection: "column", gap: "2px" },
                    children: [
                      {
                        type: "div",
                        props: {
                          children:
                            author?.value.displayName || `@${author?.handle || did.slice(0, 24)}`,
                          style: { fontSize: 24, fontWeight: 600, color: "#ffffff" },
                        },
                      },
                      {
                        type: "div",
                        props: {
                          children: "Grain",
                          style: { fontSize: 16, color: "rgba(255,255,255,0.7)" },
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    meta: {
      title: `Story by @${author?.handle || did.slice(0, 24)} — Grain`,
      description: "Photo story on Grain",
    },
  };
});
```

**Step 2: Update story permalink OGMeta to use the OG endpoint**

In `app/routes/profile/[did]/story/[rkey]/+page.svelte`, change the OGMeta image prop:

```svelte
<OGMeta
  title={story ? `Story by @${story.creator.handle} — Grain` : 'Story — Grain'}
  description="Photo story on Grain"
  image="/og/profile/{data.did}/story/{data.rkey}"
/>
```

**Step 3: Commit**

```bash
git add server/og/story.ts app/routes/profile/\[did\]/story/\[rkey\]/+page.svelte
git commit -m "feat: add OG image endpoint for story permalinks"
```
