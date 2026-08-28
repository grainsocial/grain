<script lang="ts">
  import { createQuery, useQueryClient } from '@tanstack/svelte-query'
  import FeedList from '$lib/components/organisms/FeedList.svelte'
  import FeedTabs from '$lib/components/molecules/FeedTabs.svelte'
  import PullToRefresh from '$lib/components/molecules/PullToRefresh.svelte'
  import { groupsFeedQuery } from '$lib/queries'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'

  const queryClient = useQueryClient()
  const feed = createQuery(() => groupsFeedQuery())

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['getFeed'] })
  }
</script>

<OGMeta title="Groups — grain" />

<FeedTabs />

<PullToRefresh onRefresh={refresh}>
  {#if feed.isLoading}
    <FeedList feed="groups" skeleton />
  {:else}
    <FeedList feed="groups" initialItems={feed.data?.items ?? []} initialCursor={feed.data?.cursor} />
  {/if}
</PullToRefresh>
