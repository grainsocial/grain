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
  import { onMount, type Snippet } from 'svelte'
  import '../app.css'
  import Shell from '$lib/components/templates/Shell.svelte'
  import Toast from '$lib/components/atoms/Toast.svelte'
  import '$lib/auth'
  import { QueryClientProvider } from '@tanstack/svelte-query'
  import { isAuthenticated, viewer } from '$lib/stores'
  import { rememberAccount } from '$lib/accounts'
  import { loadPreferences } from '$lib/preferences'
  import { initTheme } from '$lib/theme'
  import { afterNavigate } from '$app/navigation'
  import { page } from '$app/state'

  // Grain Social on the App Store. Safari on iOS turns the meta tag below into
  // its own banner above the page, which it dismisses and remembers on its own,
  // and which reads "Open" rather than "View" once the app is installed.
  const IOS_APP_ID = '6747730230'

  $effect(() => initTheme())

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

  // hatk bounces a failed PDS sign-in back here as ?error=... (most often the
  // user hitting "Deny"). Surface it, then strip the params so a refresh or a
  // shared link doesn't replay the toast.
  // Captured during setup, before children mount — /oauth/callback redirects to
  // '/' on mount, which would otherwise race this read.
  const landingSearch = typeof window === 'undefined' ? '' : window.location.search

  let authError = $state('')
  let showAuthError = $state(false)

  onMount(() => {
    const params = new URLSearchParams(landingSearch)
    const error = params.get('error')
    if (!error) return

    authError = error === 'access_denied' ? 'Sign-in canceled' : params.get('error_description') || 'Sign-in failed'
    showAuthError = true

    // Only rewrite if we're still on the URL we read — /oauth/callback may have
    // navigated away already, and that URL is its own to manage.
    if (window.location.search !== landingSearch) return
    for (const key of ['error', 'error_description', 'state', 'iss']) params.delete(key)
    const query = params.toString()
    window.history.replaceState({}, '', window.location.pathname + (query ? `?${query}` : ''))
  })

  $effect(() => {
    if (data.preferences) {
      Promise.resolve(data.preferences).then((prefs) => loadPreferences(prefs?.preferences ?? prefs))
    }
  })

  $effect(() => {
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

<Toast message={authError} bind:visible={showAuthError} duration={4000} />
