<script lang="ts">
  import type { Snippet } from 'svelte'
  import Sidebar from '../organisms/Sidebar.svelte'
  import SidebarRight from '../organisms/SidebarRight.svelte'
  import MobileTopBar from '../molecules/MobileTopBar.svelte'
  import MobileBottomBar from '../molecules/MobileBottomBar.svelte'
  import MobileDrawer from '../organisms/MobileDrawer.svelte'
  import MobileSearch from '../organisms/MobileSearch.svelte'
  import LoginModal from '../organisms/LoginModal.svelte'
  import { loginModalOpen, isAuthenticated } from '$lib/stores'
  import { page } from '$app/state'

  const colLeft = $derived($isAuthenticated ? '78px' : '140px')
  const wide = $derived(page.url.pathname.startsWith('/zine'))

  let { children }: { children: Snippet } = $props()
  let drawerOpen = $state(false)
  let searchOpen = $state(false)
</script>

<MobileTopBar onHamburger={() => drawerOpen = true} onSearch={() => searchOpen = true} />

<div class="shell" class:wide style:--col-left={colLeft}>
  <Sidebar />
  <main class="col-center">
    {@render children()}
  </main>
  {#if !wide}
    <SidebarRight />
  {/if}
</div>

<MobileBottomBar onSearch={() => searchOpen = true} />
<MobileDrawer bind:open={drawerOpen} />
<MobileSearch bind:open={searchOpen} />
<LoginModal bind:open={$loginModalOpen} />

<style>
  .shell {
    display: grid;
    grid-template-columns: var(--col-left) var(--col-center) var(--col-right);
    gap: 0;
    max-width: 1060px;
    margin: 0 auto;
    min-height: 100vh;
  }
  .shell.wide {
    grid-template-columns: var(--col-left) 1fr;
    max-width: none;
  }
  .col-center {
    border-right: 1px solid var(--border);
    min-height: 100vh;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .shell.wide .col-center {
    border-right: none;
  }

  @media (max-width: 1060px) {
    .shell { grid-template-columns: var(--col-left) 1fr; }
    .col-center { border-right: none; }
  }
  @media (max-width: 600px) {
    .shell { grid-template-columns: 1fr; }
    .col-center {
      position: fixed;
      top: 47px;
      left: 0;
      right: 0;
      bottom: calc(50px + env(safe-area-inset-bottom, 0px));
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior: contain;
      min-height: 0;
      border-right: none;
    }
  }
</style>
