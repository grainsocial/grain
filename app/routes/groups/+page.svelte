<script lang="ts">
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'
  import Avatar from '$lib/components/atoms/Avatar.svelte'
  import Skeleton from '$lib/components/atoms/Skeleton.svelte'
  import { createQuery } from '@tanstack/svelte-query'
  import { UsersRound } from 'lucide-svelte'
  import { groupHostQuery, groupsQuery, spaceSupportQuery } from '$lib/queries'
  import { isAuthenticated } from '$lib/stores'
  import { Plus } from 'lucide-svelte'
  import SpacesRequired from '$lib/components/molecules/SpacesRequired.svelte'

  // The "places worth browsing" surface: every account that declared itself a
  // group, most recently active pool first.
  const groups = createQuery(() => groupsQuery())
  // Reachable by direct link even with the nav entry hidden, so the page has to
  // answer for itself.
  const spaces = createQuery(() => spaceSupportQuery())
  const blocked = $derived(spaces.isSuccess && spaces.data?.supported !== true)
  // Starting one needs a host that provisions groups for this Grain.
  const host = createQuery(() => groupHostQuery())
  const canStart = $derived($isAuthenticated && !blocked && !!host.data?.handleDomain)
</script>

<OGMeta title="Groups — grain" />
<DetailHeader label="Groups">
  {#snippet actions()}
    {#if canStart}
      <a class="start" href="/groups/new"><Plus size={16} /> Start a group</a>
    {/if}
  {/snippet}
</DetailHeader>

{#if blocked}
  <SpacesRequired />
{:else if groups.isLoading}
  <div class="list">
    {#each { length: 3 } as _}
      <div class="row"><Skeleton circle height="48px" /><div style="flex:1"><Skeleton width="160px" height="16px" /></div></div>
    {/each}
  </div>
{:else if (groups.data ?? []).length === 0}
  <p class="empty">No groups yet.</p>
{:else}
  <div class="list">
    {#each groups.data ?? [] as group (group.did)}
      <a class="row" href="/group/{group.did}">
        <span class="av"><Avatar did={group.did} src={group.avatar ?? null} name={group.displayName ?? group.handle} size={48} /></span>
        <span class="t">
          <b>{group.displayName ?? group.handle} <span class="group-mark"><UsersRound size={14} /></span></b>
          <!-- No gallery or member count: the pool and the roster are both
               permissioned spaces, and how much is in either is not a public
               fact. -->
          <span class="meta">@{group.handle}</span>
          {#if group.description}<span class="desc">{group.description}</span>{/if}
        </span>
      </a>
    {/each}
  </div>
{/if}

<style>
  .list { display: flex; flex-direction: column; }
  .start {
    display: inline-flex; align-items: center; gap: 4px; font-size: 14px; font-weight: 600;
    color: var(--grain); text-decoration: none;
  }
  .row {
    display: flex; align-items: center; gap: 14px; padding: 14px 16px;
    border-bottom: 1px solid var(--border); text-decoration: none; color: inherit;
  }
  .row:hover { background: var(--bg-hover); }
  .av :global(img), .av :global(.avatar) { border-radius: 14px; }
  .t { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .t b { font-weight: 700; font-size: 15px; display: flex; align-items: center; gap: 6px; }
  .group-mark { display: inline-flex; color: var(--grain); flex: none; }
  .meta { font-size: 13px; color: var(--text-muted); }
  .desc { font-size: 13px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .empty { text-align: center; color: var(--text-muted); padding: 48px 16px; font-size: 14px; }
</style>
