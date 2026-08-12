<script lang="ts">
  import Avatar from './Avatar.svelte'

  let {
    people,
    size = 20,
    overlap = 6,
    max = 3,
  }: {
    people: Array<{ did: string; avatar?: string | null; displayName?: string }>
    size?: number
    /** How far each avatar tucks under the one before it, in px. */
    overlap?: number
    max?: number
  } = $props()

  // Dedupe before the keyed each. A repeated did throws each_key_duplicate,
  // which unwinds the render of whatever feed this facepile sits in — one bad
  // row should degrade to one avatar, not a blank page.
  const unique = $derived(
    people.filter((p, i) => people.findIndex((q) => q.did === p.did) === i).slice(0, max)
  )
</script>

<div class="facepile" style="--facepile-overlap: {overlap}px">
  {#each unique as person (person.did)}
    <Avatar did={person.did} src={person.avatar ?? null} name={person.displayName} {size} />
  {/each}
</div>

<style>
  .facepile {
    display: flex;
    flex-shrink: 0;
  }
  .facepile :global(> *:not(:first-child)) {
    margin-left: calc(var(--facepile-overlap) * -1);
  }
</style>
