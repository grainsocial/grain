<script lang="ts">
  import type { GalleryView } from '$hatk/client'
  import GalleryCard from '../molecules/GalleryCard.svelte'
  import CommentSheet from './CommentSheet.svelte'
  import SuggestedFollows from './SuggestedFollows.svelte'
  import GalleryCardSkeleton from '../molecules/GalleryCardSkeleton.svelte'
  import { queryFeed } from '$lib/feed'
  import { isAuthenticated } from '$lib/stores'
  import Spinner from '../atoms/Spinner.svelte'
  import { infiniteScroll } from '$lib/actions/infinite-scroll'

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

  function openComments(gallery: GalleryView) {
    if (!$isAuthenticated) return
    commentGalleryUri = gallery.uri
    commentSheetOpen = true
  }

  async function load() {
    loading = true
    error = null
    try {
      const result = await queryFeed(feed, { limit: '30', ...params })
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
      const result = await queryFeed(feed, { limit: '30', cursor, ...params })
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
    <GalleryCard gallery={item} onCommentClick={() => openComments(item)} />
    {#if i === 4 && $isAuthenticated}
      <SuggestedFollows />
    {/if}
  {/each}

  <CommentSheet
    open={commentSheetOpen}
    subjectUri={commentGalleryUri}
    onClose={() => { commentSheetOpen = false }}
  />

  {#if cursor}
    <div use:infiniteScroll={() => { if (!loadingMore) loadMore() }} class="sentinel">
      {#if loadingMore}<Spinner />{/if}
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
  .sentinel {
    display: flex;
    justify-content: center;
    padding: 20px;
  }
</style>
