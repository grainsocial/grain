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
</script>

<div class="facepile" style="--facepile-overlap: {overlap}px">
  {#each people.slice(0, max) as person (person.did)}
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
