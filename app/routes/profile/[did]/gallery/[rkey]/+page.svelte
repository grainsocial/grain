<script lang="ts">
  import { goto } from '$app/navigation'
  import { createQuery, useQueryClient } from '@tanstack/svelte-query'
  import { callXrpc } from '$hatk/client'
  import { galleryQuery } from '$lib/queries'
  import { viewer } from '$lib/stores'
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import GalleryCard from '$lib/components/molecules/GalleryCard.svelte'
  import CommentSheet from '$lib/components/organisms/CommentSheet.svelte'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'
  import { Trash2 } from 'lucide-svelte'
  import BskyIcon from '$lib/components/atoms/BskyIcon.svelte'
  import type { GalleryView, PhotoView } from '$hatk/client'

  let { data } = $props()
  const queryClient = useQueryClient()

  const did = $derived(data.did)
  const rkey = $derived(data.rkey)
  const galleryUri = $derived(data.galleryUri)
  const galleryQ = createQuery(() => galleryQuery(galleryUri))
  const gallery = $derived((galleryQ.data as GalleryView) ?? null)
  const bskyUrl = $derived((gallery as any)?.crossPost?.url ?? null)

  const isOwner = $derived($viewer?.did === gallery?.creator?.did)

  let commentSheetOpen = $state(false)
  let focusPhotoUri = $state<string | null>(null)
  let focusPhotoThumb = $state<string | null>(null)
  let deleting = $state(false)

  function openComments(focusPhoto: PhotoView | null) {
    if (focusPhoto) {
      focusPhotoUri = focusPhoto.uri
      focusPhotoThumb = focusPhoto.thumb ?? null
    } else {
      focusPhotoUri = null
      focusPhotoThumb = null
    }
    commentSheetOpen = true
  }

  async function deleteGallery() {
    if (!gallery || deleting) return
    if (!confirm('Delete this gallery? This cannot be undone.')) return

    deleting = true
    try {
      await callXrpc('social.grain.unspecced.deleteGallery', { rkey })
      queryClient.invalidateQueries({ queryKey: ['getFeed'] })
      goto(`/profile/${did}`)
    } catch (err) {
      console.error('Failed to delete gallery:', err)
      alert('Failed to delete gallery. Please try again.')
    } finally {
      deleting = false
    }
  }
</script>

<OGMeta
  title={gallery ? `${gallery.title} by @${gallery.creator.handle} — Grain` : 'Gallery — Grain'}
  description={gallery ? (gallery.description || `Photo gallery on Grain`) : 'Photo gallery on Grain'}
  image="/og/profile/{did}/gallery/{rkey}"
/>
<DetailHeader label={gallery?.title ?? 'Gallery'}>
  {#snippet actions()}
    {#if bskyUrl}
      <a class="bsky-link" href={bskyUrl} target="_blank" rel="noopener noreferrer" title="View on Bluesky">
        <BskyIcon />
      </a>
    {/if}
    {#if isOwner}
      <button class="delete-btn" type="button" onclick={deleteGallery} disabled={deleting} aria-label="Delete gallery">
        <Trash2 size={18} />
      </button>
    {/if}
  {/snippet}
</DetailHeader>
<div class="detail-page">
  {#if galleryQ.isLoading}
    <p class="loading">Loading...</p>
  {:else if !gallery}
    <p class="not-found">Gallery not found</p>
  {:else}
    <GalleryCard {gallery} onCommentClick={openComments} />

    <CommentSheet
      open={commentSheetOpen}
      galleryUri={gallery.uri}
      {focusPhotoUri}
      {focusPhotoThumb}
      onClose={() => { commentSheetOpen = false }}
    />
  {/if}
</div>

<style>
  .detail-page {
    max-width: 600px;
    margin: 0 auto;
  }
  .loading, .not-found {
    text-align: center;
    color: var(--text-muted);
    padding: 48px 16px;
    font-size: 14px;
  }
  .bsky-link {
    color: var(--text-muted);
    display: flex;
    align-items: center;
    padding: 4px;
    margin-right: 8px;
    transition: color 0.15s;
  }
  .bsky-link:hover {
    color: #0085ff;
  }
  .delete-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    transition: color 0.15s;
  }
  .delete-btn:hover {
    color: #f87171;
  }
  .delete-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
