<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { getZine, type Zine } from '$lib/zines'
  import ZineEditor from '$lib/components/organisms/ZineEditor.svelte'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'

  let zine = $state<Zine | null>(null)
  let loaded = $state(false)

  const rkey = $derived(page.params.rkey!)

  onMount(() => {
    zine = getZine(rkey)
    loaded = true
  })
</script>

<OGMeta title="Edit zine - grain" />

{#if !loaded}
  <div class="center">Loading…</div>
{:else if !zine}
  <div class="missing">
    <DetailHeader label="Zine not found" onback={() => goto('/')} />
    <p>This zine doesn't exist on this device.</p>
  </div>
{:else}
  <ZineEditor {zine} />
{/if}

<style>
  .center { padding: 48px; text-align: center; color: var(--text-muted); }
  .missing { max-width: 520px; margin: 0 auto; padding: 24px; }
  .missing p { color: var(--text-secondary); }
</style>
