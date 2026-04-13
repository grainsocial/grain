<script lang="ts">
  import { page } from '$app/state'
  import { pinnedFeeds, DEFAULT_PINNED } from '$lib/preferences'
  import { isAuthenticated } from '$lib/stores'

  const authOnlyFeeds = new Set(['following', 'foryou'])
  const pinnedIds = $derived(new Set($pinnedFeeds.map((f) => f.id)))

  // Include unpinned default feed if user is currently viewing it
  const currentUnpinned = $derived(
    DEFAULT_PINNED.find((f) => !pinnedIds.has(f.id) && page.url.pathname === f.path)
  )

  const tabFeeds = $derived.by(() => {
    const pinned = $isAuthenticated ? $pinnedFeeds : $pinnedFeeds.filter((f) => !authOnlyFeeds.has(f.id))
    if (currentUnpinned && $isAuthenticated) return [...pinned, currentUnpinned]
    return pinned
  })
</script>

<div class="center-header">
  <div class="feed-tabs">
    {#each tabFeeds as feed, i (feed.id)}
      {@const href = i === 0 ? '/' : feed.path}
      {@const isActive = i === 0
        ? page.url.pathname === '/'
        : page.url.pathname + page.url.search === feed.path || page.url.pathname === feed.path}
      <a
        class="feed-tab"
        class:active={isActive}
        {href}
      >{feed.label}</a>
    {/each}
  </div>
</div>

<style>
  .center-header {
    position: sticky;
    top: 0;
    z-index: 50;
    max-width: 100%;
    overflow: hidden;
    background: rgba(8, 11, 18, 0.85);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--border);
  }
  .feed-tabs {
    display: flex;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .feed-tabs::-webkit-scrollbar { display: none; }
  .feed-tab {
    flex: 1 0 0;
    min-width: max-content;
    padding: 12px 16px;
    text-align: center;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
    cursor: pointer;
    text-decoration: none;
    border-bottom: 2px solid transparent;
    background: none;
    font-family: inherit;
    transition: color 0.15s, border-bottom-color 0.15s, background-color 0.15s;
  }
  .feed-tab:hover { color: var(--text-secondary); background: var(--bg-hover); }
  .feed-tab.active { color: var(--text-primary); border-bottom-color: var(--grain); font-weight: 600; }
</style>
