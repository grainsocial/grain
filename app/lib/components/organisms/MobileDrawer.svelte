<script lang="ts">
  import { Settings, LayoutList } from 'lucide-svelte'
  import { goto } from '$app/navigation'
  import { isAuthenticated, viewer } from '$lib/stores'
  import Avatar from '../atoms/Avatar.svelte'
  import Button from '../atoms/Button.svelte'
  import { pinnedFeeds, feedIcon, resetPreferences } from '$lib/preferences'
  import { logout } from '$lib/auth'
  import LoginModal from './LoginModal.svelte'
  import { createQuery } from '@tanstack/svelte-query'
  import { camerasQuery, locationsQuery } from '$lib/queries'

  const camerasQ = createQuery(() => camerasQuery())
  const locationsQ = createQuery(() => locationsQuery())

  let { open = $bindable(false) }: { open: boolean } = $props()
  let loginOpen = $state(false)

  function nav(path: string) {
    open = false
    goto(path)
  }

  async function doLogout() {
    await logout()
    resetPreferences()
    $viewer = null
    window.location.href = '/'
  }
</script>

<LoginModal bind:open={loginOpen} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="drawer-overlay" class:open onclick={() => open = false}></div>
<div class="drawer" class:open>
  <div class="drawer-header">
    <button type="button" class="drawer-logo" onclick={() => nav('/')}>grain</button>
  </div>

  {#if !$isAuthenticated}
    <div class="drawer-sign-in">
      <Button onclick={() => { open = false; loginOpen = true }}>Sign In</Button>
    </div>
  {/if}

  {#each $pinnedFeeds as feed (feed.id)}
    {@const Icon = feedIcon(feed)}
    <button class="drawer-link" onclick={() => nav(feed.path)}>
      <span class="drawer-link-icon"><Icon size={18} /></span> {feed.type === 'hashtag' ? feed.label.replace(/^#/, '') : feed.label}
    </button>
  {/each}

  {#if $isAuthenticated}
    <button class="drawer-link" onclick={() => nav('/feeds')}>
      <span class="drawer-link-icon"><LayoutList size={18} /></span> More feeds
    </button>
  {/if}

  {#if $isAuthenticated}
    <button class="drawer-link" onclick={() => nav('/settings')}>
      <span class="drawer-link-icon"><Settings size={18} /></span> Settings
    </button>
  {/if}

  {#if camerasQ.data?.length}
    <div class="drawer-cameras">
      <div class="drawer-cameras-header">Cameras</div>
      <div class="camera-grid">
        {#each (camerasQ.data ?? []).slice(0, 12) as c}
          <button class="camera-pill" onclick={() => nav(`/camera/${encodeURIComponent(c.camera)}`)}>{c.camera}</button>
        {/each}
      </div>
    </div>
  {/if}

  {#if locationsQ.data?.length}
    <div class="drawer-cameras">
      <div class="drawer-cameras-header">Locations</div>
      <div class="camera-grid">
        {#each (locationsQ.data ?? []).slice(0, 12) as loc}
          <button class="camera-pill" onclick={() => nav(`/location/${encodeURIComponent(loc.h3Index)}?name=${encodeURIComponent(loc.name)}`)}>{loc.name}</button>
        {/each}
      </div>
    </div>
  {/if}

  <div class="drawer-auth">
    {#if $isAuthenticated && $viewer}
      <div class="drawer-auth-info">
        <Avatar did={$viewer.did} src={$viewer.avatar} name={$viewer.displayName || $viewer.handle} size={32} />
        <span class="drawer-handle">{$viewer.handle || $viewer.displayName}</span>
      </div>
      <Button variant="secondary" onclick={() => { open = false; doLogout() }}>Sign Out</Button>
    {/if}
  </div>
</div>

<style>
  .drawer-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 200;
  }
  .drawer-overlay.open {
    display: block;
  }
  .drawer {
    position: fixed;
    top: 0;
    left: -280px;
    bottom: 0;
    width: 280px;
    background: var(--bg-surface);
    border-right: 1px solid var(--border);
    z-index: 201;
    transition: left 0.25s ease;
    overflow-y: auto;
    padding: 20px 16px;
    display: flex;
    flex-direction: column;
  }
  .drawer.open {
    left: 0;
  }
  .drawer-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
  }
  .drawer-logo {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 18px;
    color: #fff;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
  }
  .drawer-link {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 8px;
    border-radius: 8px;
    color: var(--text-secondary);
    font-size: 15px;
    cursor: pointer;
    transition: background 0.12s;
    background: none;
    border: none;
    font-family: var(--font-body);
    width: 100%;
    text-align: left;
  }
  .drawer-link:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  .drawer-link-icon {
    width: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .drawer-cameras {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }
  .drawer-cameras-header {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 14px;
    padding: 0 8px 10px;
    color: var(--text-secondary);
  }
  .camera-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 0 8px;
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
  }
  .camera-pill:hover {
    border-color: var(--grain);
    color: var(--text-primary);
  }
  .drawer-sign-in {
    padding: 0 8px 12px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 8px;
  }
  .drawer-sign-in :global(.btn) {
    width: 100%;
  }
  .drawer-auth {
    margin-top: auto;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }
  .drawer-auth-info {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
  }
  .drawer-handle {
    font-size: 14px;
    color: var(--text-secondary);
  }
  .drawer-auth :global(.btn) {
    width: 100%;
    margin-top: 8px;
  }
</style>
