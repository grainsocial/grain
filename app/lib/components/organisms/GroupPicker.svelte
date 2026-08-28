<script lang="ts">
  import Modal from '../atoms/Modal.svelte'
  import Avatar from '../atoms/Avatar.svelte'
  import Spinner from '../atoms/Spinner.svelte'
  import { Check, Clock } from 'lucide-svelte'
  import { createQuery, useQueryClient } from '@tanstack/svelte-query'
  import { groupsQuery } from '$lib/queries'
  import { submitToGroup, withdrawSubmission } from '$lib/mutations'
  import type { GroupView } from '$hatk/client'

  // "Add to a group": one row per group, showing where this gallery stands.
  // Submit writes a social.grain.group.submission into the viewer's own repo;
  // the group answers, in its own time, from its own account.
  let { open = $bindable(false), galleryUri }: { open: boolean; galleryUri: string } = $props()

  const queryClient = useQueryClient()
  const groups = createQuery(() => ({ ...groupsQuery(galleryUri), enabled: open }))
  let busy: string | null = $state(null)

  async function toggle(group: GroupView) {
    if (busy) return
    busy = group.did
    try {
      const standing = group.viewer?.submission
      if (!standing) await submitToGroup(group.did, galleryUri, queryClient)
      else if (standing.status === 'pending') await withdrawSubmission(standing.uri, queryClient)
      // accepted: the group holds the item now; only the group can take it out
    } finally {
      busy = null
    }
  }
</script>

<Modal bind:open title="Add to a group" width="420px">
  {#if groups.isLoading}
    <div class="center"><Spinner /></div>
  {:else if (groups.data ?? []).length === 0}
    <p class="empty">No groups yet.</p>
  {:else}
    <div class="rows">
      {#each groups.data ?? [] as group (group.did)}
        {@const standing = group.viewer?.submission}
        <button class="row" type="button" onclick={() => toggle(group)} disabled={busy === group.did || standing?.status === 'accepted'}>
          <span class="av"><Avatar did={group.did} src={group.avatar ?? null} name={group.displayName ?? group.handle} size={36} /></span>
          <span class="t">
            <b>{group.displayName ?? group.handle}</b>
            <span>{group.poolCount ?? 0} in the pool</span>
          </span>
          {#if standing?.status === 'accepted'}
            <span class="chip ok"><Check size={12} /> In the pool</span>
          {:else if standing?.status === 'pending'}
            <span class="chip pending"><Clock size={12} /> Pending · withdraw</span>
          {:else}
            <span class="chip">Submit</span>
          {/if}
        </button>
      {/each}
    </div>
    <p class="hint">A submission is public, in your own repo. The group's moderators decide what joins the pool; your gallery never moves.</p>
  {/if}
</Modal>

<style>
  .center { display: flex; justify-content: center; padding: 24px; }
  .empty, .hint { font-size: 13px; color: var(--text-muted); margin: 8px 0 0; line-height: 1.5; }
  .rows { display: flex; flex-direction: column; }
  .row {
    display: flex; align-items: center; gap: 12px; width: 100%;
    padding: 10px 4px; border: none; border-bottom: 1px solid var(--border);
    background: none; color: var(--text-primary); font: inherit; cursor: pointer; text-align: left;
  }
  .row:disabled { cursor: default; }
  .row:not(:disabled):hover { background: var(--bg-hover); }
  .av :global(img), .av :global(.avatar) { border-radius: 10px; }
  .t { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.3; }
  .t b { font-weight: 600; font-size: 14px; }
  .t span { font-size: 12px; color: var(--text-muted); }
  .chip {
    display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0;
    font-size: 12px; font-weight: 500; padding: 5px 10px; border-radius: 999px;
    border: 1px solid var(--border); color: var(--text-secondary); background: var(--bg-elevated);
  }
  .chip.ok { color: var(--grain); border-color: var(--grain); background: var(--grain-glow); }
  .chip.pending { color: var(--text-secondary); }
</style>
