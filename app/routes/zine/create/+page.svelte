<script lang="ts">
  import { onMount } from 'svelte'
  import { createDraft, saveZine, type Zine } from '$lib/zines'
  import ZineEditor from '$lib/components/organisms/ZineEditor.svelte'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'

  let zine = $state<Zine | null>(null)

  onMount(() => {
    const draft = createDraft()
    zine = saveZine(draft)
  })
</script>

<OGMeta title="Create zine - grain" />

{#if zine}
  <ZineEditor {zine} />
{/if}
