<script lang="ts">
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import { callXrpc } from '$hatk/client'
  import { createQuery } from '@tanstack/svelte-query'
  import { spaceSupportQuery } from '$lib/queries'
  import { viewer } from '$lib/stores'
  import { processPhotos, type ProcessedPhoto } from '$lib/utils/image-resize'
  import { nextTid, uploadPhotoBlobs } from '$lib/utils/records'
  import { goto } from '$app/navigation'

  const MAX_PHOTOS = 25

  const spaces = createQuery(() => spaceSupportQuery())

  let photos = $state<ProcessedPhoto[]>([])
  let title = $state('')
  let description = $state('')
  let memberText = $state('')
  let fileInput = $state<HTMLInputElement | null>(null)
  let processing = $state(false)
  let publishing = $state(false)
  let error = $state<string | null>(null)

  // DIDs, one per line. Not handles: resolution runs through the appview index,
  // and an account whose PDS serves spaces is exactly the kind grain has most
  // likely never indexed.
  const members = $derived(
    memberText
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  )
  const badMembers = $derived(members.filter((m) => !m.startsWith('did:')))
  const canPublish = $derived(
    title.trim().length > 0 && photos.length > 0 && badMembers.length === 0 && !publishing,
  )

  async function handleFiles(e: Event) {
    const input = e.target as HTMLInputElement
    const files = Array.from(input.files ?? []).filter((f) => f.type.startsWith('image/'))
    input.value = ''
    if (files.length === 0) return

    const remaining = MAX_PHOTOS - photos.length
    if (files.length > remaining) {
      error = `You can only add ${remaining} more photo${remaining === 1 ? '' : 's'}`
      return
    }

    processing = true
    error = null
    try {
      photos = [...photos, ...(await processPhotos(files))]
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    } finally {
      processing = false
    }
  }

  function removePhoto(index: number) {
    photos = photos.filter((_, i) => i !== index)
  }

  async function publish() {
    if (!canPublish) return
    publishing = true
    error = null

    try {
      const did = $viewer?.did
      if (!did) throw new Error('You must be signed in.')

      // Blobs go up the ordinary way: a space record's blobs are ordinary
      // account blobs, and only reading them back goes through the space.
      const blobs = await uploadPhotoBlobs(photos.map((p) => p.dataUrl))
      const rkey = nextTid()

      await callXrpc('social.grain.unspecced.createPrivateGallery', {
        rkey,
        title: title.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        members,
        photos: photos.map((photo, i) => ({
          photo: blobs[i],
          ...(photo.alt ? { alt: photo.alt } : {}),
          aspectRatio: { width: photo.width, height: photo.height },
        })),
      } as never)

      goto(`/private/${encodeURIComponent(did)}/${encodeURIComponent(rkey)}`)
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
      publishing = false
    }
  }
</script>

<DetailHeader label="New private gallery" />

<div class="page">
  {#if spaces.isSuccess && !spaces.data?.supported}
    <p class="notice">
      Your PDS doesn't serve permissioned spaces, so a private gallery can't live on it. Nothing
      here will publish.
    </p>
  {/if}

  <p class="lede">
    A private gallery lives in a permissioned space on your PDS. It never reaches the firehose, it
    is never indexed, and only the accounts you list below can read it.
  </p>

  <input
    type="file"
    accept="image/*"
    multiple
    data-testid="private-photos"
    bind:this={fileInput}
    onchange={handleFiles}
    style="display:none"
  />

  <button class="select" onclick={() => fileInput?.click()} disabled={processing || publishing}>
    {processing ? 'Processing…' : photos.length ? 'Add more photos' : 'Select photos'}
  </button>

  {#if photos.length > 0}
    <div class="thumbs">
      {#each photos as photo, i (photo.dataUrl)}
        <div class="thumb">
          <img src={photo.dataUrl} alt="Photo {i + 1}" />
          <button class="remove" onclick={() => removePhoto(i)} aria-label="Remove photo">×</button>
        </div>
      {/each}
    </div>
  {/if}

  <label class="field">
    <span>Title</span>
    <input type="text" bind:value={title} maxlength="100" placeholder="Sunday at the coast" />
  </label>

  <label class="field">
    <span>Description</span>
    <textarea bind:value={description} maxlength="1000" rows="3"></textarea>
  </label>

  <label class="field">
    <span>Who can see it</span>
    <textarea bind:value={memberText} rows="3" placeholder="did:plc:… (one per line)"></textarea>
  </label>

  {#if badMembers.length > 0}
    <p class="error">Not a DID: {badMembers.join(', ')}</p>
  {:else if members.length > 0}
    <p class="hint">{members.length} reader{members.length === 1 ? '' : 's'}, plus you.</p>
  {:else}
    <p class="hint">Only you, until you add someone.</p>
  {/if}

  {#if error}
    <p class="error">{error}</p>
  {/if}

  <button class="publish" onclick={publish} disabled={!canPublish}>
    {publishing ? 'Publishing…' : 'Create private gallery'}
  </button>
</div>

<style>
  .page {
    max-width: 600px;
    margin: 0 auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .lede,
  .hint {
    margin: 0;
    font-size: 13px;
    line-height: 1.45;
    color: var(--text-muted);
  }
  .notice {
    margin: 0;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 10px;
    font-size: 13px;
    color: var(--text-primary);
  }
  .select,
  .publish {
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: none;
    color: var(--text-primary);
    font-family: inherit;
    font-size: 15px;
    cursor: pointer;
  }
  .publish {
    background: var(--text-primary);
    color: var(--bg);
    border: none;
  }
  .select:disabled,
  .publish:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .thumbs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .thumb {
    position: relative;
    width: 72px;
    height: 72px;
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 8px;
  }
  .remove {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 20px;
    height: 20px;
    border: none;
    border-radius: 50%;
    background: var(--text-primary);
    color: var(--bg);
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .field span {
    font-size: 13px;
    color: var(--text-muted);
  }
  .field input,
  .field textarea {
    padding: 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: none;
    color: var(--text-primary);
    font-family: inherit;
    font-size: 15px;
    resize: vertical;
  }
  .error {
    margin: 0;
    font-size: 13px;
    color: var(--danger);
  }
</style>
