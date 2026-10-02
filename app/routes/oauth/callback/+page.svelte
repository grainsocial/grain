<script lang="ts">
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'

  onMount(() => {
    goto('/', { replaceState: true })
  })
</script>

<OGMeta title="Signing in - grain" noindex />
