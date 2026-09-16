<script lang="ts">
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import Button from '$lib/components/atoms/Button.svelte'
  import Field from '$lib/components/atoms/Field.svelte'
  import FileDropZone from '$lib/components/atoms/FileDropZone.svelte'
  import Input from '$lib/components/atoms/Input.svelte'
  import Textarea from '$lib/components/atoms/Textarea.svelte'
  import { callXrpc } from '$hatk/client'
  import { createQuery, useQueryClient } from '@tanstack/svelte-query'
  import { groupQuery, spaceSupportQuery } from '$lib/queries'
  import SpacesRequired from '$lib/components/molecules/SpacesRequired.svelte'
  import { viewer } from '$lib/stores'
  import { processPhotos, type ProcessedPhoto } from '$lib/utils/image-resize'
  import { nextTid, uploadPhotoBlobs } from '$lib/utils/records'
  import { ImagePlus, Lock, X } from 'lucide-svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'

  // Straight into the pool. There is no submission and nothing to accept: the
  // gallery is written into the community's space, where being a member is the
  // permission and stops being one the moment you leave.
  const MAX_PHOTOS = 25
  const MAX_TITLE = 100
  const MAX_DESCRIPTION = 1000

  const did = $derived(decodeURIComponent(page.params.did ?? ''))
  const group = createQuery(() => groupQuery(did))
  // Writing into a pool needs a delegation token from the viewer's own PDS, so
  // this form cannot publish without spaces however they reached it.
  const spaces = createQuery(() => spaceSupportQuery())
  const noSpaces = $derived(spaces.isSuccess && spaces.data?.supported !== true)
  const queryClient = useQueryClient()

  let photos = $state<ProcessedPhoto[]>([])
  let title = $state('')
  let description = $state('')
  let fileInput = $state<HTMLInputElement | null>(null)
  let processing = $state(false)
  let publishing = $state(false)
  let error = $state<string | null>(null)

  const canPublish = $derived(title.trim().length > 0 && photos.length > 0 && !publishing)

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
      const me = $viewer?.did
      if (!me) throw new Error('You must be signed in.')

      // Blobs go up the ordinary way: a space record's blobs are ordinary
      // account blobs, and only reading them back goes through the space.
      const blobs = await uploadPhotoBlobs(photos.map((p) => p.dataUrl))
      const rkey = nextTid()

      await callXrpc('social.grain.unspecced.createPoolGallery', {
        group: did,
        rkey,
        title: title.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        photos: photos.map((photo, i) => ({
          photo: blobs[i],
          ...(photo.alt ? { alt: photo.alt } : {}),
          aspectRatio: { width: photo.width, height: photo.height },
        })),
      } as never)

      queryClient.invalidateQueries({ queryKey: ['poolGalleries', did] })
      goto(
        `/profile/${encodeURIComponent(me)}/gallery/${encodeURIComponent(rkey)}?group=${encodeURIComponent(did)}`,
      )
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

<DetailHeader label="Add to the pool" />

{#if noSpaces}
  <SpacesRequired what="Pools" />
{:else}
<div class="page">
  <p class="lede">
    <Lock size={13} />
    <span>
      This gallery goes into {group.data?.displayName ?? 'the group'}'s pool — a permissioned space
      only its members can read. The photos stay in your repo, and leave with you.
    </span>
  </p>

  <input
    type="file"
    accept="image/*"
    multiple
    data-testid="pool-photos"
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

  {#if error}
    <p class="error">{error}</p>
  {/if}

  <Button onclick={publish} disabled={!canPublish}>
    {publishing ? 'Adding…' : 'Add to the pool'}
  </Button>
</div>
{/if}

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
  .thumbs { display: flex; flex-wrap: wrap; gap: 8px; }
  .thumb { position: relative; width: 72px; height: 72px; }
  .thumb img { width: 100%; height: 100%; object-fit: cover; border-radius: 8px; }
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
  .error { margin: -8px 0 0; font-size: 13px; color: var(--danger); }
</style>
