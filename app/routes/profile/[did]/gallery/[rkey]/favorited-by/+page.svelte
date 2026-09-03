<script lang="ts">
  import PageHeading from '$lib/components/molecules/PageHeading.svelte'
  import ProfileCard from '$lib/components/molecules/ProfileCard.svelte'
  import Skeleton from '$lib/components/atoms/Skeleton.svelte'
  import { createQuery } from '@tanstack/svelte-query'
  import { galleryFavoritesQuery } from '$lib/queries'
  import { viewer } from '$lib/stores'

  let { data } = $props()
  const galleryUri = $derived(data.galleryUri)

  const favorites = createQuery(() => galleryFavoritesQuery(galleryUri, $viewer?.did))
  const items = $derived(favorites.data?.items ?? [])
</script>

<PageHeading title="Favorited by" back />

<div class="page">
  {#if favorites.isLoading}
    {#each { length: 5 } as _}
      <div class="skeleton-row">
        <Skeleton circle height="40px" />
        <div>
          <Skeleton width="120px" height="15px" />
          <div style="margin-top:6px"><Skeleton width="80px" height="13px" /></div>
        </div>
      </div>
    {/each}
  {:else if items.length === 0}
    <div class="empty-state">No one has favorited this gallery yet</div>
  {:else}
    {#each items as person (person.did)}
      <ProfileCard profile={person} />
    {/each}
  {/if}
</div>

<style>
  .page {
    margin-top: 18px;
    padding-bottom: 32px;
  }
  .empty-state {
    padding: 48px;
    text-align: center;
    color: var(--text-secondary);
  }
  .skeleton-row {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
  }
</style>
