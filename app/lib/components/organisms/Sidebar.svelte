<script lang="ts">
  import { Home, Plus, Settings, Bell } from 'lucide-svelte'
  import AuthBar from './AuthBar.svelte'
  import Avatar from '../atoms/Avatar.svelte'
  import { isAuthenticated, viewer } from '$lib/stores'
  import { page } from '$app/state'
  import { createQuery } from '@tanstack/svelte-query'
  import { unseenNotificationCountQuery } from '$lib/queries'

  const unseenCount = createQuery(() => ({
    ...unseenNotificationCountQuery($viewer?.did ?? ''),
    enabled: !!$viewer?.did,
  }))
</script>

<nav class="sidebar-left">
  <div class="sidebar-top">
    {#if $isAuthenticated && $viewer}
      <a href="/profile/{$viewer.did}" class="sidebar-avatar-link">
        <Avatar did={$viewer.did} src={$viewer.avatar} name={$viewer.displayName || $viewer.handle} size={42} />
      </a>
    {:else}
      <a href="/" class="logo-text">grain</a>
    {/if}
  </div>
  <div class="nav-items">
    <a href="/" class="nav-item" class:active={page.url.pathname === '/'} title="Home">
      <Home size={22} />
    </a>
    {#if $isAuthenticated}
      <a href="/notifications" class="nav-item" class:active={page.url.pathname === '/notifications'} title="Notifications">
        <span class="bell-wrap">
          <Bell size={22} />
          {#if (unseenCount.data ?? 0) > 0}
            <span class="badge">{unseenCount.data! > 99 ? '99+' : unseenCount.data}</span>
          {/if}
        </span>
      </a>
      <a href="/settings/profile" class="nav-item" class:active={page.url.pathname.startsWith('/settings')} title="Settings">
        <Settings size={22} />
      </a>
      <a href="/create" class="nav-item" class:active={page.url.pathname === '/create'} title="Create">
        <Plus size={22} />
      </a>
    {/if}
  </div>
  <div class="sidebar-bottom">
    <AuthBar />
  </div>
</nav>

<style>
  .sidebar-left {
    position: sticky;
    top: 0;
    height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    padding: 16px 12px 16px 0;
    border-right: 1px solid var(--border);
    z-index: 101;
  }
  .sidebar-top {
    margin-bottom: 28px;
  }
  .logo-text {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 15px;
    display: block;
    text-align: center;
    color: #fff;
    text-decoration: none;
  }
  .sidebar-avatar-link { text-decoration: none; }
  .nav-items {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: center;
  }
  .nav-item {
    width: 42px;
    height: 42px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s;
    text-decoration: none;
    background: none;
    border: none;
    padding: 0;
    font: inherit;
  }
  .nav-item:hover { background: var(--bg-hover); color: var(--text-primary); }
  .nav-item.active { color: var(--grain); background: var(--grain-glow); }
  .sidebar-bottom {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: flex-end;
  }
  .bell-wrap {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .badge {
    position: absolute;
    top: -6px;
    right: -8px;
    background: var(--grain);
    color: #000;
    font-size: 10px;
    font-weight: 700;
    min-width: 16px;
    height: 16px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
    font-family: var(--font-body);
  }

  @media (max-width: 600px) {
    .sidebar-left { display: none; }
  }
</style>
