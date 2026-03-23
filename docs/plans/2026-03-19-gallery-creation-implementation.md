# Gallery Creation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a 3-step gallery creation flow (photo selection → metadata → alt text → publish) to hatk-template-grain.

**Architecture:** Single `/create` route with step transitions managed by Svelte 5 `$state`. Photos processed client-side, then published via hatk's `callXrpc` (uploadBlob → createRecord for photos → gallery → gallery items). Draft state lives entirely in component memory.

**Tech Stack:** SvelteKit 5, Svelte 5 runes, TanStack Svelte Query mutations, hatk client (`callXrpc`), Canvas API for image processing.

---

### Task 1: Image Processing Utility

**Files:**

- Create: `app/lib/utils/image-resize.ts`

**Step 1: Create `app/lib/utils/image-resize.ts`**

```typescript
export interface ProcessedPhoto {
  dataUrl: string;
  width: number;
  height: number;
  alt: string;
}

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getBase64Size(base64: string): number {
  const str = base64.split(",")[1] || base64;
  return Math.ceil((str.length * 3) / 4);
}

function createResizedImage(
  dataUrl: string,
  options: { width: number; height: number; quality: number },
): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(options.width / img.width, options.height / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;

      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, w, h);

      resolve({ dataUrl: canvas.toDataURL("image/jpeg", options.quality), width: w, height: h });
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export async function resizeImage(
  dataUrl: string,
  opts: { width: number; height: number; maxSize: number },
): Promise<{ dataUrl: string; width: number; height: number }> {
  let bestResult: { dataUrl: string; width: number; height: number } | null = null;
  let minQuality = 0;
  let maxQuality = 100;

  while (maxQuality - minQuality > 1) {
    const quality = Math.round((minQuality + maxQuality) / 2);
    const result = await createResizedImage(dataUrl, {
      width: opts.width,
      height: opts.height,
      quality: quality / 100,
    });

    const size = getBase64Size(result.dataUrl);
    if (size <= opts.maxSize) {
      bestResult = result;
      minQuality = quality;
    } else {
      maxQuality = quality;
    }
  }

  if (!bestResult) {
    throw new Error("Failed to compress image within size limit");
  }

  return bestResult;
}

export async function processPhotos(files: File[]): Promise<ProcessedPhoto[]> {
  const processed: ProcessedPhoto[] = [];
  for (const file of files) {
    const dataUrl = await readFileAsDataURL(file);
    const resized = await resizeImage(dataUrl, {
      width: 2000,
      height: 2000,
      maxSize: 900_000,
    });
    processed.push({
      dataUrl: resized.dataUrl,
      width: resized.width,
      height: resized.height,
      alt: "",
    });
  }
  return processed;
}
```

**Step 2: Verify the file compiles**

Run: `npx tsc --noEmit app/lib/utils/image-resize.ts` or rely on the dev server's type checking.

**Step 3: Commit**

```bash
git add app/lib/utils/image-resize.ts
git commit -m "feat: add image resize/compress utility for gallery creation"
```

---

### Task 2: Rich Text Facet Parser

**Files:**

- Create: `app/lib/utils/rich-text.ts`

**Step 1: Create `app/lib/utils/rich-text.ts`**

```typescript
interface Facet {
  index: { byteStart: number; byteEnd: number };
  features: Array<
    | { $type: "app.bsky.richtext.facet#link"; uri: string }
    | { $type: "app.bsky.richtext.facet#mention"; did: string }
    | { $type: "app.bsky.richtext.facet#tag"; tag: string }
  >;
}

export async function parseTextToFacets(
  text: string,
  resolveHandle?: (handle: string) => Promise<string | null>,
): Promise<{ text: string; facets: Facet[] }> {
  if (!text) return { text: "", facets: [] };

  const facets: Facet[] = [];
  const encoder = new TextEncoder();

  function getByteOffset(str: string, charIndex: number): number {
    return encoder.encode(str.slice(0, charIndex)).length;
  }

  const claimed = new Set<number>();

  function isRangeClaimed(start: number, end: number): boolean {
    for (let i = start; i < end; i++) {
      if (claimed.has(i)) return true;
    }
    return false;
  }

  function claimRange(start: number, end: number): void {
    for (let i = start; i < end; i++) {
      claimed.add(i);
    }
  }

  // URLs (highest priority)
  const urlRegex = /https?:\/\/[^\s<>\[\]()]+/g;
  let urlMatch;
  while ((urlMatch = urlRegex.exec(text)) !== null) {
    const start = urlMatch.index;
    const end = start + urlMatch[0].length;
    if (!isRangeClaimed(start, end)) {
      claimRange(start, end);
      facets.push({
        index: { byteStart: getByteOffset(text, start), byteEnd: getByteOffset(text, end) },
        features: [{ $type: "app.bsky.richtext.facet#link", uri: urlMatch[0] }],
      });
    }
  }

  // Mentions
  const mentionRegex =
    /@([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?/g;
  let mentionMatch;
  while ((mentionMatch = mentionRegex.exec(text)) !== null) {
    const start = mentionMatch.index;
    const end = start + mentionMatch[0].length;
    const handle = mentionMatch[0].slice(1);
    if (!isRangeClaimed(start, end) && resolveHandle) {
      try {
        const did = await resolveHandle(handle);
        if (did) {
          claimRange(start, end);
          facets.push({
            index: { byteStart: getByteOffset(text, start), byteEnd: getByteOffset(text, end) },
            features: [{ $type: "app.bsky.richtext.facet#mention", did }],
          });
        }
      } catch {
        // Handle not found — skip
      }
    }
  }

  // Hashtags
  const hashtagRegex = /#([a-zA-Z][a-zA-Z0-9_]*)/g;
  let hashtagMatch;
  while ((hashtagMatch = hashtagRegex.exec(text)) !== null) {
    const start = hashtagMatch.index;
    const end = start + hashtagMatch[0].length;
    const tag = hashtagMatch[1];
    if (!isRangeClaimed(start, end)) {
      claimRange(start, end);
      facets.push({
        index: { byteStart: getByteOffset(text, start), byteEnd: getByteOffset(text, end) },
        features: [{ $type: "app.bsky.richtext.facet#tag", tag }],
      });
    }
  }

  facets.sort((a, b) => a.index.byteStart - b.index.byteStart);
  return { text, facets };
}
```

**Step 2: Commit**

```bash
git add app/lib/utils/rich-text.ts
git commit -m "feat: add rich text facet parser for mentions, URLs, hashtags"
```

---

### Task 3: Add Create Button to Navigation

**Files:**

- Modify: `app/lib/components/organisms/Sidebar.svelte`
- Modify: `app/lib/components/molecules/MobileBottomBar.svelte`

**Step 1: Modify `Sidebar.svelte`**

Add a `Plus` icon import and a create button in `.nav-items`, visible only when authenticated. The button should link to `/create`.

```svelte
<script lang="ts">
  import { Home, Plus } from 'lucide-svelte'
  import AuthBar from './AuthBar.svelte'
  import Avatar from '../atoms/Avatar.svelte'
  import { isAuthenticated, viewer } from '$lib/stores'
  import { page } from '$app/state'
</script>

<nav class="sidebar-left">
  <div class="sidebar-top">
    {#if $isAuthenticated && $viewer}
      <a href="/profile/{$viewer.did}" class="sidebar-avatar-link">
        <Avatar did={$viewer.did} src={$viewer.avatar} name={$viewer.displayName || $viewer.handle} size={42} />
      </a>
    {:else}
      <a href="/" class="logo-text">grain</a>
    {/if}
  </div>
  <div class="nav-items">
    <a href="/" class="nav-item" class:active={page.url.pathname === '/'} title="Home">
      <Home size={22} />
    </a>
    {#if $isAuthenticated}
      <a href="/create" class="nav-item" class:active={page.url.pathname === '/create'} title="Create">
        <Plus size={22} />
      </a>
    {/if}
  </div>
  <div class="sidebar-bottom">
    <AuthBar />
  </div>
</nav>
```

(Keep all existing `<style>` unchanged.)

**Step 2: Modify `MobileBottomBar.svelte`**

Add a `Plus` icon and create button between the home and search buttons, visible only when authenticated.

```svelte
<script lang="ts">
  import { Image, Search, Plus } from 'lucide-svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { isAuthenticated, viewer } from '$lib/stores'
  import Avatar from '../atoms/Avatar.svelte'

  let { onSearch }: { onSearch: () => void } = $props()
</script>

<div class="mobile-bottom">
  <button
    class="mobile-tab"
    class:active={page.url.pathname === '/'}
    onclick={() => goto('/')}
  >
    <Image size={22} />
  </button>
  {#if $isAuthenticated}
    <button
      class="mobile-tab"
      class:active={page.url.pathname === '/create'}
      onclick={() => goto('/create')}
    >
      <Plus size={22} />
    </button>
  {/if}
  <button class="mobile-tab" onclick={onSearch}>
    <Search size={22} />
  </button>
  {#if $isAuthenticated && $viewer}
    <button
      class="mobile-tab"
      class:active={page.url.pathname.startsWith('/profile/')}
      onclick={() => goto(`/profile/${encodeURIComponent($viewer!.did)}`)}
    >
      <Avatar did={$viewer.did} src={$viewer.avatar} name={$viewer.displayName || $viewer.handle} size={24} />
    </button>
  {/if}
</div>
```

(Keep all existing `<style>` unchanged.)

**Step 3: Verify nav renders**

Run: `npm run dev` and confirm the "+" icon appears in both desktop sidebar and mobile bottom bar when logged in.

**Step 4: Commit**

```bash
git add app/lib/components/organisms/Sidebar.svelte app/lib/components/molecules/MobileBottomBar.svelte
git commit -m "feat: add create gallery button to sidebar and mobile nav"
```

---

### Task 4: Create Page — 3-Step Flow

**Files:**

- Create: `app/routes/create/+page.svelte`

This is the main component. It manages 3 steps via `$state`:

- Step 1: Photo selection (file picker + thumbnail strip)
- Step 2: Title + description
- Step 3: Alt text + publish

**Step 1: Create `app/routes/create/+page.svelte`**

```svelte
<script lang="ts">
  import { goto } from '$app/navigation'
  import { createMutation, useQueryClient } from '@tanstack/svelte-query'
  import { callXrpc } from '$hatk/client'
  import { isAuthenticated } from '$lib/stores'
  import { processPhotos, type ProcessedPhoto } from '$lib/utils/image-resize'
  import { parseTextToFacets } from '$lib/utils/rich-text'
  import { ArrowLeft, X, Loader2 } from 'lucide-svelte'

  // Redirect if not authenticated
  $effect(() => {
    if (!$isAuthenticated) goto('/')
  })

  // ─── State ──────────────────────────────────────────────────────────

  let step = $state<1 | 2 | 3>(1)
  let photos = $state<ProcessedPhoto[]>([])
  let title = $state('')
  let description = $state('')
  let processing = $state(false)
  let error = $state<string | null>(null)

  let fileInput: HTMLInputElement

  // ─── Step 1: Photo Selection ────────────────────────────────────────

  function openFilePicker() {
    fileInput?.click()
  }

  async function handleFilesSelected(e: Event) {
    const input = e.target as HTMLInputElement
    const files = Array.from(input.files ?? [])
    input.value = ''
    if (files.length === 0) return
    if (files.length > 10) {
      error = 'Maximum 10 photos allowed'
      return
    }

    try {
      processing = true
      error = null
      photos = await processPhotos(files)
      step = 2
    } catch (err) {
      error = 'Failed to process photos. Please try again.'
      console.error(err)
    } finally {
      processing = false
    }
  }

  function removePhoto(index: number) {
    photos = photos.filter((_, i) => i !== index)
    if (photos.length === 0) step = 1
  }

  // ─── Step 2: Metadata ──────────────────────────────────────────────

  const canProceed = $derived(title.trim().length > 0 && photos.length > 0)

  function goToDescriptions() {
    if (!canProceed) return
    step = 3
  }

  // ─── Step 3: Publish ───────────────────────────────────────────────

  function updateAlt(index: number, value: string) {
    photos[index] = { ...photos[index], alt: value }
  }

  const queryClient = useQueryClient()

  const publishMut = createMutation(() => ({
    mutationFn: async () => {
      const now = new Date().toISOString()
      const photoUris: string[] = []

      // 1. Upload blobs + create photo records
      for (const photo of photos) {
        const base64 = photo.dataUrl.split(',')[1]
        const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
        const blob = new Blob([binary], { type: 'image/jpeg' })

        const uploadResult = await callXrpc('dev.hatk.uploadBlob', blob as any)

        const photoResult = await callXrpc('dev.hatk.createRecord', {
          collection: 'social.grain.photo',
          record: {
            photo: (uploadResult as any).blob,
            aspectRatio: { width: photo.width, height: photo.height },
            ...(photo.alt ? { alt: photo.alt } : {}),
            createdAt: now,
          },
        })
        photoUris.push((photoResult as any).uri)
      }

      // 2. Parse facets from description
      let facets: any[] | undefined
      if (description.trim()) {
        const parsed = await parseTextToFacets(description.trim())
        if (parsed.facets.length > 0) facets = parsed.facets
      }

      // 3. Create gallery record
      const galleryResult = await callXrpc('dev.hatk.createRecord', {
        collection: 'social.grain.gallery',
        record: {
          title: title.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(facets ? { facets } : {}),
          createdAt: now,
        },
      })
      const galleryUri = (galleryResult as any).uri as string

      // 4. Create gallery items
      for (let i = 0; i < photoUris.length; i++) {
        await callXrpc('dev.hatk.createRecord', {
          collection: 'social.grain.gallery.item',
          record: {
            gallery: galleryUri,
            item: photoUris[i],
            position: i,
            createdAt: now,
          },
        })
      }

      return galleryUri
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['getFeed'] })
      goto('/')
    },
    onError: (err: Error) => {
      error = err.message || 'Failed to create gallery. Please try again.'
    },
  }))

  function handleBack() {
    if (step === 3) {
      step = 2
    } else if (step === 2) {
      step = 1
      photos = []
      title = ''
      description = ''
    } else {
      goto('/')
    }
  }
</script>

<div class="create-page">
  <!-- Header -->
  <div class="header">
    <button class="back-btn" onclick={handleBack}>
      <ArrowLeft size={20} />
    </button>
    <span class="header-title">
      {#if step === 1}Create a gallery
      {:else if step === 2}Create a gallery
      {:else}Add image descriptions
      {/if}
    </span>
    <div class="header-action">
      {#if step === 2}
        <button class="primary-btn" disabled={!canProceed} onclick={goToDescriptions}>Next</button>
      {:else if step === 3}
        <button
          class="primary-btn"
          disabled={$publishMut.isPending}
          onclick={() => publishMut.mutate()}
        >
          {#if $publishMut.isPending}
            <Loader2 size={16} class="spin" /> Posting...
          {:else}
            Post
          {/if}
        </button>
      {/if}
    </div>
  </div>

  {#if error}
    <p class="error">{error}</p>
  {/if}

  <!-- Step 1: Photo Selection -->
  {#if step === 1}
    <div class="step-select">
      <input
        type="file"
        accept="image/*"
        multiple
        bind:this={fileInput}
        onchange={handleFilesSelected}
        style="display:none"
      />
      <button class="select-btn" onclick={openFilePicker} disabled={processing}>
        {#if processing}
          <Loader2 size={24} class="spin" />
          <span>Processing photos...</span>
        {:else}
          <span>Select Photos</span>
          <span class="hint">Up to 10 photos</span>
        {/if}
      </button>
    </div>
  {/if}

  <!-- Step 2: Metadata -->
  {#if step === 2}
    <div class="photo-strip">
      {#each photos as photo, i}
        <div class="photo-thumb">
          <img src={photo.dataUrl} alt="Photo {i + 1}" />
          <button class="remove-btn" onclick={() => removePhoto(i)}>
            <X size={12} />
          </button>
        </div>
      {/each}
    </div>
    <div class="form">
      <div class="field">
        <input
          type="text"
          placeholder="Add a title..."
          maxlength={100}
          bind:value={title}
        />
        <span class="char-count">{title.length}/100</span>
      </div>
      <div class="field">
        <textarea
          placeholder="Add a description (optional)..."
          maxlength={1000}
          bind:value={description}
          rows={3}
        ></textarea>
        {#if description.length > 0}
          <span class="char-count">{description.length}/1000</span>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Step 3: Alt Text -->
  {#if step === 3}
    <p class="info">Alt text describes images for blind and low-vision users, and helps give context to everyone.</p>
    <div class="photo-list">
      {#each photos as photo, i}
        <div class="photo-row">
          <img class="photo-preview" src={photo.dataUrl} alt="Photo {i + 1}" />
          <div class="alt-field">
            <textarea
              placeholder="Describe this image (optional)..."
              maxlength={1000}
              value={photo.alt}
              oninput={(e) => updateAlt(i, (e.target as HTMLTextAreaElement).value)}
              rows={2}
            ></textarea>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .create-page {
    max-width: 600px;
    margin: 0 auto;
    min-height: 100vh;
  }

  /* Header */
  .header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    background: var(--bg-root);
    z-index: 10;
  }
  .back-btn {
    background: none;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
  }
  .header-title {
    flex: 1;
    font-weight: 600;
    font-size: 16px;
  }
  .header-action {
    display: flex;
    align-items: center;
  }
  .primary-btn {
    background: var(--grain);
    color: #fff;
    border: none;
    border-radius: 20px;
    padding: 8px 20px;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .primary-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Error */
  .error {
    color: #f87171;
    padding: 12px 16px;
    margin: 0;
    text-align: center;
    font-size: 14px;
  }

  /* Step 1 */
  .step-select {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 300px;
    padding: 32px;
  }
  .select-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    background: var(--bg-hover);
    border: 2px dashed var(--border);
    border-radius: 16px;
    padding: 40px 48px;
    cursor: pointer;
    color: var(--text-primary);
    font-size: 16px;
    font-weight: 600;
    font-family: inherit;
    transition: border-color 0.15s;
  }
  .select-btn:hover { border-color: var(--grain); }
  .select-btn:disabled { cursor: not-allowed; opacity: 0.6; }
  .hint {
    font-size: 13px;
    font-weight: 400;
    color: var(--text-muted);
  }

  /* Photo strip (step 2) */
  .photo-strip {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    overflow-x: auto;
    border-bottom: 1px solid var(--border);
  }
  .photo-thumb {
    position: relative;
    flex-shrink: 0;
  }
  .photo-thumb img {
    width: 72px;
    height: 72px;
    object-fit: cover;
    border-radius: 6px;
  }
  .remove-btn {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--text-primary);
    color: var(--bg-root);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Form (step 2) */
  .form {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .field {
    position: relative;
  }
  .field input,
  .field textarea {
    width: 100%;
    background: none;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px;
    color: var(--text-primary);
    font-family: inherit;
    font-size: 15px;
    resize: vertical;
  }
  .field input:focus,
  .field textarea:focus {
    outline: none;
    border-color: var(--grain);
  }
  .char-count {
    position: absolute;
    bottom: 8px;
    right: 12px;
    font-size: 12px;
    color: var(--text-muted);
  }

  /* Alt text (step 3) */
  .info {
    margin: 0;
    padding: 12px 16px;
    font-size: 13px;
    color: var(--text-secondary);
    border-bottom: 1px solid var(--border);
  }
  .photo-list {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .photo-row {
    display: flex;
    gap: 12px;
  }
  .photo-preview {
    flex-shrink: 0;
    width: 80px;
    max-height: 120px;
    object-fit: contain;
    border-radius: 6px;
  }
  .alt-field {
    flex: 1;
  }
  .alt-field textarea {
    width: 100%;
    background: none;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px;
    color: var(--text-primary);
    font-family: inherit;
    font-size: 14px;
    resize: vertical;
  }
  .alt-field textarea:focus {
    outline: none;
    border-color: var(--grain);
  }

  /* Spinner */
  :global(.spin) {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
```

**Step 2: Verify the page renders**

Run: `npm run dev`, navigate to `/create` while logged in. Confirm:

- Step 1: "Select Photos" button appears
- Selecting images processes them and advances to step 2
- Step 2: Thumbnail strip, title input, description textarea, "Next" button
- Step 3: Photo previews with alt text inputs, "Post" button

**Step 3: Test the full publish flow**

1. Select 2-3 photos
2. Add a title, optionally a description
3. Optionally add alt text
4. Click "Post"
5. Confirm gallery records are created and you're redirected to home

**Step 4: Commit**

```bash
git add app/routes/create/+page.svelte
git commit -m "feat: add gallery creation page with 3-step flow"
```

---

### Task 5: End-to-End Verification

**Step 1: Full flow test**

1. Log in
2. Confirm "+" button appears in sidebar (desktop) and bottom bar (mobile)
3. Click "+" → navigate to `/create`
4. Select photos (verify max 10 enforced)
5. Add title + description
6. Add alt text for at least one photo
7. Post → verify redirect and gallery appears in feed

**Step 2: Error handling test**

1. Try posting while logged out → verify redirect
2. Try selecting >10 photos → verify error message
3. Open browser dev tools, throttle network → verify "Posting..." state and error recovery

**Step 3: Final commit (if any fixes needed)**

```bash
git add -u
git commit -m "fix: address issues found during gallery creation testing"
```
