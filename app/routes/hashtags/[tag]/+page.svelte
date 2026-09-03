<script lang="ts">
  import GalleryGrid from '$lib/components/organisms/GalleryGrid.svelte'
  import PinButton from '$lib/components/atoms/PinButton.svelte'
  import PageHeading from '$lib/components/molecules/PageHeading.svelte'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'
  import { createInfiniteQuery } from '@tanstack/svelte-query'
  import { hashtagFeedInfiniteQuery } from '$lib/queries'
  import { isAuthenticated } from '$lib/stores'

  let { data } = $props()

  const tag = $derived(data.tag)
  const feed = createInfiniteQuery(() => hashtagFeedInfiniteQuery(tag))
  const items = $derived(feed.data?.pages.flatMap((p) => p.items ?? []) ?? [])

</script>

<OGMeta title="#{tag} - grain" />

<div class="hashtag">
  <PageHeading title="#{tag}" back>
    {#snippet actions()}
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
    {/snippet}
  </PageHeading>

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
</style>