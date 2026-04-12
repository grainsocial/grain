<script lang="ts">
  import { createQuery, useQueryClient } from '@tanstack/svelte-query'
  import FeedList from '$lib/components/organisms/FeedList.svelte'
  import FeedTabs from '$lib/components/molecules/FeedTabs.svelte'
  import StoryStrip from '$lib/components/molecules/StoryStrip.svelte'
  import PullToRefresh from '$lib/components/molecules/PullToRefresh.svelte'
  import StoryViewer from '$lib/components/organisms/StoryViewer.svelte'
  import StoryCreate from '$lib/components/molecules/StoryCreate.svelte'
  import { recentFeedQuery } from '$lib/queries'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'

  const queryClient = useQueryClient()
  const feed = createQuery(() => recentFeedQuery())

  let showViewer = $state(false)
  let viewerDid = $state('')
  let showCreate = $state(false)

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['getFeed'] }),
      queryClient.invalidateQueries({ queryKey: ['storyAuthors'] }),
    ])
  }

  function openViewer(did: string) {
    viewerDid = did
    showViewer = true
  }

  function closeViewer() {
    showViewer = false
  }

  function openCreate() {
    showCreate = true
  }

  function closeCreate() {
    showCreate = false
  }
</script>

<OGMeta title="grain" />

<FeedTabs />

<PullToRefresh onRefresh={refresh}>
  <StoryStrip onCreateStory={openCreate} onViewStory={openViewer} />
  {#if feed.isLoading}
    <FeedList feed="recent" skeleton />
  {:else}
    <FeedList feed="recent" initialItems={feed.data?.items ?? []} initialCursor={feed.data?.cursor} />
  {/if}
</PullToRefresh>

{#if showViewer}
  <StoryViewer initialDid={viewerDid} onclose={closeViewer} />
{/if}

{#if showCreate}
  <StoryCreate onclose={closeCreate} />
{/if}
