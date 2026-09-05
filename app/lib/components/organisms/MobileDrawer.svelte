<script lang="ts">
  import { Home, Search, Compass, Bell, ImagePlus, User, Settings } from 'lucide-svelte'
  import { goto } from '$app/navigation'
  import { isAuthenticated, viewer } from '$lib/stores'
  import Button from '../atoms/Button.svelte'
  import { resetPreferences } from '$lib/preferences'
  import { logout } from '$lib/auth'
  import LoginModal from './LoginModal.svelte'


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

  {#if $isAuthenticated}
    <!-- Same destinations as the desktop nav, in the same order. -->
    <button class="drawer-link" onclick={() => nav('/')}>
      <span class="drawer-link-icon"><Home size={18} /></span> Home
    </button>
    <button class="drawer-link" onclick={() => nav('/search')}>
      <span class="drawer-link-icon"><Search size={18} /></span> Search
    </button>
    <button class="drawer-link" onclick={() => nav('/explore')}>
      <span class="drawer-link-icon"><Compass size={18} /></span> Explore
    </button>
    <button class="drawer-link" onclick={() => nav('/notifications')}>
      <span class="drawer-link-icon"><Bell size={18} /></span> Notifications
    </button>
    {#if $viewer}
      {@const viewerDid = $viewer.did}
      <button class="drawer-link" onclick={() => nav(`/profile/${viewerDid}`)}>
        <span class="drawer-link-icon"><User size={18} /></span> Profile
      </button>
    {/if}
    <button class="drawer-link" onclick={() => nav('/settings')}>
      <span class="drawer-link-icon"><Settings size={18} /></span> Settings
    </button>

    <button class="drawer-create" onclick={() => nav('/create')}>
      <ImagePlus size={18} /> Create
    </button>
  {/if}

  <div class="drawer-footer">
    <a href="/support/terms" onclick={() => (open = false)}>Terms</a>
    <a href="/support/privacy" onclick={() => (open = false)}>Privacy</a>
    <a href="/support/copyright" onclick={() => (open = false)}>Copyright</a>
    <a href="/support/community-guidelines" onclick={() => (open = false)}>Guidelines</a>
    <a href="https://atproto.com" target="_blank" rel="noopener noreferrer">AT Protocol</a>
  </div>


  <div class="drawer-auth">
    {#if $isAuthenticated && $viewer}
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
    color: var(--text-primary);
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
  /* Matches the desktop nav: Create is the only primary action here, so it sits
     below the list as a filled button rather than another row in it. */
  .drawer-create {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 10px 8px;
    margin-top: 14px;
    border-radius: 999px;
    background: var(--grain-btn);
    color: #fff;
    border: none;
    font-family: var(--font-body);
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.12s;
  }
  .drawer-create:hover { background: var(--grain-btn-dim); }
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
  .drawer-auth :global(.btn) {
    width: 100%;
    margin-top: 8px;
  }
  .drawer-footer {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 12px;
    padding: 16px 18px 8px;
    font-size: 11px;
    line-height: 1.6;
  }
  .drawer-footer a { color: var(--text-faint); text-decoration: none; }
  .drawer-footer a:hover { color: var(--text-secondary); }
</style>
