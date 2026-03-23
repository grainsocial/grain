<script lang="ts">
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import ProfileCard from '$lib/components/molecules/ProfileCard.svelte'
  import Skeleton from '$lib/components/atoms/Skeleton.svelte'
  import { createQuery } from '@tanstack/svelte-query'
  import { followingQuery, actorProfileQuery } from '$lib/queries'

  let { data } = $props()
  const did = $derived(data.did)

  const profile = createQuery(() => actorProfileQuery(did))
  const following = createQuery(() => followingQuery(did))
</script>

<DetailHeader label="{profile.data?.displayName || 'Profile'} — Following" />

{#if following.isLoading}
  {#each {length: 5} as _}
    <div class="skeleton-row">
      <Skeleton circle height="40px" />
      <div>
        <Skeleton width="120px" height="15px" />
        <div style="margin-top:6px"><Skeleton width="80px" height="13px" /></div>
      </div>
    </div>
  {/each}
{:else if (following.data?.items ?? []).length === 0}
  <div class="empty-state">Not following anyone yet</div>
{:else}
  {#each following.data?.items ?? [] as person (person.did)}
    <ProfileCard profile={person} />
  {/each}
{/if}

<style>
  .empty-state { padding: 48px; text-align: center; color: var(--text-secondary); }
  .skeleton-row {
    display: flex; gap: 12px; align-items: center;
    padding: 12px 16px; border-bottom: 1px solid var(--border);
  }
</style>
