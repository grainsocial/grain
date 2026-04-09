<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query'
  import FeedList from '$lib/components/organisms/FeedList.svelte'
  import FeedTabs from '$lib/components/molecules/FeedTabs.svelte'
  import { forYouFeedQuery } from '$lib/queries'
  import { viewer } from '$lib/stores'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'

  const feed = createQuery(() => forYouFeedQuery($viewer?.did ?? ''))
</script>

<OGMeta title="For You - grain" />
<FeedTabs />
{#if !$viewer?.did}
  <div class="empty">Log in to get personalized gallery recommendations.</div>
{:else if feed.isLoading}
  <FeedList feed="foryou" params={{ actor: $viewer.did }} skeleton />
{:else}
  <FeedList feed="foryou" params={{ actor: $viewer.did }} initialItems={feed.data?.items ?? []} initialCursor={feed.data?.cursor} />
{/if}

<style>
  .empty {
    text-align: center;
    color: var(--text-muted);
    padding: 48px 16px;
    font-size: 14px;
  }
</style>
