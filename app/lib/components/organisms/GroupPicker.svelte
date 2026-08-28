<script lang="ts">
  import Modal from '../atoms/Modal.svelte'
  import Avatar from '../atoms/Avatar.svelte'
  import Spinner from '../atoms/Spinner.svelte'
  import { Check, Clock, X, UsersRound } from 'lucide-svelte'
  import { createQuery, useQueryClient } from '@tanstack/svelte-query'
  import { groupsQuery } from '$lib/queries'
  import { submitToGroup, withdrawSubmission, joinGroup } from '$lib/mutations'
  import type { GroupView } from '$hatk/client'

  // "Add to a group": one row per group, showing where this gallery stands.
  // Only a member can submit, and the group's rules are shown at the moment
  // they matter — before the submission is written. Not a member yet? The row
  // offers to join, which is Grain talking to the group's community host.
  let { open = $bindable(false), galleryUri }: { open: boolean; galleryUri: string } = $props()

  const queryClient = useQueryClient()
  const groups = createQuery(() => ({ ...groupsQuery(galleryUri), enabled: open }))
  let busy: string | null = $state(null)
  let expanded: string | null = $state(null)
  let notice: string | null = $state(null)

  function joinLabel(g: GroupView): string {
    if (g.joinPolicy === 'open') return 'Join'
    if (g.joinPolicy === 'invite') return 'Invite only'
    return 'Request to join'
  }

  async function onRow(group: GroupView) {
    if (busy) return
    notice = null
    const standing = group.viewer?.submission
    if (standing?.status === 'pending') {
      busy = group.did
      try { await withdrawSubmission(standing.uri, queryClient) } finally { busy = null }
      return
    }
    if (standing) return // accepted or declined: the group's call now
    if (!group.viewer?.member) {
      if (group.joinPolicy === 'invite') return
      busy = group.did
      try {
        const status = await joinGroup(group.did, queryClient)
        notice = status === 'admitted'
          ? `You're in — ${group.displayName ?? group.handle} is open.`
          : `Request sent to ${group.displayName ?? group.handle}'s moderators.`
      } catch (err: any) {
        notice = err?.message ?? 'Could not join'
      } finally { busy = null }
      return
    }
    // A member with no standing: show the rules, then confirm.
    expanded = expanded === group.did ? null : group.did
  }

  async function submit(group: GroupView) {
    if (busy) return
    busy = group.did
    try {
      await submitToGroup(group.did, galleryUri, queryClient)
      expanded = null
    } finally { busy = null }
  }
</script>

<Modal bind:open title="Add to a group" width="440px">
  {#if groups.isLoading}
    <div class="center"><Spinner /></div>
  {:else if (groups.data ?? []).length === 0}
    <p class="empty">No groups yet.</p>
  {:else}
    <div class="rows">
      {#each groups.data ?? [] as group (group.did)}
        {@const standing = group.viewer?.submission}
        {@const member = !!group.viewer?.member}
        <div class="group" class:open={expanded === group.did}>
          <button class="row" type="button" onclick={() => onRow(group)} disabled={busy === group.did || standing?.status === 'accepted' || standing?.status === 'declined' || (!member && group.joinPolicy === 'invite')}>
            <span class="av"><Avatar did={group.did} src={group.avatar ?? null} name={group.displayName ?? group.handle} size={36} /></span>
            <span class="t">
              <b>{group.displayName ?? group.handle}</b>
              <span>{group.memberCount ?? 0} {group.memberCount === 1 ? 'member' : 'members'} · {group.poolCount ?? 0} in the pool</span>
            </span>
            {#if standing?.status === 'accepted'}
              <span class="chip ok"><Check size={12} /> In the pool</span>
            {:else if standing?.status === 'declined'}
              <span class="chip muted"><X size={12} /> Declined</span>
            {:else if standing?.status === 'pending'}
              <span class="chip pending"><Clock size={12} /> Pending · withdraw</span>
            {:else if !member}
              <span class="chip join"><UsersRound size={12} /> {joinLabel(group)}</span>
            {:else}
              <span class="chip">Submit…</span>
            {/if}
          </button>
          {#if expanded === group.did && member && !standing}
            <div class="rules">
              {#if (group.rules ?? []).length}
                <b>{group.displayName ?? group.handle} rules</b>
                <ul>{#each group.rules ?? [] as rule (rule.uri)}<li><span>{rule.title}</span>{#if rule.text} — {rule.text}{/if}</li>{/each}</ul>
              {:else}
                <span class="none">This group hasn't written any rules.</span>
              {/if}
              <button class="confirm" type="button" onclick={() => submit(group)} disabled={busy === group.did}>Submit this gallery</button>
            </div>
          {/if}
        </div>
      {/each}
    </div>
    {#if notice}<p class="notice">{notice}</p>{/if}
    <p class="hint">A submission is public, in your own repo. The group's moderators decide what joins the pool; your gallery never moves.</p>
  {/if}
</Modal>

<style>
  .center { display: flex; justify-content: center; padding: 24px; }
  .empty, .hint { font-size: 13px; color: var(--text-muted); margin: 8px 0 0; line-height: 1.5; }
  .notice { font-size: 13px; color: var(--text-primary); margin: 10px 0 0; }
  .rows { display: flex; flex-direction: column; }
  .group { border-bottom: 1px solid var(--border); }
  .row {
    display: flex; align-items: center; gap: 12px; width: 100%;
    padding: 10px 4px; border: none; background: none; color: var(--text-primary); font: inherit; cursor: pointer; text-align: left;
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
  .chip.join { color: var(--grain); }
  .chip.muted { color: var(--text-muted); }
  .rules { padding: 4px 4px 12px 52px; font-size: 13px; color: var(--text-secondary); }
  .rules b { display: block; font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
  .rules ul { margin: 0 0 10px; padding-left: 18px; line-height: 1.5; }
  .rules li span { font-weight: 500; color: var(--text-primary); }
  .rules .none { display: block; margin-bottom: 10px; color: var(--text-muted); }
  .confirm {
    padding: 7px 14px; border-radius: 999px; border: none; background: var(--grain); color: var(--on-grain);
    font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
  }
  .confirm:disabled { opacity: 0.6; }
</style>
