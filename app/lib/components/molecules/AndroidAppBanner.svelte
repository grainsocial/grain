<script lang="ts">
  import { X } from 'lucide-svelte'
  import { onMount } from 'svelte'

  const APP_URL = 'https://play.google.com/store/apps/details?id=social.grain'
  const DISMISSED_KEY = 'grain:android-banner-dismissed'

  // No browser on Android renders a store banner the way Safari on iOS does
  // from the apple-itunes-app meta tag, so this is the only prompt an Android
  // visitor ever gets. Shown in every browser on the platform unless dismissed:
  // a page cannot detect that the app is installed, and grain.social links
  // open in the browser rather than the app.
  function needsBanner(): boolean {
    return /Android/.test(navigator.userAgent)
  }

  let visible = $state(false)

  onMount(() => {
    // `?android-banner` forces it on for a look during development, where the
    // user agent is whatever desktop browser is open. Compiled out of the build.
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('android-banner')) {
      visible = true
      document.documentElement.classList.add('app-banner')
      return () => document.documentElement.classList.remove('app-banner')
    }
    try {
      if (localStorage.getItem(DISMISSED_KEY) === '1') return
    } catch {
      // Private mode with storage blocked: show it, just without the memory.
    }
    if (!needsBanner()) return
    visible = true
    document.documentElement.classList.add('app-banner')
    return () => document.documentElement.classList.remove('app-banner')
  })

  function dismiss() {
    visible = false
    document.documentElement.classList.remove('app-banner')
    try {
      localStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      // Nothing to do; it comes back next visit.
    }
  }
</script>

{#if visible}
  <div class="app-banner-bar">
    <button class="dismiss" type="button" onclick={dismiss} aria-label="Dismiss">
      <X size={16} />
    </button>
    <img class="app-icon" src="/icon-192.png" alt="" width="32" height="32" />
    <span class="copy">
      <span class="name">Grain Social</span>
      <span class="sub">Get the Android app</span>
    </span>
    <a class="cta" href={APP_URL} target="_blank" rel="noopener noreferrer">View</a>
  </div>
{/if}

<style>
  /* The bar is fixed, so the mobile chrome below it has to start lower. Height
     lives here rather than in the script because it is nil above the breakpoint,
     where the bar is not shown at all.

     The class and the variable are shared with IosAppBanner: the two bars
     never show on the same device, so both can push the same chrome down. */
  :global(html.app-banner) {
    --app-banner-h: 0px;
  }
  @media (max-width: 600px) {
    :global(html.app-banner) {
      --app-banner-h: 58px;
    }
  }

  .app-banner-bar {
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
    .app-banner-bar {
      display: flex;
    }
  }
</style>
