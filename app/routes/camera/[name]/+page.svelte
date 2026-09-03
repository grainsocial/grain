<script lang="ts">
  import GalleryGrid from '$lib/components/organisms/GalleryGrid.svelte'
  import PinButton from '$lib/components/atoms/PinButton.svelte'
  import PageHeading from '$lib/components/molecules/PageHeading.svelte'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'
  import { createInfiniteQuery } from '@tanstack/svelte-query'
  import { cameraFeedInfiniteQuery } from '$lib/queries'
  import { isAuthenticated } from '$lib/stores'

  let { data } = $props()

  const camera = $derived(data.camera)
  const feed = createInfiniteQuery(() => cameraFeedInfiniteQuery(camera))
  const items = $derived(feed.data?.pages.flatMap((p) => p.items ?? []) ?? [])

</script>

<OGMeta title="{camera} - grain" />

<div class="camera">
  <PageHeading title={camera} back>
    {#snippet actions()}
      {#if $isAuthenticated}
        <PinButton
          feed={{
            id: `camera:${camera}`,
            label: camera,
            type: 'camera',
            path: `/camera/${encodeURIComponent(camera)}`,
          }}
        />
      {/if}
    {/snippet}
  </PageHeading>

  <GalleryGrid
    {items}
    loading={feed.isLoading}
    emptyText="No galleries from this camera yet."
    hasMore={feed.hasNextPage}
    loadingMore={feed.isFetchingNextPage}
    onLoadMore={() => feed.fetchNextPage()}
  />
</div>

<style>
  .camera {
    padding: 0 0 32px;
  }
  .camera :global(.grid) {
    margin-top: 18px;
  }
</style>
