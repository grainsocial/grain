<script lang="ts">
  import { X } from 'lucide-svelte'
  import { onMount } from 'svelte'

  const APP_URL = 'https://apps.apple.com/app/grain-social/id6747730230'
  const DISMISSED_KEY = 'grain:ios-banner-dismissed'

  // Safari renders the App Store banner itself from the apple-itunes-app meta
  // tag in the root layout, so this stands in only where that tag does nothing:
  // Chrome, Firefox, Edge and the in-app browsers, all of which are WebKit under
  // a different wrapper. An installed app is reached the same way either route,
  // through the universal links in .well-known/apple-app-site-association.
  function needsBanner(): boolean {
    const ua = navigator.userAgent
    const isIOS = /iPhone|iPad|iPod/.test(ua)
    if (!isIOS) return false
    // Every one of these keeps the Safari token in its UA, so the absence of a
    // wrapper name is what identifies Safari proper.
    const isWrapped = /CriOS|FxiOS|EdgiOS|OPiOS|GSA/.test(ua) || !/Safari/.test(ua)
    if (!isWrapped) return false
    // Already installed and launched from the home screen.
    if ((navigator as { standalone?: boolean }).standalone) return false
    return true
  }

  let visible = $state(false)

  onMount(() => {
    // `?ios-banner` forces it on for a look during development, where the user
    // agent is whatever desktop browser is open. Compiled out of the build.
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('ios-banner')) {
      visible = true
      document.documentElement.classList.add('ios-banner')
      return () => document.documentElement.classList.remove('ios-banner')
    }
    try {
      if (localStorage.getItem(DISMISSED_KEY) === '1') return
    } catch {
      // Private mode with storage blocked: show it, just without the memory.
    }
    if (!needsBanner()) return
    visible = true
    document.documentElement.classList.add('ios-banner')
    return () => document.documentElement.classList.remove('ios-banner')
  })

  function dismiss() {
    visible = false
    document.documentElement.classList.remove('ios-banner')
    try {
      localStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      // Nothing to do; it comes back next visit.
    }
  }
</script>

{#if visible}
  <div class="ios-banner-bar">
    <button class="dismiss" type="button" onclick={dismiss} aria-label="Dismiss">
      <X size={16} />
    </button>
    <img class="app-icon" src="/icon-192.png" alt="" width="32" height="32" />
    <span class="copy">
      <span class="name">Grain Social</span>
      <span class="sub">Get the iOS app</span>
    </span>
    <a class="cta" href={APP_URL} target="_blank" rel="noopener noreferrer">View</a>
  </div>
{/if}

<style>
  /* The bar is fixed, so the mobile chrome below it has to start lower. Height
     lives here rather than in the script because it is nil above the breakpoint,
     where the bar is not shown at all. */
  :global(html.ios-banner) {
    --ios-banner-h: 0px;
  }
  @media (max-width: 600px) {
    :global(html.ios-banner) {
      --ios-banner-h: 58px;
    }
  }

  .ios-banner-bar {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 58px;
    z-index: 70;
    align-items: center;
    gap: 10px;
    padding: 0 12px;
    background: var(--bg-elevated);
    border-bottom: 1px solid var(--border);
  }
  .dismiss {
    background: none;
    border: none;
    color: var(--text-faint);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    flex: none;
  }
  .app-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    flex: none;
  }
  .copy {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }
  .name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sub {
    font-size: 12px;
    color: var(--text-muted);
  }
  .cta {
    flex: none;
    font-size: 13px;
    font-weight: 600;
    color: var(--grain);
    text-decoration: none;
    padding: 6px 10px;
  }

  @media (max-width: 600px) {
    .ios-banner-bar {
      display: flex;
    }
  }
</style>
