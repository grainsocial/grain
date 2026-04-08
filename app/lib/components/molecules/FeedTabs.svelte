<script lang="ts">
  import { page } from '$app/state'
  import { pinnedFeeds } from '$lib/preferences'
  import { isAuthenticated } from '$lib/stores'

  const tabFeeds = $derived(
    $isAuthenticated ? $pinnedFeeds : $pinnedFeeds.filter((f) => f.id !== 'following')
  )
</script>

<div class="center-header">
  <div class="feed-tabs">
    {#each tabFeeds as feed (feed.id)}
      <a
        class="feed-tab"
        class:active={page.url.pathname + page.url.search === feed.path || page.url.pathname === feed.path}
        href={feed.path}
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
  .feed-tab.active { color: var(--text-primary); border-bottom-color: var(--text-primary); font-weight: 600; }
</style>
