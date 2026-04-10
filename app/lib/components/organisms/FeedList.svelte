<script lang="ts">
  import type { GalleryView, PhotoView } from '$hatk/client'
  import GalleryCard from '../molecules/GalleryCard.svelte'
  import CommentSheet from './CommentSheet.svelte'
  import SuggestedFollows from './SuggestedFollows.svelte'
  import GalleryCardSkeleton from '../molecules/GalleryCardSkeleton.svelte'
  import { queryFeed } from '$lib/feed'
  import { isAuthenticated } from '$lib/stores'

  let {
    feed,
    params = {},
    initialItems,
    initialCursor,
    skeleton = false,
  }: {
    feed: string
    params?: Record<string, string>
    initialItems?: GalleryView[]
    initialCursor?: string
    skeleton?: boolean
  } = $props()

  let items: GalleryView[] = $state([])
  let cursor: string | undefined = $state(undefined)
  let loading = $state(true)
  let loadingMore = $state(false)
  let error: string | null = $state(null)

  // Comment sheet state
  let commentSheetOpen = $state(false)
  let commentGalleryUri = $state('')
  let commentFocusUri = $state<string | null>(null)
  let commentFocusThumb = $state<string | null>(null)

  function openComments(gallery: GalleryView, focusPhoto: PhotoView | null) {
    if (!$isAuthenticated) return
    commentGalleryUri = gallery.uri
    if (focusPhoto) {
      commentFocusUri = focusPhoto.uri
      commentFocusThumb = focusPhoto.thumb ?? null
    } else {
      commentFocusUri = null
      commentFocusThumb = null
    }
    commentSheetOpen = true
  }

  async function load() {
    loading = true
    error = null
    try {
      const result = await queryFeed(feed, { limit: '50', ...params })
      items = result.items ?? []
      cursor = result.cursor
    } catch (e: any) {
      error = e.message
    } finally {
      loading = false
    }
  }

  async function loadMore() {
    if (!cursor || loadingMore) return
    loadingMore = true
    try {
      const result = await queryFeed(feed, { limit: '50', cursor, ...params })
      items = [...items, ...(result.items ?? [])]
      cursor = result.cursor
    } finally {
      loadingMore = false
    }
  }

  $effect(() => {
    if (skeleton) {
      loading = true
      return
    }
    void feed
    void params
    if (initialItems) {
      items = initialItems
      cursor = initialCursor
      loading = false
    } else {
      load()
    }
  })
</script>

{#if loading && items.length === 0}
  {#each {length: 3} as _}
    <GalleryCardSkeleton />
  {/each}
{:else if error && items.length === 0}
  <div class="error-state">{error}</div>
{:else if items.length === 0 && !loading}
  <div class="empty-state">
    No galleries found.
  </div>
{:else}
  {#each items as item, i (`${item.uri}:${i}`)}
    <GalleryCard gallery={item} onCommentClick={(photo) => openComments(item, photo)} />
    {#if i === 4 && $isAuthenticated}
      <SuggestedFollows />
    {/if}
  {/each}

  <CommentSheet
    open={commentSheetOpen}
    galleryUri={commentGalleryUri}
    focusPhotoUri={commentFocusUri}
    focusPhotoThumb={commentFocusThumb}
    onClose={() => { commentSheetOpen = false }}
  />

  {#if cursor}
    <div class="load-more">
      <button class="load-more-btn" onclick={() => loadMore()} disabled={loadingMore}>
        {loadingMore ? 'Loading\u2026' : 'Load more'}
      </button>
    </div>
  {/if}
{/if}

<style>
  .error-state, .empty-state {
    padding: 48px;
    text-align: center;
    color: var(--text-secondary);
  }
  .error-state { color: var(--danger); }
  .empty-state { display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .load-more { padding: 16px; text-align: center; }
  .load-more-btn {
    padding: 10px 24px;
    border-radius: 20px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    color: var(--text-secondary);
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.12s;
  }
  .load-more-btn:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  .load-more-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
