<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query'
  import FeedList from '$lib/components/organisms/FeedList.svelte'
  import FeedTabs from '$lib/components/molecules/FeedTabs.svelte'
  import StoryStrip from '$lib/components/molecules/StoryStrip.svelte'
  import StoryViewer from '$lib/components/organisms/StoryViewer.svelte'
  import StoryCreate from '$lib/components/molecules/StoryCreate.svelte'
  import { recentFeedQuery } from '$lib/queries'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'

  const feed = createQuery(() => recentFeedQuery())

  let showViewer = $state(false)
  let viewerDid = $state('')
  let showCreate = $state(false)

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
<StoryStrip onCreateStory={openCreate} onViewStory={openViewer} />
{#if feed.isLoading}
  <FeedList feed="recent" skeleton />
{:else}
  <FeedList feed="recent" initialItems={feed.data?.items ?? []} initialCursor={feed.data?.cursor} />
{/if}

{#if showViewer}
  <StoryViewer initialDid={viewerDid} onclose={closeViewer} />
{/if}

{#if showCreate}
  <StoryCreate onclose={closeCreate} />
{/if}
