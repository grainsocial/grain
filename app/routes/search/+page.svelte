<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query'
  import GalleryCard from '$lib/components/molecules/GalleryCard.svelte'
  import Avatar from '$lib/components/atoms/Avatar.svelte'
  import Skeleton from '$lib/components/atoms/Skeleton.svelte'
  import GalleryCardSkeleton from '$lib/components/molecules/GalleryCardSkeleton.svelte'
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import { truncDid } from '$lib/utils'
  import { page } from '$app/state'
  import { searchGalleriesQuery, searchProfilesQuery } from '$lib/queries'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'

  const query = $derived(page.url.searchParams.get('q') || '')
  const activeTab = $derived(
    page.url.searchParams.get('tab') === 'people' ? 'people' as const
    : 'galleries' as const
  )

  const galleries = createQuery(() => ({ ...searchGalleriesQuery(query), enabled: activeTab === 'galleries' && !!query }))
  const people = createQuery(() => ({ ...searchProfilesQuery(query), enabled: activeTab === 'people' && !!query }))
</script>

<OGMeta title="Search - grain" />
<DetailHeader label='"{query}"' />

<div class="search-tabs">
  <a class="search-tab" class:active={activeTab === 'galleries'} href="/search?q={encodeURIComponent(query)}">Galleries</a>
  <a class="search-tab" class:active={activeTab === 'people'} href="/search?q={encodeURIComponent(query)}&tab=people">People</a>
</div>

{#if activeTab === 'galleries'}
  {#if galleries.isLoading}
    {#each {length: 3} as _}
      <GalleryCardSkeleton />
    {/each}
  {:else if (galleries.data?.items ?? []).length === 0}
    <div class="empty-state">No results for "{query}"</div>
  {:else}
    {#each galleries.data?.items ?? [] as item (item.uri)}
      <GalleryCard gallery={item} />
    {/each}
  {/if}
{:else}
  {#if people.isLoading}
    {#each {length: 4} as _}
      <div class="skeleton-profile">
        <Skeleton circle height="40px" />
        <div>
          <Skeleton width="120px" height="15px" />
          <div style="margin-top:6px"><Skeleton width="80px" height="13px" /></div>
        </div>
      </div>
    {/each}
  {:else if (people.data?.items ?? []).length === 0}
    <div class="empty-state">No people found for "{query}"</div>
  {:else}
    {#each people.data?.items ?? [] as person (person.did)}
      <a href="/profile/{person.did}" class="profile-result">
        <Avatar did={person.did} src={person.avatar ?? null} size={40} />
        <div class="profile-result-info">
          <div class="profile-result-name">{person.displayName || (person.handle ? `@${person.handle}` : truncDid(person.did))}</div>
          {#if person.handle}<div class="profile-result-handle">@{person.handle}</div>{/if}
          {#if person.description}<div class="profile-result-bio">{person.description}</div>{/if}
        </div>
      </a>
    {/each}
  {/if}
{/if}

<style>
  .search-tabs { display: flex; border-bottom: 1px solid var(--border); }
  .search-tab {
    flex: 1; padding: 10px 16px; text-align: center; font-size: 14px; font-weight: 500;
    color: var(--text-muted); cursor: pointer; border: none;
    border-bottom: 2px solid transparent; background: none; font-family: inherit;
    transition: all 0.15s; text-decoration: none;
  }
  .search-tab.active { color: var(--grain); border-bottom-color: var(--grain); font-weight: 600; }
  .search-tab:hover { color: var(--text-secondary); background: var(--bg-hover); }
  .empty-state { padding: 48px; text-align: center; color: var(--text-secondary); }


  .profile-result {
    display: flex; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--border);
    transition: background 0.12s; text-decoration: none; color: inherit;
  }
  .profile-result:hover { background: var(--bg-hover); }
  .profile-result-info { flex: 1; min-width: 0; }
  .profile-result-name { font-weight: 600; font-size: 15px; }
  .profile-result-handle { font-size: 13px; color: var(--text-muted); }
  .profile-result-bio {
    font-size: 13px; color: var(--text-secondary); margin-top: 4px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  .skeleton-profile {
    display: flex; gap: 12px; align-items: center;
    padding: 12px 16px; border-bottom: 1px solid var(--border);
  }
</style>
