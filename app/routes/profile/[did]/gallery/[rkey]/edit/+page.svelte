<script lang="ts">
  import { goto } from '$app/navigation'
  import { createQuery, useQueryClient } from '@tanstack/svelte-query'
  import { callXrpc } from '$hatk/client'
  import { galleryQuery } from '$lib/queries'
  import type { GalleryView, PhotoView } from '$hatk/client'
  import { processPhotos, type ProcessedPhoto } from '$lib/utils/image-resize'
  import { parseTextToFacets } from '$lib/utils/rich-text'
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import Button from '$lib/components/atoms/Button.svelte'
  import Field from '$lib/components/atoms/Field.svelte'
  import Input from '$lib/components/atoms/Input.svelte'
  import Textarea from '$lib/components/atoms/Textarea.svelte'
  import RichTextarea from '$lib/components/atoms/RichTextarea.svelte'
  import LocationInput from '$lib/components/atoms/LocationInput.svelte'
  import ContentWarningPicker from '$lib/components/atoms/ContentWarningPicker.svelte'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'
  import FileDropZone from '$lib/components/atoms/FileDropZone.svelte'
  import { LoaderCircle, X, ImagePlus, RefreshCw } from 'lucide-svelte'
  import type { LocationData } from '$lib/components/atoms/LocationInput.svelte'
  import { createBskyPost } from '$lib/utils/bsky-post'

  let { data } = $props()

  const galleryQ = createQuery(() => galleryQuery(data.galleryUri))
  const gallery = $derived((galleryQ.data as GalleryView) ?? null)
  const queryClient = useQueryClient()

  // ─── Photo slot types ───────────────────────────────────────────────

  type ExistingSlot = { kind: 'existing'; view: PhotoView; replacement?: ProcessedPhoto }
  type NewSlot = { kind: 'new'; processed: ProcessedPhoto }
  type PhotoSlot = ExistingSlot | NewSlot

  // ─── Edit state ─────────────────────────────────────────────────────

  let title = $state('')
  let description = $state('')
  let location = $state<LocationData | null>(null)
  let selectedLabels = $state<string[]>([])
  let slots = $state<PhotoSlot[]>([])
  let initialized = $state(false)

  $effect(() => {
    if (gallery && !initialized) {
      title = gallery.title ?? ''
      description = (gallery as any).record?.description ?? gallery.description ?? ''
      location = gallery.location
        ? { name: gallery.location.name, h3Index: gallery.location.value, address: (gallery as any).record?.address }
        : null
      selectedLabels = (gallery as any).record?.labels?.values?.map((v: any) => v.val) ?? []
      slots = ((gallery.items ?? []) as PhotoView[]).map((view) => ({ kind: 'existing', view }))
      initialized = true
    }
  })

  // ─── State ──────────────────────────────────────────────────────────

  let saving = $state(false)
  let processing = $state(false)
  let posting = $state(false)
  let posted = $state(false)
  let error = $state<string | null>(null)

  function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  let pdsUrlCache: string | null = null

  async function resolvePdsUrl(did: string): Promise<string> {
    if (pdsUrlCache) return pdsUrlCache
    const res = await fetch(`https://plc.directory/${did}`)
    if (!res.ok) throw new Error('Failed to resolve DID document')
    const doc = await res.json()
    const svc = doc.service?.find((s: any) => s.type === 'AtprotoPersonalDataServer')
    if (!svc?.serviceEndpoint) throw new Error('PDS not found in DID document')
    pdsUrlCache = svc.serviceEndpoint
    return pdsUrlCache
  }

  async function fetchPhotoDataUrl(photo: PhotoView): Promise<string> {
    const fullsize = photo.fullsize
    // Local dev: already a com.atproto.sync.getBlob URL
    if (fullsize.includes('com.atproto.sync.getBlob')) {
      const res = await fetch(fullsize)
      const blob = await res.blob()
      return blobToDataUrl(blob)
    }
    // Production: parse CID from CDN URL, fetch from PDS
    const did = photo.uri.split('/')[2]
    const blobCid = new URL(fullsize).pathname.split('/').pop()!
    const pdsUrl = await resolvePdsUrl(did)
    const res = await fetch(`${pdsUrl}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${blobCid}`)
    if (!res.ok) throw new Error(`Failed to fetch blob: ${res.status}`)
    const blob = await res.blob()
    return blobToDataUrl(blob)
  }

  async function postToBluesky() {
    if (!gallery || posting) return
    posting = true
    error = null
    try {
      const photos = (gallery.items ?? []) as PhotoView[]
      const images = await Promise.all(
        photos.slice(0, 4).map(async (photo) => ({
          dataUrl: await fetchPhotoDataUrl(photo),
          alt: photo.alt ?? '',
          width: photo.aspectRatio?.width ?? 4,
          height: photo.aspectRatio?.height ?? 3,
        }))
      )
      const did = gallery.creator?.did!
      const rkey = gallery.uri.split('/').pop()!
      await createBskyPost({
        url: `${window.location.origin}/profile/${did}/gallery/${rkey}`,
        title: title.trim() || undefined,
        location: gallery.location
          ? { name: gallery.location.name, address: (gallery as any).address }
          : null,
        description: description.trim() || undefined,
        images,
      })
      posted = true
    } catch (err: any) {
      error = err.message || 'Failed to post to Bluesky.'
    } finally {
      posting = false
    }
  }

  let addFileInput: HTMLInputElement | undefined = $state()
  let replaceFileInputs = $state<Record<number, HTMLInputElement>>({})

  // ─── Drag to reorder (same as create page) ──────────────────────────

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
    if (slots.length < 2) return
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
    const draggedMidX = slotMidpoints[dragIndex] + dragOffsetX
    dragOverIndex = indexFromPointerX(draggedMidX)
  }

  function onThumbPointerUp() {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null }
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      dropping = true
      const moved = slots[dragIndex]
      const next = slots.filter((_, i) => i !== dragIndex)
      next.splice(dragOverIndex, 0, moved)
      slots = next
      requestAnimationFrame(() => { dropping = false })
    }
    dragIndex = null
    dragOverIndex = null
    dragOffsetX = 0
  }

  function thumbShift(index: number): number {
    if (dragIndex === null || dragOverIndex === null) return 0
    if (index === dragIndex) return 0
    const slot = 80
    if (dragIndex < dragOverIndex) {
      if (index > dragIndex && index <= dragOverIndex) return -slot
    } else {
      if (index < dragIndex && index >= dragOverIndex) return slot
    }
    return 0
  }

  // ─── Photo management ───────────────────────────────────────────────

  let fileDragging = $state(false)

  function removeSlot(index: number) {
    slots = slots.filter((_, i) => i !== index)
  }

  function handleAddFiles(e: Event) {
    const input = e.target as HTMLInputElement
    const files = Array.from(input.files ?? [])
    input.value = ''
    addFiles(files)
  }

  async function addFiles(files: File[]) {
    if (!files.length) return
    try {
      processing = true
      error = null
      const processed = await processPhotos(files)
      slots = [...slots, ...processed.map((p): NewSlot => ({ kind: 'new', processed: p }))]
    } catch {
      error = 'Failed to process photos.'
    } finally {
      processing = false
    }
  }

  async function handleReplace(e: Event, index: number) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!input) return
    input.value = ''
    if (!file) return
    const slot = slots[index]
    if (slot.kind !== 'existing') return
    try {
      processing = true
      error = null
      const [processed] = await processPhotos([file])
      slots[index] = { ...slot, replacement: processed }
    } catch {
      error = 'Failed to process photo.'
    } finally {
      processing = false
    }
  }

  function thumbSrc(slot: PhotoSlot): string {
    if (slot.kind === 'existing') return slot.replacement?.dataUrl ?? slot.view.thumb
    return slot.processed.dataUrl
  }

  // ─── Save ────────────────────────────────────────────────────────────

  const canSave = $derived(title.trim().length > 0 && slots.length > 0 && !saving)

  async function save() {
    if (!canSave || !gallery) return
    saving = true
    error = null

    try {
      const now = new Date().toISOString()
      const galleryRkey = gallery.uri.split('/').pop()!
      const did = gallery.creator?.did!
      const originalViews = ((gallery.items ?? []) as PhotoView[])

      // 1. Update gallery record metadata
      let facets: any[] | undefined
      if (description.trim()) {
        const parsed = await parseTextToFacets(description.trim())
        if (parsed.facets.length > 0) facets = parsed.facets
      }
      await callXrpc('dev.hatk.putRecord', {
        collection: 'social.grain.gallery',
        rkey: galleryRkey,
        record: {
          title: title.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(facets ? { facets } : {}),
          ...(location ? { location: { name: location.name, value: location.h3Index }, ...(location.address ? { address: location.address } : {}) } : {}),
          ...(selectedLabels.length > 0 ? { labels: { $type: 'com.atproto.label.defs#selfLabels', values: selectedLabels.map((val) => ({ val })) } } : {}),
          createdAt: (gallery as any).record?.createdAt ?? now,
          updatedAt: now,
        },
      })

      // 2. Process each slot in its new position order
      const finalPhotoUris: string[] = []
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i]

        if (slot.kind === 'new') {
          // Upload + createRecord photo + gallery.item
          const base64 = slot.processed.dataUrl.split(',')[1]
          const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
          const blob = new Blob([binary], { type: 'image/jpeg' })
          const uploadResult = await callXrpc('dev.hatk.uploadBlob', blob as any)

          const photoResult = await callXrpc('dev.hatk.createRecord', {
            collection: 'social.grain.photo',
            record: {
              photo: (uploadResult as any).blob,
              aspectRatio: { width: slot.processed.width, height: slot.processed.height },
              ...(slot.processed.alt ? { alt: slot.processed.alt } : {}),
              createdAt: now,
            },
          })
          const photoUri = (photoResult as any).uri as string
          finalPhotoUris.push(photoUri)

          if (slot.processed.exif) {
            await callXrpc('dev.hatk.createRecord', {
              collection: 'social.grain.photo.exif',
              record: { photo: photoUri, ...slot.processed.exif, createdAt: now },
            })
          }

          await callXrpc('dev.hatk.createRecord', {
            collection: 'social.grain.gallery.item',
            record: { gallery: gallery.uri, item: photoUri, position: i, createdAt: now },
          })
        } else {
          // Existing photo
          const photoRkey = slot.view.uri.split('/').pop()!
          const itemRkey = (slot.view.gallery as any)?.item?.split('/').pop()
          const originalPosition = (slot.view.gallery as any)?.itemPosition ?? 0

          if (slot.replacement) {
            // Upload + putRecord photo
            const base64 = slot.replacement.dataUrl.split(',')[1]
            const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
            const blob = new Blob([binary], { type: 'image/jpeg' })
            const uploadResult = await callXrpc('dev.hatk.uploadBlob', blob as any)

            const photoResult = await callXrpc('dev.hatk.putRecord', {
              collection: 'social.grain.photo',
              rkey: photoRkey,
              record: {
                photo: (uploadResult as any).blob,
                aspectRatio: { width: slot.replacement.width, height: slot.replacement.height },
                ...(slot.view.alt ? { alt: slot.view.alt } : {}),
                createdAt: (slot.view as any).record?.createdAt ?? now,
              },
            })
            const photoUri = (photoResult as any).uri as string

            // Update EXIF if extracted
            const exifRkey = slot.view.exif?.uri?.split('/').pop()
            if (slot.replacement.exif) {
              if (exifRkey) {
                await callXrpc('dev.hatk.putRecord', {
                  collection: 'social.grain.photo.exif',
                  rkey: exifRkey,
                  record: { photo: photoUri, ...slot.replacement.exif, createdAt: now },
                })
              } else {
                await callXrpc('dev.hatk.createRecord', {
                  collection: 'social.grain.photo.exif',
                  record: { photo: photoUri, ...slot.replacement.exif, createdAt: now },
                })
              }
            }
          }

          finalPhotoUris.push(slot.view.uri)

          // Update position on gallery.item if it changed
          if (itemRkey && originalPosition !== i) {
            await callXrpc('dev.hatk.putRecord', {
              collection: 'social.grain.gallery.item',
              rkey: itemRkey,
              record: {
                gallery: gallery.uri,
                item: slot.view.uri,
                position: i,
                createdAt: (slot.view.gallery as any)?.itemCreatedAt ?? now,
              },
            })
          }
        }
      }

      // 3. Delete gallery.item records for removed photos
      for (const orig of originalViews) {
        if (!finalPhotoUris.includes(orig.uri)) {
          const itemRkey = (orig.gallery as any)?.item?.split('/').pop()
          if (itemRkey) {
            await callXrpc('dev.hatk.deleteRecord', {
              collection: 'social.grain.gallery.item',
              rkey: itemRkey,
            })
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['gallery', data.galleryUri] })
      goto(`/profile/${did}/gallery/${galleryRkey}`)
    } catch (err: any) {
      error = err.message || 'Failed to save. Please try again.'
    } finally {
      saving = false
    }
  }
</script>

<OGMeta title="Edit gallery - grain" />

<FileDropZone
  enabled={!!gallery && !processing && !saving}
  {processing}
  onfiles={addFiles}
  onreject={(message) => (error = message)}
  bind:active={fileDragging}
/>

<DetailHeader label="Edit gallery" onback={() => goto(`/profile/${data.did}/gallery/${data.rkey}`)}>
  {#snippet actions()}
    <Button disabled={!canSave} onclick={save}>
      {#if saving}<LoaderCircle size={16} class="spin" /> Saving...{:else}Save{/if}
    </Button>
  {/snippet}
</DetailHeader>

{#if error}
  <p class="error">{error}</p>
{/if}

{#if galleryQ.isLoading}
  <p class="loading">Loading...</p>
{:else if gallery}
  <!-- Photo strip -->
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
    {#each slots as slot, i}
      {@const shift = thumbShift(i)}
      <div
        class="photo-thumb"
        class:drag-active={dragIndex === i}
        style={dragIndex === i ? `transform: translateX(${dragOffsetX}px) scale(1.08)` : shift ? `transform: translateX(${shift}px)` : ''}
        onpointerdown={(e) => onThumbPointerDown(e, i)}
      >
        <img src={thumbSrc(slot)} alt="Photo {i + 1}" draggable="false" />
        {#if dragIndex === null}
          <button class="remove-btn" onclick={() => removeSlot(i)} title="Remove">
            <X size={12} />
          </button>
          {#if slot.kind === 'existing'}
            <button
              class="replace-btn"
              title="Replace"
              onclick={() => replaceFileInputs[i]?.click()}
            >
              <RefreshCw size={10} />
            </button>
            <input
              type="file"
              accept="image/*"
              style="display:none"
              bind:this={replaceFileInputs[i]}
              onchange={(e) => handleReplace(e, i)}
            />
          {/if}
        {/if}
      </div>
    {/each}

    <button
      class="add-btn"
      class:drag-over={fileDragging}
      onclick={() => addFileInput?.click()}
      disabled={processing}
      title="Add photos, or drag and drop"
    >
      {#if processing}<LoaderCircle size={18} class="spin" />{:else}<ImagePlus size={18} />{/if}
    </button>
  </div>

  <input
    type="file"
    accept="image/*"
    multiple
    style="display:none"
    bind:this={addFileInput}
    onchange={handleAddFiles}
  />

  <!-- Metadata form -->
  <div class="form">
    <Field label="Title" count={title.length} max={100} showCount="always">
      <Input type="text" placeholder="Add a title..." maxlength={100} bind:value={title} />
    </Field>
    <Field label="Description" count={description.length} max={1000}>
      <RichTextarea
        placeholder="Add a description. Supports @mentions, #hashtags, and links."
        maxlength={1000}
        bind:value={description}
        rows={6}
      />
    </Field>
    <Field label="Location">
      <LocationInput bind:value={location} />
    </Field>
    <Field label="Labels">
      <ContentWarningPicker bind:selected={selectedLabels} />
    </Field>
  </div>

  <!-- Alt text per photo -->
  <div class="alt-section">
    <h2 class="alt-heading">Image descriptions</h2>
    <p class="alt-hint">Describes images for blind and low-vision users.</p>
    {#each slots as slot, i}
      <div class="alt-row">
        <img class="alt-thumb" src={thumbSrc(slot)} alt="Photo {i + 1}" />
        <div class="alt-field">
          <Textarea
            placeholder="Describe this image (optional)..."
            maxlength={1000}
            value={slot.kind === 'existing' ? (slot.replacement?.alt ?? slot.view.alt ?? '') : (slot.processed.alt ?? '')}
            oninput={(e) => {
              const val = (e.target as HTMLTextAreaElement).value
              if (slot.kind === 'existing') {
                if (slot.replacement) slots[i] = { ...slot, replacement: { ...slot.replacement, alt: val } }
                else slots[i] = { ...slot, view: { ...slot.view, alt: val } }
              } else {
                slots[i] = { ...slot, processed: { ...slot.processed, alt: val } }
              }
            }}
            rows={2}
          />
        </div>
      </div>
    {/each}
  </div>

  {#if !(gallery as any).crossPost && !posted}
    <div class="bsky-section">
      <p class="bsky-hint">This gallery hasn't been shared to Bluesky yet.</p>
      <Button onclick={postToBluesky} disabled={posting}>
        {#if posting}<LoaderCircle size={16} class="spin" /> Posting...{:else}Post to Bluesky{/if}
      </Button>
    </div>
  {:else if posted}
    <div class="bsky-section">
      <p class="bsky-success">Posted to Bluesky.</p>
    </div>
  {/if}
{/if}

<style>
  .error {
    color: var(--danger);
    padding: 12px 16px;
    margin: 0;
    font-size: 14px;
    text-align: center;
  }
  .loading {
    text-align: center;
    color: var(--text-muted);
    padding: 48px 16px;
    font-size: 14px;
  }

  /* Photo strip */
  .photo-strip {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    overflow-x: auto;
    border-bottom: 1px solid var(--border);
    align-items: center;
  }
  .photo-strip.dragging { touch-action: none; overflow-x: hidden; }
  .photo-strip.dropping .photo-thumb { transition: none !important; }

  .photo-thumb {
    position: relative;
    flex-shrink: 0;
    width: 72px;
    height: 72px;
    border-radius: 6px;
    overflow: hidden;
    transition: transform 150ms ease;
    user-select: none;
    touch-action: none;
  }
  .photo-thumb.drag-active { z-index: 10; box-shadow: 0 4px 16px rgba(0,0,0,0.4); }
  .photo-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }

  .remove-btn {
    position: absolute;
    top: 3px;
    right: 3px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: none;
    background: rgba(0,0,0,0.7);
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }
  .replace-btn {
    position: absolute;
    bottom: 3px;
    right: 3px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: none;
    background: rgba(0,0,0,0.7);
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }
  .add-btn {
    flex-shrink: 0;
    width: 72px;
    height: 72px;
    border-radius: 6px;
    border: 2px dashed var(--border);
    background: var(--bg-elevated);
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: border-color 0.15s, color 0.15s;
  }
  .add-btn:hover:not(:disabled) { border-color: var(--grain); color: var(--grain); }
  .add-btn.drag-over { border-color: var(--grain); color: var(--grain); }
  .add-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Form */
  .form {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    border-bottom: 1px solid var(--border);
  }

  /* Alt section */
  .alt-section {
    padding: 16px;
  }
  .alt-heading {
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 4px;
  }
  .alt-hint {
    font-size: 12px;
    color: var(--text-muted);
    margin: 0 0 12px;
  }
  .alt-row {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    margin-bottom: 12px;
  }
  .alt-thumb {
    width: 60px;
    height: 60px;
    object-fit: cover;
    border-radius: 6px;
    flex-shrink: 0;
  }
  .alt-field { flex: 1; }

  /* Bluesky section */
  .bsky-section {
    padding: 16px;
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .bsky-hint {
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
  }
  .bsky-success {
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
  }

  :global(.spin) {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
