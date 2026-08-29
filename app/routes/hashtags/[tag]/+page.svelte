<script lang="ts">
  import GalleryGrid from '$lib/components/organisms/GalleryGrid.svelte'
  import PinButton from '$lib/components/atoms/PinButton.svelte'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'
  import { ArrowLeft } from 'lucide-svelte'
  import { createInfiniteQuery } from '@tanstack/svelte-query'
  import { hashtagFeedInfiniteQuery } from '$lib/queries'
  import { isAuthenticated } from '$lib/stores'
  import { goto } from '$app/navigation'

  let { data } = $props()

  const tag = $derived(data.tag)
  const feed = createInfiniteQuery(() => hashtagFeedInfiniteQuery(tag))
  const items = $derived(feed.data?.pages.flatMap((p) => p.items ?? []) ?? [])

  function back() {
    if (window.history.length > 1) history.back()
    else goto('/')
  }
</script>

<OGMeta title="#{tag} - grain" />

<div class="hashtag">
  <header class="head">
    <div class="head-actions">
      <button class="icon-btn" type="button" onclick={back} aria-label="Back">
        <ArrowLeft size={20} />
      </button>
      {#if $isAuthenticated}
        <PinButton
          feed={{
            id: `hashtag:${tag}`,
            label: tag,
            type: 'hashtag',
            path: `/hashtags/${encodeURIComponent(tag)}`,
          }}
        />
      {/if}
    </div>
    <h1>#{tag}</h1>
  </header>

  <GalleryGrid
    {items}
    loading={feed.isLoading}
    emptyText="No galleries with this hashtag yet."
    hasMore={feed.hasNextPage}
    loadingMore={feed.isFetchingNextPage}
    onLoadMore={() => feed.fetchNextPage()}
  />
</div>

<style>
  .hashtag {
    padding: 0 0 32px;
  }
  .hashtag :global(.grid) {
    margin-top: 18px;
  }
  /* No imagery to frame, so this reads as a page heading rather than a hero
     panel — an empty tinted box looked washed out in light mode and added
     nothing in dark. Matches /explore. */
  .head {
    padding: 18px 16px 0;
  }
  .head-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }
  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    margin-left: -6px;
    border: none;
    border-radius: 50%;
    background: none;
    color: var(--text-primary);
    cursor: pointer;
  }
  .icon-btn:hover { background: var(--bg-hover); }
  h1 {
    font-family: var(--font-display);
    font-size: 34px;
    font-weight: 800;
    letter-spacing: -0.015em;
    line-height: 1.15;
    margin: 0;
    overflow-wrap: anywhere;
  }

  @media (max-width: 600px) {
    h1 { font-size: 26px; }
  }
</style>