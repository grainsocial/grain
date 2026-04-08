<script lang="ts">
  import { Home, Plus, Settings, Bell } from 'lucide-svelte'
  import AuthBar from './AuthBar.svelte'
  import Avatar from '../atoms/Avatar.svelte'
  import Button from '../atoms/Button.svelte'
  import LoginModal from './LoginModal.svelte'
  import { isAuthenticated, viewer } from '$lib/stores'
  import { page } from '$app/state'
  import { createQuery } from '@tanstack/svelte-query'
  import { unseenNotificationCountQuery } from '$lib/queries'

  let loginOpen = $state(false)

  const unseenCount = createQuery(() => ({
    ...unseenNotificationCountQuery($viewer?.did ?? ''),
    enabled: !!$viewer?.did,
  }))
</script>

{#if !$isAuthenticated}
  <LoginModal bind:open={loginOpen} />
{/if}

<nav class="sidebar-left" class:signed-out={!$isAuthenticated}>
  <div class="sidebar-top">
    {#if $isAuthenticated && $viewer}
      <a href="/profile/{$viewer.did}" class="sidebar-avatar-link">
        <Avatar did={$viewer.did} src={$viewer.avatar} name={$viewer.displayName || $viewer.handle} size={42} />
      </a>
    {:else}
      <div class="signed-out-hero">
        <a href="/" class="logo-text">grain</a>
        <p class="sidebar-tagline">Share your<br/>photography</p>
        <Button size="sm" onclick={() => (loginOpen = true)}>Sign in</Button>
      </div>
    {/if}
  </div>
  <div class="nav-items">
    {#if $isAuthenticated}
      <a href="/" class="nav-item" class:active={page.url.pathname === '/'} title="Home">
        <Home size={22} />
      </a>
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
  {#if $isAuthenticated}
    <div class="sidebar-bottom">
      <AuthBar />
    </div>
  {/if}
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
  .signed-out {
    align-items: flex-start;
    padding: 20px 16px 16px;
  }
  .sidebar-top {
    margin-bottom: 28px;
  }
  .signed-out-hero {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  .logo-text {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 22px;
    display: block;
    color: #fff;
    text-decoration: none;
    letter-spacing: -0.02em;
  }
  .sidebar-tagline {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-muted);
    margin: 0;
    line-height: 1.35;
    letter-spacing: -0.01em;
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
