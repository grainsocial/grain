<script lang="ts">
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'
  import Avatar from '$lib/components/atoms/Avatar.svelte'
  import Skeleton from '$lib/components/atoms/Skeleton.svelte'
  import { createQuery } from '@tanstack/svelte-query'
  import { UsersRound } from 'lucide-svelte'
  import { groupsQuery, spaceSupportQuery } from '$lib/queries'
  import SpacesRequired from '$lib/components/molecules/SpacesRequired.svelte'

  // The "places worth browsing" surface: every account that declared itself a
  // community, most recently active pool first.
  const groups = createQuery(() => groupsQuery())
  // Reachable by direct link even with the nav entry hidden, so the page has to
  // answer for itself.
  const spaces = createQuery(() => spaceSupportQuery())
  const blocked = $derived(spaces.isSuccess && spaces.data?.supported !== true)
</script>

<OGMeta title="Groups — grain" />
<DetailHeader label="Groups" />

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
          <!-- No gallery count: a group's pool is a permissioned space now, and
               how much is in it is not a public fact. Members see the number on
               the group's own page, counted from the pool they can read. -->
          <span class="meta">{group.memberCount ?? 0} {group.memberCount === 1 ? 'member' : 'members'} · @{group.handle}</span>
          {#if group.description}<span class="desc">{group.description}</span>{/if}
        </span>
      </a>
    {/each}
  </div>
{/if}

<style>
  .list { display: flex; flex-direction: column; }
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
