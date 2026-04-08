<script lang="ts">
  import { Image, Search, Plus, Bell } from 'lucide-svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { isAuthenticated, loginModalOpen, viewer } from '$lib/stores'
  import Avatar from '../atoms/Avatar.svelte'
  import Button from '../atoms/Button.svelte'
  import { createQuery } from '@tanstack/svelte-query'
  import { unseenNotificationCountQuery } from '$lib/queries'

  let { onSearch }: { onSearch: () => void } = $props()

  const unseenCount = createQuery(() => ({
    ...unseenNotificationCountQuery($viewer?.did ?? ''),
    enabled: !!$viewer?.did,
  }))
</script>

{#if $isAuthenticated}
  <div class="mobile-bottom">
    <button
      class="mobile-tab"
      class:active={page.url.pathname === '/'}
      onclick={() => goto('/')}
    >
      <Image size={22} />
    </button>
    <button
      class="mobile-tab"
      class:active={page.url.pathname === '/create'}
      onclick={() => goto('/create')}
    >
      <Plus size={22} />
    </button>
    <button
      class="mobile-tab"
      class:active={page.url.pathname === '/notifications'}
      onclick={() => goto('/notifications')}
    >
      <span class="bell-wrap">
        <Bell size={22} />
        {#if (unseenCount.data ?? 0) > 0}
          <span class="badge">{unseenCount.data! > 99 ? '99+' : unseenCount.data}</span>
        {/if}
      </span>
    </button>
    <button class="mobile-tab" onclick={onSearch}>
      <Search size={22} />
    </button>
    {#if $viewer}
      <button
        class="mobile-tab"
        class:active={page.url.pathname.startsWith('/profile/')}
        onclick={() => goto(`/profile/${encodeURIComponent($viewer!.did)}`)}
      >
        <Avatar did={$viewer.did} src={$viewer.avatar} name={$viewer.displayName || $viewer.handle} size={24} />
      </button>
    {/if}
  </div>
{:else}
  <div class="mobile-bottom mobile-bottom-signed-out">
    <span class="mobile-tagline">Share your photography</span>
    <Button size="sm" onclick={() => ($loginModalOpen = true)}>Sign in</Button>
  </div>
{/if}

<style>
  .mobile-bottom {
    display: none;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--bg-root);
    border-top: 1px solid var(--border);
    padding: 0 0 env(safe-area-inset-bottom, 0px);
    z-index: 100;
    justify-content: space-around;
    align-items: center;
    height: calc(50px + env(safe-area-inset-bottom, 0px));
  }
  .mobile-tab {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 22px;
    padding: 8px 16px;
    cursor: pointer;
    transition: color 0.12s;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .mobile-tab.active {
    color: var(--grain);
  }
  .bell-wrap {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .badge {
    position: absolute;
    top: -4px;
    right: -6px;
    background: var(--grain);
    color: #000;
    font-size: 9px;
    font-weight: 700;
    min-width: 14px;
    height: 14px;
    border-radius: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 3px;
    font-family: var(--font-body);
  }

  .mobile-bottom-signed-out {
    justify-content: space-between;
    padding: 0 16px env(safe-area-inset-bottom, 0px);
  }
  .mobile-tagline {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  @media (max-width: 600px) {
    .mobile-bottom {
      display: flex;
      touch-action: manipulation;
    }
  }
</style>
