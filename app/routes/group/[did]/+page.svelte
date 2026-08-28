<script lang="ts">
  import GalleryGrid from '$lib/components/organisms/GalleryGrid.svelte'
  import Avatar from '$lib/components/atoms/Avatar.svelte'
  import AvatarLightbox from '$lib/components/atoms/AvatarLightbox.svelte'
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'
  import Skeleton from '$lib/components/atoms/Skeleton.svelte'
  import OverflowMenu from '$lib/components/atoms/OverflowMenu.svelte'
  import RichText from '$lib/components/atoms/RichText.svelte'
  import Toast from '$lib/components/atoms/Toast.svelte'
  import { Grid3x3, Inbox, Check, X, LoaderCircle, Share, UsersRound, LogOut } from 'lucide-svelte'
  import { createQuery, createInfiniteQuery, useQueryClient } from '@tanstack/svelte-query'
  import { groupQuery, groupFeedQuery, groupSubmissionsQuery } from '$lib/queries'
  import { acceptSubmission, declineSubmission, joinGroup, leaveGroup } from '$lib/mutations'
  import { viewer, requireAuth } from '$lib/stores'
  import { share } from '$lib/utils/share'
  import { relativeTime } from '$lib/utils'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import type { PhotoView, SubmissionView } from '$hatk/client'

  // The profile page with the nouns swapped: same header, same tabs, same
  // grid. A group is an account like any other; what makes it a group is that
  // its pool is other people's galleries. "Acting" — the viewer signed in *as*
  // the group through its community host — is the only moderator signal
  // Grain needs: that session can write the group's repo, so it can accept.
  const validTabs = ['pool', 'queue'] as const
  type ViewMode = (typeof validTabs)[number]

  let { data } = $props()
  const did = $derived(data.did)
  const queryClient = useQueryClient()
  let lightboxSrc: string | null = $state(null)

  const group = createQuery(() => groupQuery(did))
  const feed = createInfiniteQuery(() => groupFeedQuery(did))
  const items = $derived(feed.data?.pages.flatMap((p) => p.items ?? []) ?? [])
  const acting = $derived(!!group.data?.viewer?.acting)
  const queue = createQuery(() => ({ ...groupSubmissionsQuery(did), enabled: acting }))
  const pending = $derived(queue.data ?? [])
  const pendingCount = $derived(group.data?.pendingCount ?? 0)

  const viewMode: ViewMode = $derived.by(() => {
    page.url.href
    const t = page.url.searchParams.get('tab')
    return t === 'queue' && acting ? 'queue' : 'pool'
  })
  function setTab(tab: ViewMode) {
    const url = new URL(page.url)
    if (tab === 'pool') url.searchParams.delete('tab')
    else url.searchParams.set('tab', tab)
    goto(url, { replaceState: true, keepFocus: true, noScroll: true })
  }

  let showToast = $state(false)
  let toastMessage = $state('Link copied')
  async function handleShare() {
    const result = await share(`${window.location.origin}/group/${did}`)
    if (result.success && result.method === 'clipboard') {
      toastMessage = 'Link copied'
      showToast = true
    }
  }

  const member = $derived(!!group.data?.viewer?.member)
  const joinPolicy = $derived(group.data?.joinPolicy)
  let joining = $state(false)
  async function handleJoin() {
    if (!requireAuth() || joining || !group.data) return
    joining = true
    try {
      const status = await joinGroup(did, queryClient)
      toastMessage = status === 'admitted' ? `You're in` : 'Request sent to the moderators'
    } catch (err: any) {
      toastMessage = err?.message ?? 'Could not join'
    } finally {
      joining = false
      showToast = true
    }
  }
  async function handleLeave() {
    if (joining || !group.data) return
    if (!confirm(`Leave ${group.data.displayName ?? group.data.handle}? Your galleries leave its pool with you.`)) return
    joining = true
    try {
      await leaveGroup(did, queryClient)
      toastMessage = 'You left the group'
    } catch (err: any) {
      toastMessage = err?.message ?? 'Could not leave'
    } finally {
      joining = false
      showToast = true
    }
  }

  let accepting: string | null = $state(null)
  async function accept(s: SubmissionView) {
    if (accepting) return
    accepting = s.uri
    try {
      await acceptSubmission(s.gallery.uri, s.uri, queryClient)
      toastMessage = `Added "${s.gallery.title}" to the pool`
    } catch (err) {
      console.error('accept failed', err)
      toastMessage = 'Could not accept — is this session allowed to write the group?'
    } finally {
      accepting = null
      showToast = true
    }
  }
  let declining: string | null = $state(null)
  async function decline(s: SubmissionView) {
    if (declining) return
    declining = s.uri
    try {
      await declineSubmission(s.gallery.uri, s.uri, queryClient)
      toastMessage = `Declined "${s.gallery.title}"`
    } catch (err) {
      console.error('decline failed', err)
      toastMessage = 'Could not decline'
    } finally {
      declining = null
      showToast = true
    }
  }
  function thumb(s: SubmissionView): string | undefined {
    return ((s.gallery.items ?? []) as PhotoView[])[0]?.thumb
  }
  function photoCount(s: SubmissionView): number {
    return ((s.gallery.items ?? []) as PhotoView[]).length
  }
</script>

<div class="page-wrapper">
{#if group.isLoading}
  <div class="mobile-back"><DetailHeader label={' '} /></div>
  <div class="profile-header">
    <div class="profile-info">
      <div class="avatar-col"><Skeleton circle height="100%" /></div>
      <div class="meta-col">
        <div><Skeleton width="200px" height="26px" /></div>
        <div style="margin-top: 8px"><Skeleton width="140px" height="14px" /></div>
      </div>
    </div>
  </div>
{:else if group.isError || !group.data}
  <DetailHeader label="Not Found" />
  <div class="not-found">
    <p>This account hasn't declared itself a community.</p>
    <a class="bsky-link" href="/profile/{did}">View as a profile</a>
  </div>
{:else}
  {@const g = group.data}
  {@const name = g.displayName || g.handle}
  <OGMeta title="{name} (@{g.handle}) — Groups — Grain" description="{g.poolCount ?? 0} galleries in the pool" />

  <div class="mobile-back"><DetailHeader label={name} /></div>

  <div class="profile-header">
    <div class="actions">
      <OverflowMenu>
        <button class="menu-item" type="button" onclick={handleShare}>
          <Share size={15} />
          Share
        </button>
      </OverflowMenu>
    </div>
    <div class="profile-info">
      <div class="avatar-col">
        <Avatar {did} src={g.avatar ?? null} name={name} onclick={g.avatar ? () => (lightboxSrc = g.avatar!) : undefined} />
      </div>
      <div class="meta-col">
      <div class="profile-name">{name} <span class="group-mark" title="Group"><UsersRound size={18} /></span></div>
      <div class="handle-row">
        {#if acting}<span class="follows-you">Signed in as this group</span>{/if}
        <span class="profile-handle">@{g.handle}</span>
      </div>
      <div class="stat-row">
        <span><strong>{(g.poolCount ?? 0).toLocaleString()}</strong> in the pool</span>
        <span><strong>{(g.memberCount ?? 0).toLocaleString()}</strong> {g.memberCount === 1 ? 'member' : 'members'}</span>
        {#if acting}
          <button class="stat-link" type="button" onclick={() => setTab('queue')}><strong>{pendingCount.toLocaleString()}</strong> waiting for review</button>
        {/if}
      </div>
      {#if g.description}
        <div class="bio"><RichText text={g.description} /></div>
      {/if}
      {#if !acting}
        <div class="links-row">
          {#if member}
            <span class="link-pill member"><Check size={14} /> Member</span>
            <button class="link-pill" type="button" onclick={handleLeave} disabled={joining}><LogOut size={14} /> Leave</button>
          {:else if joinPolicy === 'invite'}
            <span class="link-pill muted">Invite only</span>
          {:else}
            <button class="link-pill primary" type="button" onclick={handleJoin} disabled={joining}>
              <UsersRound size={14} /> {joinPolicy === 'open' ? 'Join' : 'Request to join'}
            </button>
          {/if}
        </div>
      {/if}
      {#if (g.rules ?? []).length}
        <details class="rules">
          <summary>{g.rules?.length} {g.rules?.length === 1 ? 'rule' : 'rules'}</summary>
          <ul>{#each g.rules ?? [] as rule (rule.uri)}<li><b>{rule.title}</b>{#if rule.text} — {rule.text}{/if}</li>{/each}</ul>
        </details>
      {/if}
      </div>
    </div>
  </div>

  {#if lightboxSrc}
    <AvatarLightbox src={lightboxSrc} onclose={() => (lightboxSrc = null)} />
  {/if}

  <div class="view-toggle">
    <div class="toggle-tabs">
      <button class="toggle-btn" class:active={viewMode === 'pool'} onclick={() => setTab('pool')} aria-label="Pool">
        <Grid3x3 size={20} />
      </button>
      {#if acting}
        <button class="toggle-btn" class:active={viewMode === 'queue'} onclick={() => setTab('queue')} aria-label="Queue">
          <Inbox size={20} />
          {#if pendingCount > 0}<span class="count">{pendingCount}</span>{/if}
        </button>
      {/if}
    </div>
    {#if acting && viewMode === 'pool' && pendingCount > 0}
      <button class="select-text-btn" onclick={() => setTab('queue')}>Review</button>
    {/if}
  </div>

  {#if viewMode === 'queue' && acting}
    {#if queue.isLoading}
      <div class="empty-state">Loading…</div>
    {:else if pending.length === 0}
      <div class="empty-state">Nothing waiting for review.</div>
    {:else}
      <div class="queue">
        {#each pending as s (s.uri)}
          {@const rkey = s.gallery.uri.split('/').pop()}
          <div class="qrow">
            <a class="qthumb" href="/profile/{s.gallery.creator.did}/gallery/{rkey}">
              {#if thumb(s)}<img src={thumb(s)} alt={s.gallery.title ?? ''} />{/if}
            </a>
            <div class="qt">
              <a class="qtitle" href="/profile/{s.gallery.creator.did}/gallery/{rkey}">{s.gallery.title}</a>
              <span class="qmeta">
                <a href="/profile/{s.gallery.creator.did}">{s.gallery.creator.displayName || `@${s.gallery.creator.handle}`}</a>
                · {photoCount(s)} {photoCount(s) === 1 ? 'photo' : 'photos'}
                · submitted {relativeTime(s.createdAt)}
              </span>
            </div>
            <button class="decline" type="button" onclick={() => decline(s)} disabled={declining === s.uri || accepting === s.uri} aria-label="Decline">
              {#if declining === s.uri}<LoaderCircle size={14} class="spin" />{:else}<X size={14} />{/if}
              Decline
            </button>
            <button class="accept" type="button" onclick={() => accept(s)} disabled={accepting === s.uri || declining === s.uri}>
              {#if accepting === s.uri}<LoaderCircle size={14} class="spin" />{:else}<Check size={14} />{/if}
              Accept
            </button>
          </div>
        {/each}
      </div>
    {/if}
  {:else}
    <GalleryGrid
      items={items}
      loading={feed.isLoading}
      emptyText="Nothing in the pool yet."
      hasMore={feed.hasNextPage}
      loadingMore={feed.isFetchingNextPage}
      onLoadMore={() => feed.fetchNextPage()}
      showAuthor
    />
  {/if}
{/if}
</div>

<Toast message={toastMessage} bind:visible={showToast} />

<style>
  /* Everything down to .toggle-btn mirrors /profile/[did] — same header grid,
     same responsive avatar, same stat band, same pill tabs — so a group reads
     as what it is: an author whose galleries happen to be other people's. */
  .mobile-back { display: none; }
  @media (max-width: 600px) {
    .mobile-back { display: block; }
  }
  .page-wrapper {
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }
  .profile-header { position: relative; }
  .actions { position: absolute; top: 12px; right: 16px; display: flex; gap: 8px; align-items: center; z-index: 1; }
  .profile-info {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
    column-gap: 14px;
    padding: 16px;
  }
  .avatar-col { grid-column: 1; grid-row: 1; display: grid; place-items: center; --avatar-size: 88px; }
  .meta-col { display: contents; }
  .handle-row { grid-column: 1 / -1; }
  .profile-name,
  .bio,
  .links-row,
  .rules,
  .stat-row { grid-column: 1 / -1; }
  .profile-name { margin-top: 14px; }
  .stat-row { order: 1; }

  @media (min-width: 700px) {
    .avatar-col { --avatar-size: 150px; }
    .profile-info {
      grid-template-columns: 290px minmax(0, 1fr);
      column-gap: 16px;
      padding: 34px 16px 26px;
    }
    .meta-col { display: block; min-width: 0; padding-top: 6px; }
    .profile-name { margin-top: 0; }
  }
  .profile-name { font-family: var(--font-display); font-weight: 700; font-size: 20px; margin-top: 10px; display: flex; align-items: center; gap: 8px; }
  .group-mark { display: inline-flex; color: var(--grain); flex: none; }
  .handle-row { display: flex; align-items: center; gap: 8px; margin-top: 2px; }
  .follows-you {
    font-size: 11px; background: var(--border); color: var(--text-secondary);
    padding: 2px 6px; border-radius: 4px;
  }
  .profile-handle { font-size: 13px; color: var(--text-muted); font-family: monospace; word-break: break-all; }
  .stat-row {
    display: flex;
    justify-content: space-around;
    gap: 8px;
    margin-top: 18px;
    padding: 4px 0;
    font-size: 13px;
    color: var(--text-secondary);
  }
  .stat-row > :global(*) {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
  }
  .stat-row :global(strong) { font-size: 16px; }

  @media (min-width: 700px) {
    .stat-row {
      justify-content: flex-start;
      gap: 16px;
      margin-top: 10px;
      padding: 0;
    }
    .stat-row > :global(*) { flex-direction: row; gap: 4px; }
    .stat-row :global(strong) { font-size: inherit; }
  }
  .stat-row strong { color: var(--text-primary); font-weight: 600; }
  .stat-link { text-decoration: none; color: inherit; background: none; border: none; padding: 0; font: inherit; cursor: pointer; }
  .stat-link:hover { text-decoration: underline; }
  .bio { margin-top: 8px; font-size: 14px; color: var(--text-secondary); white-space: pre-wrap; }
  .links-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .link-pill {
    display: inline-flex; align-items: center; gap: 4px; padding: 6px 14px;
    border-radius: 20px; background: var(--bg-surface); border: none;
    font: inherit; font-size: 13px; font-weight: 500; color: var(--text-secondary); transition: all 0.12s; cursor: pointer;
  }
  .link-pill:hover { background: var(--bg-hover); color: var(--text-primary); }
  .link-pill.primary { background: var(--grain); color: var(--on-grain); }
  .link-pill.member { color: var(--grain); cursor: default; }
  .link-pill.muted { cursor: default; }
  .link-pill:disabled { opacity: 0.6; }
  .rules { margin-top: 10px; font-size: 13px; color: var(--text-secondary); }
  .rules summary { cursor: pointer; color: var(--text-muted); }
  .rules ul { margin: 6px 0 0; padding-left: 18px; line-height: 1.5; }
  .rules b { color: var(--text-primary); font-weight: 600; }
  .view-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 16px;
    position: relative;
  }
  .toggle-tabs {
    display: flex;
    gap: 6px;
  }
  .select-text-btn {
    position: absolute;
    right: 16px;
    background: none;
    border: none;
    font-size: 13px;
    font-weight: 500;
    font-family: inherit;
    color: var(--grain);
    cursor: pointer;
    padding: 4px 0;
  }
  .select-text-btn:hover { opacity: 0.8; }
  .toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 9px 18px;
    border-radius: 999px;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    transition: color 0.15s, background-color 0.15s, box-shadow 0.15s;
  }
  .toggle-btn:hover { color: var(--text-secondary); background: var(--bg-hover); }
  .toggle-btn.active {
    color: var(--text-primary);
    background: var(--bg-surface);
  }
  .count {
    font-size: 11px; font-weight: 700; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px;
    background: var(--grain); color: var(--on-grain); display: inline-flex; align-items: center; justify-content: center;
  }
  .not-found { text-align: center; color: var(--text-muted); padding: 48px 16px; font-size: 14px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .bsky-link { display: inline-flex; align-items: center; gap: 4px; color: var(--grain); text-decoration: none; font-size: 13px; font-weight: 500; }
  .bsky-link:hover { text-decoration: underline; }
  .menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    border: none;
    background: none;
    color: var(--text-primary);
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
    border-radius: 6px;
    transition: background 0.15s;
  }
  .menu-item:hover { background: var(--bg-hover); }
  .empty-state { text-align: center; color: var(--text-muted); padding: 48px 16px; font-size: 14px; }

  /* The queue has no profile equivalent: one row per submission. */
  .queue { display: flex; flex-direction: column; }
  .qrow { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--border); }
  .qthumb { width: 64px; height: 64px; border-radius: 8px; overflow: hidden; background: var(--bg-elevated); flex-shrink: 0; }
  .qthumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .qt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .qtitle { font-weight: 600; font-size: 14px; color: var(--text-primary); text-decoration: none; }
  .qmeta { font-size: 12px; color: var(--text-muted); }
  .qmeta a { color: inherit; }
  .accept {
    display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 999px; border: none;
    background: var(--grain); color: var(--on-grain); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
  }
  .accept:disabled { opacity: 0.6; cursor: default; }
  .decline {
    display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 999px;
    border: 1px solid var(--border); background: none; color: var(--text-secondary); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
  }
  .decline:hover { background: var(--bg-hover); color: var(--text-primary); }
  .decline:disabled { opacity: 0.6; cursor: default; }
</style>
