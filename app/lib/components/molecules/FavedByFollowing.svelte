<script lang="ts">
  import Facepile from '../atoms/Facepile.svelte'

  let {
    people,
    href,
  }: {
    people: Array<{ did: string; handle?: string; displayName?: string; avatar?: string | null }>
    /** The full favoriters list, which this line is a preview of. */
    href: string
  } = $props()

  const names = $derived(
    people.slice(0, 2).map((p) => p.displayName || (p.handle ? `@${p.handle}` : '')),
  )
</script>

{#if people.length > 0}
  <a class="faved-by" {href}>
    <Facepile {people} size={20} />
    <span class="faved-by-text">
      {#if names.length === 1}
        Favorited by <strong>{names[0]}</strong>
      {:else if people.length > 2}
        Favorited by <strong>{names[0]}</strong>, <strong>{names[1]}</strong> and others you follow
      {:else}
        Favorited by <strong>{names[0]}</strong> and <strong>{names[1]}</strong>
      {/if}
    </span>
  </a>
{/if}

<style>
  .faved-by {
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    color: inherit;
    min-width: 0;
  }
  .faved-by:hover .faved-by-text {
    text-decoration: underline;
  }
  .faved-by-text {
    font-size: 12px;
    color: var(--text-muted);
  }
  .faved-by-text strong {
    color: var(--text-secondary);
    font-weight: 600;
  }
</style>
