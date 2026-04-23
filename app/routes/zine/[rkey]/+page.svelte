<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { getZine, type Zine } from '$lib/zines'
  import ZineViewer from '$lib/components/organisms/ZineViewer.svelte'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'
  import Button from '$lib/components/atoms/Button.svelte'
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import { Pencil } from 'lucide-svelte'

  let zine = $state<Zine | null>(null)
  let loaded = $state(false)

  const rkey = $derived(page.params.rkey!)

  onMount(() => {
    zine = getZine(rkey)
    loaded = true
  })
</script>

<OGMeta title={zine?.title ? `${zine.title} - grain` : 'Zine - grain'} />

{#if !loaded}
  <div class="center">Loading…</div>
{:else if !zine}
  <div class="missing">
    <DetailHeader label="Zine not found" onback={() => goto('/')} />
    <p>This zine doesn't exist on this device.</p>
    <p class="hint">Zines are currently stored in local browser storage only.</p>
  </div>
{:else}
  <div class="wrap">
    <div class="edit-bar">
      <Button variant="ghost" size="sm" onclick={() => goto(`/zine/${rkey}/edit`)}>
        <Pencil size={14} /> Edit
      </Button>
    </div>
    <ZineViewer {zine} />
  </div>
{/if}

<style>
  .center { padding: 48px; text-align: center; color: var(--text-muted); }
  .missing { max-width: 520px; margin: 0 auto; padding: 24px; }
  .missing p { color: var(--text-secondary); }
  .hint { font-size: 13px; color: var(--text-muted); }
  .wrap { position: relative; }
  .edit-bar {
    position: absolute;
    top: 12px;
    right: 16px;
    z-index: 5;
  }
</style>
