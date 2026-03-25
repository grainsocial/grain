<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { callXrpc } from '$hatk/client'
  import { processPhotos, type ProcessedPhoto } from '$lib/utils/image-resize'
  import { reverseGeocode, formatLocationName, extractAddress } from '$lib/utils/nominatim'
  import { createBskyPost } from '$lib/utils/bsky-post'
  import { latLonToH3 } from '$lib/utils/h3'
  import { X, LoaderCircle } from 'lucide-svelte'
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'
  import Button from '$lib/components/atoms/Button.svelte'
  import Field from '$lib/components/atoms/Field.svelte'
  import { includeExif } from '$lib/preferences'
  import { viewer } from '$lib/stores'
  import Input from '$lib/components/atoms/Input.svelte'
  import Textarea from '$lib/components/atoms/Textarea.svelte'
  import RichTextarea from '$lib/components/atoms/RichTextarea.svelte'
  import LocationInput from '$lib/components/atoms/LocationInput.svelte'
  import Checkbox from '$lib/components/atoms/Checkbox.svelte'
  import type { LocationData } from '$lib/components/atoms/LocationInput.svelte'

  onMount(() => window.scrollTo(0, 0))

  // ─── State ──────────────────────────────────────────────────────────

  let step = $state<1 | 2 | 3>(1)
  let photos = $state<ProcessedPhoto[]>([])
  let title = $state('')
  let description = $state('')
  let location = $state<LocationData | null>(null)
  let processing = $state(false)
  let publishing = $state(false)
  let postToBluesky = $state(false)
  let error = $state<string | null>(null)

  let fileInput: HTMLInputElement = $state()!

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

      // Auto-suggest location from first photo's GPS
      const gps = photos.find((p) => p.gps)?.gps
      if (gps) {
        reverseGeocode(gps.latitude, gps.longitude).then((result) => {
          if (result) {
            const name = formatLocationName(result)
            const h3Index = latLonToH3(gps.latitude, gps.longitude)
            const address = extractAddress(result) ?? undefined
            location = { name, h3Index, ...(address ? { address } : {}) }
          }
        })
      }
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

  // ─── Drag to Reorder ────────────────────────────────────────────────

  let dragIndex: number | null = $state(null)
  let dragOverIndex: number | null = $state(null)
  let dragOffsetX = $state(0)
  let dropping = $state(false)
  let longPressTimer: ReturnType<typeof setTimeout> | null = null
  let dragStartX = 0
  let stripEl: HTMLDivElement | undefined = $state(undefined)
  let slotMidpoints: number[] = []

  function snapshotGeometry() {
    if (!stripEl) return
    const thumbs = stripEl.querySelectorAll('.photo-thumb') as NodeListOf<HTMLElement>
    // Remove transforms temporarily to get clean layout positions
    const prev = Array.from(thumbs).map((t) => t.style.transform)
    thumbs.forEach((t) => (t.style.transform = 'none'))
    slotMidpoints = Array.from(thumbs).map((t) => {
      const rect = t.getBoundingClientRect()
      return rect.left + rect.width / 2
    })
    thumbs.forEach((t, i) => (t.style.transform = prev[i]))
  }

  function indexFromPointerX(px: number): number {
    for (let i = 0; i < slotMidpoints.length; i++) {
      if (px < slotMidpoints[i]) return i
    }
    return slotMidpoints.length - 1
  }

  function onThumbPointerDown(e: PointerEvent, index: number) {
    if (photos.length < 2) return
    const target = e.currentTarget as HTMLElement
    dragStartX = e.clientX

    longPressTimer = setTimeout(() => {
      dragIndex = index
      dragOverIndex = index
      snapshotGeometry()
      target.setPointerCapture(e.pointerId)
    }, 200)
  }

  function onThumbPointerMove(e: PointerEvent) {
    if (dragIndex === null && longPressTimer && Math.abs(e.clientX - dragStartX) > 10) {
      clearTimeout(longPressTimer)
      longPressTimer = null
      return
    }
    if (dragIndex === null) return
    e.preventDefault()
    dragOffsetX = e.clientX - dragStartX

    // Use the dragged item's displaced midpoint against the frozen snapshot
    const draggedMidX = slotMidpoints[dragIndex] + dragOffsetX
    dragOverIndex = indexFromPointerX(draggedMidX)
  }

  function onThumbPointerUp() {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      longPressTimer = null
    }
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      // Suppress transitions during the reorder so there's no snap-back
      dropping = true
      const moved = photos[dragIndex]
      const next = photos.filter((_, i) => i !== dragIndex)
      next.splice(dragOverIndex, 0, moved)
      photos = next
      // Re-enable transitions after Svelte renders the new order
      requestAnimationFrame(() => {
        dropping = false
      })
    }
    dragIndex = null
    dragOverIndex = null
    dragOffsetX = 0
  }

  function thumbShift(index: number): number {
    if (dragIndex === null || dragOverIndex === null) return 0
    if (index === dragIndex) return 0
    const slot = 80 // thumb width (72) + gap (8)
    if (dragIndex < dragOverIndex) {
      if (index > dragIndex && index <= dragOverIndex) return -slot
    } else if (dragIndex > dragOverIndex) {
      if (index < dragIndex && index >= dragOverIndex) return slot
    }
    return 0
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

  async function publish() {
    if (publishing) return
    publishing = true
    error = null

    try {
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
        const photoUri = (photoResult as any).uri as string
        photoUris.push(photoUri)

        // Create EXIF record if we extracted metadata and user opted in
        if (photo.exif && $includeExif) {
          await callXrpc('dev.hatk.createRecord', {
            collection: 'social.grain.photo.exif',
            record: {
              photo: photoUri,
              ...photo.exif,
              createdAt: now,
            },
          })
        }
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
          ...(location
            ? {
                location: {
                  name: location.name,
                  value: location.h3Index,
                },
                ...(location.address ? { address: location.address } : {}),
              }
            : {}),
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

      // 5. Create Bluesky post if opted in
      if (postToBluesky && $viewer) {
        const galleryRkey = galleryUri.split('/').pop()
        const galleryUrl = `${window.location.origin}/profile/${$viewer.did}/gallery/${galleryRkey}`
        await createBskyPost({
          url: galleryUrl,
          location: location ? { name: location.name, address: location.address } : null,
          description: description.trim() || undefined,
          images: photos,
        })
      }

      queryClient.invalidateQueries({ queryKey: ['getFeed'] })
      goto('/')
    } catch (err: any) {
      error = err.message || 'Failed to create gallery. Please try again.'
    } finally {
      publishing = false
    }
  }

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

<OGMeta title="Create - grain" />
<div class="create-page">
  <DetailHeader
    label={step === 3 ? 'Add image descriptions' : 'Create a gallery'}
    onback={handleBack}
  >
    {#snippet actions()}
      {#if step === 2}
        <Button disabled={!canProceed} onclick={goToDescriptions}>Next</Button>
      {:else if step === 3}
        <Button disabled={publishing} onclick={publish}>
          {#if publishing}
            <LoaderCircle size={16} class="spin" /> Posting...
          {:else}
            Post
          {/if}
        </Button>
      {/if}
    {/snippet}
  </DetailHeader>

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
          <LoaderCircle size={24} class="spin" />
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
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="photo-strip"
      class:dragging={dragIndex !== null}
      class:dropping
      bind:this={stripEl}
      onpointermove={onThumbPointerMove}
      onpointerup={onThumbPointerUp}
      onpointercancel={onThumbPointerUp}
    >
      {#each photos as photo, i}
        {@const shift = thumbShift(i)}
        <div
          class="photo-thumb"
          class:drag-active={dragIndex === i}
          style={dragIndex === i ? `transform: translateX(${dragOffsetX}px) scale(1.08)` : shift ? `transform: translateX(${shift}px)` : ''}
          onpointerdown={(e) => onThumbPointerDown(e, i)}
        >
          <img src={photo.dataUrl} alt="Photo {i + 1}" draggable="false" />
          {#if dragIndex === null}
            <button class="remove-btn" onclick={() => removePhoto(i)}>
              <X size={12} />
            </button>
          {/if}
        </div>
      {/each}
    </div>
    <div class="form">
      <Field count={title.length} max={100} showCount="always">
        <Input
          type="text"
          placeholder="Add a title..."
          maxlength={100}
          bind:value={title}
        />
      </Field>
      <Field count={description.length} max={1000}>
        <RichTextarea
          placeholder="Add a description. Supports @mentions, #hashtags, and links."
          maxlength={1000}
          bind:value={description}
          rows={6}
        />
      </Field>
      <LocationInput bind:value={location} />
      <Checkbox bind:checked={postToBluesky} label="Post to Bluesky" />
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
            <Textarea
              placeholder="Describe this image (optional)..."
              maxlength={1000}
              value={photo.alt}
              oninput={(e) => updateAlt(i, (e.target as HTMLTextAreaElement).value)}
              rows={2}
            />
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
  .photo-strip.dragging {
    touch-action: none;
    overflow-x: hidden;
  }
  .photo-strip.dropping .photo-thumb {
    transition: none !important;
  }
  .photo-thumb {
    position: relative;
    flex-shrink: 0;
    transition: transform 150ms ease;
    user-select: none;
    touch-action: none;
  }
  .photo-thumb.drag-active {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    z-index: 10;
    opacity: 0.9;
    transition: none;
  }
  .photo-thumb img {
    width: 72px;
    height: 72px;
    object-fit: cover;
    border-radius: 6px;
    pointer-events: none;
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
  /* Spinner */
  :global(.spin) {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
