<script lang="ts">
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import Button from '$lib/components/atoms/Button.svelte'
  import Field from '$lib/components/atoms/Field.svelte'
  import FileDropZone from '$lib/components/atoms/FileDropZone.svelte'
  import Input from '$lib/components/atoms/Input.svelte'
  import Textarea from '$lib/components/atoms/Textarea.svelte'
  import { callXrpc } from '$hatk/client'
  import { createQuery } from '@tanstack/svelte-query'
  import { spaceSupportQuery } from '$lib/queries'
  import { viewer } from '$lib/stores'
  import { processPhotos, type ProcessedPhoto } from '$lib/utils/image-resize'
  import { nextTid, uploadPhotoBlobs } from '$lib/utils/records'
  import { ImagePlus, Lock, X } from 'lucide-svelte'
  import { goto } from '$app/navigation'

  const MAX_PHOTOS = 25
  const MAX_TITLE = 100
  const MAX_DESCRIPTION = 1000

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
  // Handles or DIDs; the server resolves either. Only obvious nonsense is
  // rejected here, since whether a handle exists is not ours to decide.
  const badMembers = $derived(members.filter((m) => !m.includes('.') && !m.startsWith('did:')))
  const canPublish = $derived(
    title.trim().length > 0 && photos.length > 0 && badMembers.length === 0 && !publishing,
  )

  async function addFiles(files: File[]) {
    if (files.length === 0) return

    const remaining = MAX_PHOTOS - photos.length
    if (files.length > remaining) {
      error =
        remaining === 0
          ? `Maximum ${MAX_PHOTOS} photos`
          : `You can only add ${remaining} more photo${remaining === 1 ? '' : 's'}`
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

  function handleFiles(e: Event) {
    const input = e.target as HTMLInputElement
    const files = Array.from(input.files ?? []).filter((f) => f.type.startsWith('image/'))
    input.value = ''
    addFiles(files)
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

<FileDropZone
  enabled={!publishing && photos.length < MAX_PHOTOS}
  {processing}
  hint="{MAX_PHOTOS - photos.length} more allowed"
  onfiles={addFiles}
  onreject={(message) => (error = message)}
/>

<DetailHeader label="New private gallery" />

<div class="page">
  <p class="lede">
    <Lock size={13} />
    <span>
      This gallery lives in a permissioned space on your PDS. It never reaches the firehose and is
      never indexed. Only the accounts you list can read it.
    </span>
  </p>

  {#if spaces.isSuccess && !spaces.data?.supported}
    <p class="warning">
      Your PDS doesn't serve permissioned spaces, so nothing here will publish.
    </p>
  {/if}

  <input
    type="file"
    accept="image/*"
    multiple
    data-testid="private-photos"
    bind:this={fileInput}
    onchange={handleFiles}
    style="display:none"
  />

  {#if photos.length > 0}
    <div class="thumbs">
      {#each photos as photo, i (photo.dataUrl)}
        <div class="thumb">
          <img src={photo.dataUrl} alt="Photo {i + 1}" />
          <button class="remove" onclick={() => removePhoto(i)} aria-label="Remove photo">
            <X size={12} />
          </button>
        </div>
      {/each}
    </div>
  {/if}

  <Button
    variant="secondary"
    onclick={() => fileInput?.click()}
    disabled={processing || publishing || photos.length >= MAX_PHOTOS}
  >
    <ImagePlus size={15} />
    {processing ? 'Processing…' : photos.length ? 'Add more photos' : 'Select photos'}
  </Button>

  <Field label="Title" count={title.length} max={MAX_TITLE}>
    <Input bind:value={title} maxlength={MAX_TITLE} placeholder="Sunday at the coast" />
  </Field>

  <Field label="Description" count={description.length} max={MAX_DESCRIPTION}>
    <Textarea bind:value={description} maxlength={MAX_DESCRIPTION} rows={3} />
  </Field>

  <Field label="Who can see it">
    <Textarea bind:value={memberText} rows={3} placeholder="@handle or did:plc:… (one per line)" />
  </Field>

  {#if badMembers.length > 0}
    <p class="error">Not a handle or DID: {badMembers.join(', ')}</p>
  {:else}
    <p class="hint">
      {members.length
        ? `${members.length} reader${members.length === 1 ? '' : 's'}, plus you.`
        : 'Only you, until you add someone.'}
    </p>
  {/if}

  {#if error}
    <p class="error">{error}</p>
  {/if}

  <Button onclick={publish} disabled={!canPublish}>
    {publishing ? 'Publishing…' : 'Create private gallery'}
  </Button>
</div>

<style>
  .page {
    max-width: 600px;
    margin: 0 auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .lede {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin: 0;
    font-size: 13px;
    line-height: 1.45;
    color: var(--text-muted);
  }
  .hint {
    margin: -8px 0 0;
    font-size: 12px;
    color: var(--text-muted);
  }
  .warning {
    margin: 0;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 10px;
    font-size: 13px;
    color: var(--text-primary);
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
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: none;
    border-radius: 50%;
    background: var(--text-primary);
    color: var(--bg);
    cursor: pointer;
  }
  .error {
    margin: -8px 0 0;
    font-size: 13px;
    color: var(--danger);
  }
</style>
