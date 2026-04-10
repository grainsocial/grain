<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query'
  import { galleryQuery } from '$lib/queries'
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import GalleryCard from '$lib/components/molecules/GalleryCard.svelte'
  import CommentSheet from '$lib/components/organisms/CommentSheet.svelte'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'
  import BskyIcon from '$lib/components/atoms/BskyIcon.svelte'
  import type { GalleryView } from '$hatk/client'

  let { data } = $props()

  const did = $derived(data.did)
  const rkey = $derived(data.rkey)
  const galleryUri = $derived(data.galleryUri)
  const galleryQ = createQuery(() => galleryQuery(galleryUri))
  const gallery = $derived((galleryQ.data as GalleryView) ?? null)
  const bskyUrl = $derived((gallery as any)?.crossPost?.url ?? null)

  let commentSheetOpen = $state(false)

  function openComments() {
    commentSheetOpen = true
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
</style>
