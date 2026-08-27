<script lang="ts">
  import type { Snippet } from 'svelte'
  import Sidebar from '../organisms/Sidebar.svelte'
  import PublicTopBar from '../molecules/PublicTopBar.svelte'
  import SearchFlyout from '../organisms/SearchFlyout.svelte'
  import MobileTopBar from '../molecules/MobileTopBar.svelte'
  import MobileBottomBar from '../molecules/MobileBottomBar.svelte'
  import MobileDrawer from '../organisms/MobileDrawer.svelte'
  import MobileSearch from '../organisms/MobileSearch.svelte'
  import LoginModal from '../organisms/LoginModal.svelte'
  import { loginModalOpen } from '$lib/stores'
  import { page } from '$app/state'
  import { afterNavigate } from '$app/navigation'

  let { children }: { children: Snippet } = $props()

  let drawerOpen = $state(false)
  let searchOpen = $state(false)
  let searchFlyoutOpen = $state(false)

  // The nav stays clickable beside the open panel, so a nav click has to
  // dismiss it — otherwise the panel outlives the page it was opened from.
  afterNavigate(() => (searchFlyoutOpen = false))

  // Routes opt into shell variations by returning flags from their load, so
  // route knowledge stays with the route rather than in the shell.
  //   wide: true -> 935px content column instead of 600px
  //   full: true -> no left nav; a public top bar carries the wordmark and
  //                 sign-in instead. Routes set this only when signed out.
  //   rail: true -> nav collapses to icons (routes with their own sub-nav)
  const contentMax = $derived(page.data?.wide ? '935px' : null)
  const full = $derived(page.data?.full === true)
  const rail = $derived(page.data?.rail === true)
</script>

<MobileTopBar onHamburger={() => drawerOpen = true} onSearch={() => searchOpen = true} />

{#if full}
  <PublicTopBar maxWidth={contentMax ?? '600px'} />
{/if}

<div class="shell" class:full style:--col-left={rail ? '78px' : null}>
  {#if !full}
    <Sidebar {rail} onSearch={() => (searchFlyoutOpen = !searchFlyoutOpen)} searchOpen={searchFlyoutOpen} />
  {/if}
  <main class="col-center" style:--content-max={contentMax}>
    {@render children()}
  </main>
</div>

<MobileBottomBar />
<MobileDrawer bind:open={drawerOpen} />
<MobileSearch bind:open={searchOpen} />
<SearchFlyout bind:open={searchFlyoutOpen} navWidth={rail ? '78px' : '245px'} />
<LoginModal bind:open={$loginModalOpen} />

<style>
  /* The nav owns a fixed track and the content column takes the rest, so the
     nav sits in the same place on every route. Width is chosen by the content
     itself via --content-max, not by the grid — otherwise a wider page would
     shift the nav sideways as you navigated. */
  .shell {
    display: grid;
    grid-template-columns: var(--col-left) minmax(0, 1fr);
    gap: 0;
    max-width: var(--shell-max);
    margin: 0 auto;
    min-height: 100vh;
  }
  .shell.full { grid-template-columns: minmax(0, 1fr); }
  .col-center {
    width: 100%;
    max-width: var(--content-max, 600px);
    margin-inline: auto;
    min-height: 100vh;
    min-width: 0;
    overflow-wrap: anywhere;
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
