<script lang="ts">
  import { X, MapPin, LoaderCircle } from 'lucide-svelte'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { callXrpc } from '$hatk/client'
  import { processPhotos, type ProcessedPhoto } from '$lib/utils/image-resize'
  import { reverseGeocode, formatLocationName, extractAddress } from '$lib/utils/nominatim'
  import { latLonToH3 } from '$lib/utils/h3'
  import Field from '$lib/components/atoms/Field.svelte'
  import LocationInput from '$lib/components/atoms/LocationInput.svelte'
  import type { LocationData } from '$lib/components/atoms/LocationInput.svelte'
  import Button from '$lib/components/atoms/Button.svelte'
  import Checkbox from '$lib/components/atoms/Checkbox.svelte'
  import ContentWarningPicker from '$lib/components/atoms/ContentWarningPicker.svelte'
  import { createBskyPost } from '$lib/utils/bsky-post'
  import { includeLocation } from '$lib/preferences'
  import { viewer } from '$lib/stores'

  let { onclose }: { onclose: () => void } = $props()

  let photo = $state<ProcessedPhoto | null>(null)
  let location = $state<LocationData | null>(null)
  let processing = $state(false)
  let publishing = $state(false)
  let postToBluesky = $state(false)
  let selectedLabels = $state<string[]>([])
  let error = $state<string | null>(null)
  let fileInput: HTMLInputElement = $state()!

  const queryClient = useQueryClient()
  let wrapper: HTMLDivElement = $state()!

  $effect(() => {
    if (!wrapper) return
    document.body.appendChild(wrapper)
    return () => wrapper?.remove()
  })

  function openFilePicker() {
    fileInput?.click()
  }

  async function handleFileSelected(e: Event) {
    const input = e.target as HTMLInputElement
    const files = Array.from(input.files ?? [])
    input.value = ''
    if (files.length === 0) return

    try {
      processing = true
      error = null
      const processed = await processPhotos([files[0]])
      photo = processed[0]

      // Auto-suggest location from GPS
      const gps = photo.gps
      if (gps && $includeLocation) {
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
      error = 'Failed to process photo.'
      console.error(err)
    } finally {
      processing = false
    }
  }

  async function publish() {
    if (!photo || publishing) return
    publishing = true
    error = null

    try {
      const now = new Date().toISOString()
      const base64 = photo.dataUrl.split(',')[1]
      const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
      const blob = new Blob([binary], { type: 'image/jpeg' })

      const uploadResult = await callXrpc('dev.hatk.uploadBlob', blob as any)

      const result = await callXrpc('dev.hatk.createRecord', {
        collection: 'social.grain.story',
        record: {
          media: (uploadResult as any).blob,
          aspectRatio: { width: photo.width, height: photo.height },
          ...(location
            ? {
                location: {
                  name: location.name,
                  value: location.h3Index,
                },
                ...(location.address ? { address: location.address } : {}),
              }
            : {}),
          ...(selectedLabels.length > 0
            ? {
                labels: {
                  $type: 'com.atproto.label.defs#selfLabels',
                  values: selectedLabels.map((val) => ({ val })),
                },
              }
            : {}),
          createdAt: now,
        },
      })

      // Post to Bluesky if opted in
      if (postToBluesky && $viewer) {
        const storyUri = (result as any).uri as string
        const storyRkey = storyUri.split('/').pop()
        const storyUrl = `${window.location.origin}/profile/${$viewer.did}/story/${storyRkey}`
        await createBskyPost({
          url: storyUrl,
          location: location ? { name: location.name, address: location.address } : null,
          images: [{
            dataUrl: photo.dataUrl,
            alt: '',
            width: photo.width,
            height: photo.height,
          }],
        })
      }

      queryClient.invalidateQueries({ queryKey: ['storyAuthors'] })
      onclose()
    } catch (err: any) {
      error = err.message || 'Failed to post story.'
    } finally {
      publishing = false
    }
  }
</script>

<div bind:this={wrapper}>
<div class="story-create-overlay">
  <div class="story-create">
    <div class="header">
      <button class="close" onclick={onclose}><X size={20} /></button>
      <span class="title">New Story</span>
      {#if photo}
        <Button disabled={publishing} onclick={publish}>
          {#if publishing}
            <LoaderCircle size={16} class="spin" /> Posting...
          {:else}
            Post
          {/if}
        </Button>
      {:else}
        <div></div>
      {/if}
    </div>

    {#if error}
      <p class="error">{error}</p>
    {/if}

    <input
      type="file"
      accept="image/*"
      bind:this={fileInput}
      onchange={handleFileSelected}
      style="display:none"
    />

    {#if !photo}
      <div class="select-area">
        <button class="select-btn" onclick={openFilePicker} disabled={processing}>
          {#if processing}
            <LoaderCircle size={24} class="spin" />
            <span>Processing...</span>
          {:else}
            <span>Select Photo</span>
          {/if}
        </button>
      </div>
    {:else}
      <div class="preview">
        <img src={photo.dataUrl} alt="Story preview" />
      </div>
      <div class="location-field">
        <Field label="Location">
          <LocationInput bind:value={location} placeholder="Add location..." />
        </Field>
      </div>
      <div class="cw-field">
        <Field label="Labels">
          <ContentWarningPicker bind:selected={selectedLabels} />
        </Field>
      </div>
      <div class="divider"></div>
      <div class="bsky-field">
        <Checkbox bind:checked={postToBluesky} label="Post to Bluesky" />
        <span class="bsky-hint">Includes location and photo.</span>
      </div>
    {/if}
  </div>
</div>
</div>

<style>
  .story-create-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .story-create {
    width: 100%;
    max-width: 420px;
    max-height: 90vh;
    background: var(--bg-root);
    border-radius: 12px;
    overflow: visible;
    display: flex;
    flex-direction: column;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    position: relative;
  }
  .close {
    background: none;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
    padding: 4px;
  }
  .title {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    font-weight: 600;
    font-size: 16px;
    color: var(--text-primary);
    pointer-events: none;
  }
  .error {
    color: #f87171;
    padding: 8px 16px;
    margin: 0;
    text-align: center;
    font-size: 13px;
  }
  .select-area {
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
  }
  .select-btn:hover { border-color: var(--grain); }
  .select-btn:disabled { cursor: not-allowed; opacity: 0.6; }
  .preview {
    flex: 1;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    max-height: 50vh;
  }
  .preview img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  .location-field {
    padding: 12px 16px;
  }
  .cw-field {
    padding: 0 16px 8px;
  }
  .divider {
    border-top: 1px solid var(--border);
    margin: 4px 16px;
  }
  .bsky-field {
    padding: 8px 16px 12px;
  }
  .bsky-hint {
    display: block;
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 4px;
  }
</style>
