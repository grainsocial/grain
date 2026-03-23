<script lang="ts">
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import PinButton from '$lib/components/atoms/PinButton.svelte'
  import { pinnedFeeds, DEFAULT_PINNED, feedIcon } from '$lib/preferences'
  import { isAuthenticated } from '$lib/stores'

  const coreIds = new Set(DEFAULT_PINNED.map((f) => f.id))
  const customFeeds = $derived($pinnedFeeds.filter((f) => !coreIds.has(f.id)))
</script>

<DetailHeader label="My Feeds" />

<div class="feeds-page">
  {#each DEFAULT_PINNED as feed (feed.id)}
    {@const Icon = feedIcon(feed)}
    <a href={feed.path} class="feed-row">
      <span class="feed-icon">
        <Icon size={18} />
      </span>
      <span class="feed-label">{feed.label}</span>
      {#if $isAuthenticated}
        <PinButton {feed} stopPropagation />
      {/if}
    </a>
  {/each}

  {#if customFeeds.length > 0}
    <div class="section-label">Pinned</div>
    {#each customFeeds as feed (feed.id)}
      {@const Icon = feedIcon(feed)}
      <a href={feed.path} class="feed-row">
        <span class="feed-icon">
          <Icon size={18} />
        </span>
        <span class="feed-label">{feed.label}</span>
        {#if $isAuthenticated}
          <PinButton {feed} stopPropagation />
        {/if}
      </a>
    {/each}
  {/if}
</div>

<style>
  .feeds-page {
    display: flex;
    flex-direction: column;
  }
  .feed-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
    text-decoration: none;
    color: var(--text-primary);
    transition: background 0.12s;
  }
  .feed-row:hover {
    background: var(--bg-hover);
  }
  .feed-icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: var(--bg-elevated);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--grain);
    flex-shrink: 0;
  }
  .feed-label {
    font-size: 15px;
    font-weight: 500;
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
  .section-label {
    padding: 12px 16px 4px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
</style>
