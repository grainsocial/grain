<script lang="ts">
  import { Home, ImagePlus, Settings, Bell, Search, LogOut, Compass } from 'lucide-svelte'
  import Avatar from '../atoms/Avatar.svelte'
  import Button from '../atoms/Button.svelte'
  import LoginModal from './LoginModal.svelte'
  import { isAuthenticated, viewer } from '$lib/stores'
  import { logout } from '$lib/auth'
  import { resetPreferences } from '$lib/preferences'
  import { page } from '$app/state'
  import { createQuery } from '@tanstack/svelte-query'
  import { unseenNotificationCountQuery } from '$lib/queries'

  let {
    rail = false,
    onSearch,
    searchOpen = false,
  }: { rail?: boolean; onSearch?: () => void; searchOpen?: boolean } = $props()

  let loginOpen = $state(false)

  const unseenCount = createQuery(() => ({
    ...unseenNotificationCountQuery($viewer?.did ?? ''),
    enabled: !!$viewer?.did,
  }))

  async function doLogout() {
    await logout()
    resetPreferences()
    $viewer = null
    window.location.href = '/'
  }
</script>

{#if !$isAuthenticated}
  <LoginModal bind:open={loginOpen} />
{/if}

<nav class="sidebar-left" class:signed-out={!$isAuthenticated} class:rail>
  <div class="sidebar-top">
    <a href="/" class="logo-text">grain</a>
    {#if !$isAuthenticated}
      <p class="sidebar-tagline">Share your<br/>photography</p>
      <Button size="sm" onclick={() => (loginOpen = true)}>Sign in</Button>
    {/if}
  </div>

  <div class="nav-items">
    {#if $isAuthenticated}
      <a href="/" class="nav-item" class:active={page.url.pathname === '/'}>
        <Home size={24} />
        <span class="nav-label">Home</span>
      </a>
      <button
        type="button"
        class="nav-item"
        class:active={searchOpen || page.url.pathname === '/search'}
        onclick={() => onSearch?.()}
      >
        <Search size={24} />
        <span class="nav-label">Search</span>
      </button>
      <a href="/explore" class="nav-item" class:active={page.url.pathname === '/explore'}>
        <Compass size={24} />
        <span class="nav-label">Explore</span>
      </a>
      <a href="/notifications" class="nav-item" class:active={page.url.pathname === '/notifications'}>
        <span class="bell-wrap">
          <Bell size={24} />
          {#if (unseenCount.data ?? 0) > 0}
            <span class="badge">{unseenCount.data! > 99 ? '99+' : unseenCount.data}</span>
          {/if}
        </span>
        <span class="nav-label">Notifications</span>
      </a>
      {#if $viewer}
        <a href="/profile/{$viewer.did}" class="nav-item" class:active={page.url.pathname === `/profile/${$viewer.did}`}>
          <Avatar did={$viewer.did} src={$viewer.avatar} name={$viewer.displayName || $viewer.handle} size={24} />
          <span class="nav-label">Profile</span>
        </a>
      {/if}
      <a href="/settings" class="nav-item" class:active={page.url.pathname.startsWith('/settings')}>
        <Settings size={24} />
        <span class="nav-label">Settings</span>
      </a>
    {/if}
  </div>

  {#if $isAuthenticated}
    <a href="/create" class="create-btn" class:active={page.url.pathname === '/create'}>
      <ImagePlus size={22} />
      <span class="nav-label">Create</span>
    </a>
  {/if}

  <div class="sidebar-bottom">
    {#if $isAuthenticated}
      <button class="nav-item logout" type="button" onclick={doLogout}>
        <LogOut size={24} />
        <span class="nav-label">Log out</span>
      </button>
    {/if}
    <div class="sidebar-footer">
      <a href="/support/terms">Terms</a>
      <a href="/support/privacy">Privacy</a>
      <a href="/support/copyright">Copyright</a>
      <a href="/support/community-guidelines">Guidelines</a>
      <a href="https://atproto.com" target="_blank" rel="noopener noreferrer">AT Protocol</a>
    </div>
  </div>
</nav>

<style>
  .sidebar-left {
    position: sticky;
    top: 0;
    height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    padding: 16px 10px;
    z-index: 101;
  }
  .sidebar-top {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    padding: 6px 14px 22px;
  }
  .logo-text {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 24px;
    display: block;
    color: var(--text-primary);
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
  .nav-items {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .nav-item {
    display: flex;
    align-items: center;
    gap: 16px;
    height: 52px;
    padding: 0 14px;
    border-radius: 14px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
    text-decoration: none;
    background: none;
    border: none;
    font-family: inherit;
    font-size: 15px;
    font-weight: 600;
    width: 100%;
    text-align: left;
  }
  .nav-item :global(svg) {
    flex: none;
  }
  .nav-item:hover { background: var(--bg-hover); color: var(--text-primary); }
  .nav-item.active { color: var(--grain); background: var(--grain-glow); }
  .nav-item.logout { color: var(--text-muted); }
  .nav-item.logout:hover { color: var(--danger); background: var(--danger-bg); }
  .nav-label { white-space: nowrap; }

  /* Create is the sidebar's only primary action, so it sits below the nav list
     as a filled button rather than blending into the item column. */
  .create-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    height: 52px;
    margin: 16px 6px 0;
    border-radius: 999px;
    background: var(--grain-btn);
    color: #fff;
    text-decoration: none;
    font-size: 15px;
    font-weight: 600;
    transition: background 0.12s;
  }
  .create-btn :global(svg) { flex: none; }
  .create-btn:hover, .create-btn.active { background: var(--grain-btn-dim); }

  /* Icon rail: same items, no labels, so a route's own sub-nav is the only
     labelled column on screen. */
  .rail .nav-item {
    width: 52px;
    padding: 0;
    justify-content: center;
    align-self: center;
  }
  .rail .nav-label,
  .rail .sidebar-footer,
  .rail .sidebar-tagline { display: none; }
  .rail .sidebar-top { align-items: center; padding: 6px 0 22px; }
  .rail .create-btn {
    width: 52px;
    align-self: center;
    margin: 16px 0 0;
  }
  .rail .logo-text { font-size: 0; }
  .rail .logo-text::before { content: 'g'; font-size: 26px; }

  .sidebar-bottom {
    margin-top: auto;
    display: flex;
    flex-direction: column;
  }
  .sidebar-footer {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 12px;
    padding: 14px 16px 8px;
    font-size: 11px;
    line-height: 1.6;
  }
  .sidebar-footer a {
    color: var(--text-faint);
    text-decoration: none;
  }
  .sidebar-footer a:hover { color: var(--text-secondary); }

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
    color: var(--on-grain);
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
