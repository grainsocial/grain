<script lang="ts">
  import type { Snippet } from 'svelte'
  import '../app.css'
  import Shell from '$lib/components/templates/Shell.svelte'
  import '$lib/auth'
  import { QueryClientProvider } from '@tanstack/svelte-query'
  import { isAuthenticated, viewer } from '$lib/stores'
  import { loadPreferences } from '$lib/preferences'
  import { afterNavigate } from '$app/navigation'

  // Safety net: clear any stale body overflow locks left by overlays (e.g. StoryViewer)
  // that were destroyed during navigation without proper cleanup
  afterNavigate(() => {
    if (document.body.style.overflow === 'hidden') {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
  })

  let { data, children }: { data: any; children: Snippet } = $props()

  $effect(() => {
    if (data.preferences) {
      Promise.resolve(data.preferences).then((prefs) => loadPreferences(prefs?.preferences ?? prefs))
    }
  })

  $effect(() => {
    if (data.viewer) {
      $isAuthenticated = true
      $viewer = { did: data.viewer.did, handle: data.viewer.handle ?? null, displayName: data.viewer.handle ?? data.viewer.did.slice(0, 18), avatar: null }
      Promise.resolve(data.profile).then((profile) => {
        if (profile) {
          $viewer = {
            did: data.viewer.did,
            handle: profile.handle ?? data.viewer.handle ?? null,
            displayName: profile.displayName ?? profile.handle ?? data.viewer.handle ?? data.viewer.did.slice(0, 18),
            avatar: profile.avatar ?? null,
          }
        }
      })
    } else {
      $isAuthenticated = false
      $viewer = null
    }
  })
</script>

<QueryClientProvider client={data.queryClient}>
  <Shell>
    {@render children()}
  </Shell>
</QueryClientProvider>
