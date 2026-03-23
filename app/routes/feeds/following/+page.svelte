<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query'
  import FeedList from '$lib/components/organisms/FeedList.svelte'
  import FeedTabs from '$lib/components/molecules/FeedTabs.svelte'
  import { followingFeedQuery } from '$lib/queries'
  import { viewer } from '$lib/stores'

  const feed = createQuery(() => followingFeedQuery($viewer?.did ?? ''))
</script>

<FeedTabs />
{#if !$viewer?.did}
  <div class="empty">Log in to see galleries from people you follow.</div>
{:else if feed.isLoading}
  <FeedList feed="following" params={{ actor: $viewer.did }} skeleton />
{:else}
  <FeedList feed="following" params={{ actor: $viewer.did }} initialItems={feed.data?.items ?? []} initialCursor={feed.data?.cursor} />
{/if}

<style>
  .empty {
    text-align: center;
    color: var(--text-muted);
    padding: 48px 16px;
    font-size: 14px;
  }
</style>
