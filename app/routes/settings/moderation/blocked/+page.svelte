<script lang="ts">
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import ProfileCard from '$lib/components/molecules/ProfileCard.svelte'
  import Skeleton from '$lib/components/atoms/Skeleton.svelte'
  import Button from '$lib/components/atoms/Button.svelte'
  import { createQuery, useQueryClient } from '@tanstack/svelte-query'
  import { blocksQuery } from '$lib/queries'
  import { unblockActor } from '$lib/mutations'

  const blocks = createQuery(() => blocksQuery())
  const queryClient = useQueryClient()

  let unblocking = $state<Set<string>>(new Set())

  async function handleUnblock(did: string, blockUri: string) {
    unblocking.add(did)
    unblocking = new Set(unblocking)
    try {
      await unblockActor(did, blockUri, queryClient)
      queryClient.invalidateQueries({ queryKey: ['blocks'] })
    } finally {
      unblocking.delete(did)
      unblocking = new Set(unblocking)
    }
  }
</script>

<DetailHeader label="Blocked Users" />

{#if blocks.isLoading}
  {#each {length: 5} as _}
    <div class="skeleton-row">
      <Skeleton circle height="40px" />
      <div>
        <Skeleton width="120px" height="15px" />
        <div style="margin-top:6px"><Skeleton width="80px" height="13px" /></div>
      </div>
    </div>
  {/each}
{:else if (blocks.data?.items ?? []).length === 0}
  <div class="empty-state">You haven't blocked anyone.</div>
{:else}
  {#each blocks.data?.items ?? [] as person (person.did)}
    <div class="block-row">
      <div class="block-profile"><ProfileCard profile={person} /></div>
      <div class="block-action">
        <Button variant="secondary" size="sm" disabled={unblocking.has(person.did)} onclick={() => handleUnblock(person.did, person.blockUri)}>
          Unblock
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
  .block-row {
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--border);
  }
  .block-profile { flex: 1; min-width: 0; }
  .block-profile :global(.profile-card) { border-bottom: none; }
  .block-action { padding-right: 16px; flex-shrink: 0; }
</style>
