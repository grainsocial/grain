<script lang="ts">
  import { Search, Plus } from 'lucide-svelte'
  import { page } from '$app/state'
  import { pinnedFeeds, feedIcon } from '$lib/preferences'
  import { isAuthenticated } from '$lib/stores'
  import { createQuery } from '@tanstack/svelte-query'
  import { camerasQuery, locationsQuery } from '$lib/queries'

  const camerasQ = createQuery(() => camerasQuery())
  const locationsQ = createQuery(() => locationsQuery())
</script>

<aside class="sidebar-right">
  <form action="/search" class="search-wrapper">
    <span class="search-icon"><Search size={16} /></span>
    <input
      type="text"
      name="q"
      class="search-input"
      placeholder="Search..."
    />
  </form>

  <div class="sidebar-card">
    <div class="sidebar-card-header">Feeds</div>
    {#each $pinnedFeeds as feed (feed.id)}
      <a
        href={feed.path}
        class="sidebar-link"
        class:active={page.url.pathname + page.url.search === feed.path || page.url.pathname === feed.path}
      >
        <span class="sidebar-link-icon"><svelte:component this={feedIcon(feed)} size={16} /></span>
        <span class="sidebar-link-label">{feed.label}</span>
      </a>
    {/each}
    {#if $isAuthenticated}
      <a href="/feeds" class="sidebar-link more-feeds">
        <span class="sidebar-link-icon"><Plus size={16} /></span>
        <span class="sidebar-link-label">More feeds</span>
      </a>
    {/if}
  </div>

  {#if camerasQ.data?.length}
    <div class="sidebar-card">
      <div class="sidebar-card-header">Cameras</div>
      <div class="camera-grid">
        {#each (camerasQ.data ?? []).slice(0, 12) as c}
          <a class="camera-pill" href="/camera/{encodeURIComponent(c.camera)}">{c.camera}</a>
        {/each}
      </div>
    </div>
  {/if}

  {#if locationsQ.data?.length}
    <div class="sidebar-card">
      <div class="sidebar-card-header">Locations</div>
      <div class="camera-grid">
        {#each (locationsQ.data ?? []).slice(0, 12) as loc}
          <a class="camera-pill" href="/location/{encodeURIComponent(loc.h3Index)}?name={encodeURIComponent(loc.name)}">{loc.name}</a>
        {/each}
      </div>
    </div>
  {/if}

  <div class="sidebar-footer">
    <div class="footer-links">
      <a href="/support/terms">Terms</a>
      <a href="/support/privacy">Privacy</a>
      <a href="/support/copyright">Copyright</a>
      <a href="/support/community-guidelines">Guidelines</a>
    </div>
    <span>Powered by <a href="https://atproto.com">AT Protocol</a></span>
  </div>
</aside>

<style>
  .sidebar-right {
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .sidebar-right::-webkit-scrollbar { width: 0; }

  .search-wrapper { position: relative; }
  .search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-faint);
    font-size: 14px;
    pointer-events: none;
    display: flex;
    align-items: center;
  }
  .search-input {
    width: 100%;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 9px 16px 9px 36px;
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 16px;
    outline: none;
    transition: border-color 0.15s, background 0.15s;
  }
  .search-input::placeholder { color: var(--text-faint); }
  .search-input:focus { border-color: var(--grain); background: var(--bg-root); }

  .sidebar-card {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 14px;
  }
  .sidebar-card-header {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 17px;
    padding: 12px 16px;
  }
  .sidebar-link {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    font-size: 14px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: background 0.12s;
    text-decoration: none;
    min-width: 0;
  }
  .sidebar-link-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
  .sidebar-link:hover { background: var(--bg-hover); color: var(--text-primary); }
  .sidebar-link:last-child { border-radius: 0 0 14px 14px; }
  .sidebar-link.active { color: var(--grain); font-weight: 600; }
  .sidebar-link.more-feeds { color: var(--grain); font-size: 13px; }
  .sidebar-link-icon {
    width: 20px;
    font-size: 15px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .camera-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 0 16px 14px;
  }
  .camera-pill {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    color: var(--text-secondary);
    padding: 4px 12px;
    border-radius: 14px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
    font-family: var(--font-body);
    text-decoration: none;
  }
  .camera-pill:hover {
    border-color: var(--grain);
    color: var(--text-primary);
  }

  .sidebar-footer {
    padding: 12px 16px;
    font-size: 11px;
    color: var(--text-faint);
    line-height: 1.8;
  }
  .footer-links {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
    margin-bottom: 4px;
  }
  .sidebar-footer a { color: var(--text-muted); text-decoration: none; }
  .sidebar-footer a:hover { text-decoration: underline; }

  @media (max-width: 1060px) { .sidebar-right { display: none; } }
</style>
