<script lang="ts">
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import ProfileCard from '$lib/components/molecules/ProfileCard.svelte'
  import Skeleton from '$lib/components/atoms/Skeleton.svelte'
  import Button from '$lib/components/atoms/Button.svelte'
  import { createQuery, useQueryClient } from '@tanstack/svelte-query'
  import { mutesQuery } from '$lib/queries'
  import { unmuteActor } from '$lib/mutations'

  const mutes = createQuery(() => mutesQuery())
  const queryClient = useQueryClient()

  let unmuting = $state<Set<string>>(new Set())

  async function handleUnmute(did: string) {
    unmuting.add(did)
    unmuting = new Set(unmuting)
    try {
      await unmuteActor(did, queryClient)
      queryClient.invalidateQueries({ queryKey: ['mutes'] })
    } finally {
      unmuting.delete(did)
      unmuting = new Set(unmuting)
    }
  }
</script>

<DetailHeader label="Muted Users" />

{#if mutes.isLoading}
  {#each {length: 5} as _}
    <div class="skeleton-row">
      <Skeleton circle height="40px" />
      <div>
        <Skeleton width="120px" height="15px" />
        <div style="margin-top:6px"><Skeleton width="80px" height="13px" /></div>
      </div>
    </div>
  {/each}
{:else if (mutes.data?.items ?? []).length === 0}
  <div class="empty-state">You haven't muted anyone.</div>
{:else}
  {#each mutes.data?.items ?? [] as person (person.did)}
    <div class="mute-row">
      <div class="mute-profile"><ProfileCard profile={person} /></div>
      <div class="mute-action">
        <Button variant="secondary" size="sm" disabled={unmuting.has(person.did)} onclick={() => handleUnmute(person.did)}>
          Unmute
        </Button>
      </div>
    </div>
  {/each}
{/if}

<style>
  .empty-state { padding: 48px; text-align: center; color: var(--text-secondary); }
  .skeleton-row {
    display: flex; gap: 12px; align-items: center;
    padding: 12px 16px; border-bottom: 1px solid var(--border);
  }
  .mute-row {
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--border);
  }
  .mute-profile { flex: 1; min-width: 0; }
  .mute-profile :global(.profile-card) { border-bottom: none; }
  .mute-action { padding-right: 16px; flex-shrink: 0; }
</style>
