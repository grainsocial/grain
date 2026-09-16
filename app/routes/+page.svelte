<script lang="ts">
  import { createQuery, useQueryClient } from '@tanstack/svelte-query'
  import FeedList from '$lib/components/organisms/FeedList.svelte'
  import FeedTabs from '$lib/components/molecules/FeedTabs.svelte'
  import StoryStrip from '$lib/components/molecules/StoryStrip.svelte'
  import PullToRefresh from '$lib/components/molecules/PullToRefresh.svelte'
  import StoryViewer from '$lib/components/organisms/StoryViewer.svelte'
  import StoryCreate from '$lib/components/molecules/StoryCreate.svelte'
  import { recentFeedQuery, followingFeedQuery, forYouFeedQuery, groupsFeedQuery } from '$lib/queries'
  import { pinnedFeeds, SPACES_ONLY_FEEDS } from '$lib/preferences'
  import { spaceSupportQuery } from '$lib/queries'
  import { viewer } from '$lib/stores'
  import { goto } from '$app/navigation'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'

  const CORE_FEEDS = new Set(['recent', 'following', 'foryou', 'groups'])

  // The home feed is whichever is pinned first, so a feed the viewer's PDS
  // cannot serve has to be skipped here too — hiding it from the tabs is not
  // enough when it is also what `/` renders. Reordering pins is the only way
  // to land here, but landing here would mean a blank home page.
  const spaces = createQuery(() => ({ ...spaceSupportQuery(), enabled: !!$viewer?.did }))
  const hasSpaces = $derived(spaces.data?.supported === true)
  const usableFeeds = $derived(
    $pinnedFeeds.filter((f) => !SPACES_ONLY_FEEDS.has(f.id) || hasSpaces)
  )
  const first = $derived(usableFeeds[0])
  const firstFeed = $derived(first?.id ?? 'recent')
  const needsActor = $derived(firstFeed === 'following' || firstFeed === 'foryou')
  const actorDid = $derived($viewer?.did ?? '')

  // If first pinned feed is a custom feed (camera, location, hashtag), redirect to it
  $effect(() => {
    if (first && !CORE_FEEDS.has(first.id)) {
      goto(first.path, { replaceState: true })
    }
  })

  const queryClient = useQueryClient()
  const feed = createQuery(() => {
    if (firstFeed === 'following') return followingFeedQuery(actorDid)
    if (firstFeed === 'foryou') return forYouFeedQuery(actorDid)
    if (firstFeed === 'groups') return groupsFeedQuery()
    return recentFeedQuery()
  })

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
  {#if needsActor && !actorDid}
    <div class="empty">Log in to see this feed.</div>
  {:else if feed.isLoading}
    <FeedList feed={firstFeed} params={needsActor ? { actor: actorDid } : undefined} skeleton onStoryTap={openViewer} />
  {:else}
    <FeedList feed={firstFeed} params={needsActor ? { actor: actorDid } : undefined} initialItems={feed.data?.items ?? []} initialCursor={feed.data?.cursor} onStoryTap={openViewer} />
  {/if}
</PullToRefresh>

{#if showViewer}
  <StoryViewer initialDid={viewerDid} onclose={closeViewer} />
{/if}

{#if showCreate}
  <StoryCreate onclose={closeCreate} />
{/if}

<style>
  .empty {
    text-align: center;
    color: var(--text-muted);
    padding: 48px 16px;
    font-size: 14px;
  }
</style>
