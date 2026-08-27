<script lang="ts">
  import { Plus } from 'lucide-svelte'
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
    {#if $isAuthenticated}
      <!-- The right rail used to carry "More feeds"; with it gone this is the
           only route to /feeds, and it belongs beside the feeds anyway. -->
      <a class="feed-tab more-feeds" href="/feeds" title="More feeds">
        <Plus size={15} />
      </a>
    {/if}
  </div>
</div>

<style>
  .center-header {
    position: sticky;
    top: 0;
    z-index: 50;
    max-width: 100%;
    overflow: hidden;
    background: var(--bg-blur);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }
  .feed-tabs {
    display: flex;
    gap: 6px;
    padding: 10px 0;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .feed-tabs::-webkit-scrollbar { display: none; }
  .feed-tab {
    flex: 0 0 auto;
    padding: 9px 18px;
    border-radius: 999px;
    text-align: center;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
    cursor: pointer;
    text-decoration: none;
    background: none;
    font-family: inherit;
    transition: color 0.15s, background-color 0.15s, box-shadow 0.15s;
  }
  .feed-tab:hover { color: var(--text-secondary); background: var(--bg-hover); }
  .more-feeds {
    display: inline-flex;
    align-items: center;
    padding: 9px 12px;
    color: var(--text-muted);
  }
  .feed-tab.active {
    color: var(--text-primary);
    background: var(--bg-surface);
  }

  /* On a phone the container edge is the screen edge. Inset the whole card —
     photo included — so everything stays on one line but nothing touches it. */
  @media (max-width: 600px) {
    .feed-tabs { padding-left: 12px; padding-right: 12px; }
  }
</style>
