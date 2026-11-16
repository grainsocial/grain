<script lang="ts" module>
  import type { Snapshot } from './$types'

  export const snapshot: Snapshot<number> = {
    capture: () => document.querySelector('main.col-center')?.scrollTop ?? 0,
    restore: (y) => {
      requestAnimationFrame(() => {
        document.querySelector('main.col-center')?.scrollTo(0, y)
      })
    },
  }
</script>

<script lang="ts">
  import { onMount, tick, type Snippet } from 'svelte'
  import '../app.css'
  import Shell from '$lib/components/templates/Shell.svelte'
  import { setViewerHandle } from '$lib/auth'
  import { QueryClientProvider } from '@tanstack/svelte-query'
  import { isAuthenticated, viewer } from '$lib/stores'
  import { rememberAccount } from '$lib/accounts'
  import { loadPreferences } from '$lib/preferences'
  import { keepPreferences, toSettings } from '$lib/preferenceSync'
  import { initTheme } from '$lib/theme'
  import { afterNavigate } from '$app/navigation'
  import { page } from '$app/state'

  // Grain Social on the App Store. Safari on iOS turns the meta tag below into
  // its own banner above the page, which it dismisses and remembers on its own,
  // and which reads "Open" rather than "View" once the app is installed.
  const IOS_APP_ID = '6747730230'

  $effect(() => initTheme())

  // Marked once the page's script has taken it over, so that something
  // driving the page, as the end-to-end flows do, clicks only once a click
  // reaches a handler.
  onMount(() => {
    tick().then(() => document.documentElement.setAttribute('data-ready', ''))
  })

  // Clear stale body overflow locks left by overlays (e.g. StoryViewer)
  afterNavigate(({ from, to, type }) => {
    if (document.body.style.overflow === 'hidden') {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }

    // Below 600px main.col-center is a fixed, self-scrolling pane that survives
    // navigation, so its scrollTop carries over and a new page opens partway
    // down. SvelteKit only manages window scroll, so reset it here.
    // - popstate is left alone: the snapshot above restores it.
    // - same pathname is left alone: that is a tab or filter change using
    //   noScroll, not a new page.
    if (type === 'popstate') return
    if (from && to && from.url.pathname === to.url.pathname) return
    document.querySelector('main.col-center')?.scrollTo(0, 0)
  })

  let { data, children }: { data: any; children: Snippet } = $props()

  $effect(() => {
    if (data.preferences) {
      Promise.resolve(data.preferences).then((prefs) => {
        if (!prefs) return
        keepPreferences(prefs)
        loadPreferences(toSettings(prefs))
      })
    }
  })

  $effect(() => {
    setViewerHandle(data.viewer?.handle ?? null)
    if (data.viewer) {
      $viewer = { did: data.viewer.did, handle: data.viewer.handle ?? null, displayName: data.viewer.handle ?? data.viewer.did.slice(0, 18), avatar: null }
      rememberAccount({ did: data.viewer.did, handle: data.viewer.handle ?? null })
      Promise.resolve(data.profile).then((profile) => {
        if (profile) {
          $viewer = {
            did: data.viewer.did,
            handle: profile.handle ?? data.viewer.handle ?? null,
            displayName: profile.displayName ?? profile.handle ?? data.viewer.handle ?? data.viewer.did.slice(0, 18),
            avatar: profile.avatar ?? null,
          }
          rememberAccount({
            did: data.viewer.did,
            handle: profile.handle ?? data.viewer.handle ?? null,
            displayName: profile.displayName ?? null,
            avatar: profile.avatar ?? null,
          })
        }
      })
    } else {
      $viewer = null
    }
  })
</script>

<svelte:head>
  <!-- app-argument is the page being viewed, so an install that already handles
       it as a universal link (see .well-known/apple-app-site-association) opens
       there instead of at its own home screen. -->
  <meta name="apple-itunes-app" content="app-id={IOS_APP_ID}, app-argument={page.url.href}" />
</svelte:head>

<QueryClientProvider client={data.queryClient}>
  <Shell>
    {@render children()}
  </Shell>
</QueryClientProvider>

