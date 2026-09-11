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
  import { Check, ImagePlus, Lock, Share, UsersRound, LogOut } from 'lucide-svelte'
  import { createQuery, useQueryClient } from '@tanstack/svelte-query'
  import { groupQuery, poolGalleriesQuery } from '$lib/queries'
  import { joinGroup, leaveGroup } from '$lib/mutations'
  import { viewer, requireAuth } from '$lib/stores'
  import { share } from '$lib/utils/share'
  import type { GalleryView } from '$hatk/client'

  // The profile page with the nouns swapped: same header, same grid. A group is
  // an account like any other; what makes it a group is that its pool is other
  // people's galleries.
  //
  // The pool is a permissioned space the community owns, so there is no queue
  // and nothing to accept: a member writes their gallery straight into it, and
  // membership is the whole permission. Nothing in it is indexed either — it is
  // read from each member's repo, on every visit, with a credential the
  // community's host issues to whoever is asking. A visitor gets a refusal,
  // which is the honest shape of a private pool rather than an empty grid.

  let { data } = $props()
  const did = $derived(data.did)
  const queryClient = useQueryClient()
  let lightboxSrc: string | null = $state(null)

  const group = createQuery(() => groupQuery(did))
  const acting = $derived(!!group.data?.viewer?.acting)
  const pool = createQuery(() => ({ ...poolGalleriesQuery(did), enabled: !!$viewer }))
  const space = $derived(pool.data?.space ?? '')

  // Never the CDN: the space hands a blob only to a credential holder, so these
  // come back through grain itself and are cached nowhere in between.
  function blobSrc(photoDid: string, cid: string): string {
    return `/xrpc/social.grain.unspecced.getPrivateBlob?${new URLSearchParams({ space, did: photoDid, cid })}`
  }

  // Shaped into the view GalleryGrid renders, so a pool gallery looks like
  // every other one. Counts are absent rather than zero: favorites and comments
  // are public records, and these galleries are not.
  const items = $derived(
    (pool.data?.galleries ?? []).map(
      (g) =>
        ({
          uri: `at://${g.did}/social.grain.gallery/${g.rkey}`,
          cid: '',
          title: g.title,
          description: g.description,
          createdAt: g.createdAt,
          creator: { did: g.did, handle: g.handle, displayName: g.displayName },
          items: g.cover
            ? [
                {
                  uri: g.cover.uri,
                  cid: g.cover.cid,
                  thumb: blobSrc(g.cover.did, g.cover.cid),
                  fullsize: blobSrc(g.cover.did, g.cover.cid),
                  alt: g.cover.alt,
                  aspectRatio: g.cover.aspectRatio,
                },
                // The tile's "more than one" mark counts items, and only the
                // cover is fetched here. The rest stand in as empties.
                ...Array.from({ length: Math.max(0, g.photoCount - 1) }, () => ({ uri: '', cid: '' })),
              ]
            : [],
        }) as unknown as GalleryView,
    ),
  )
  // The ordinary gallery page, told which pool to read it from: a pooled
  // gallery is still the author's record at the author's rkey, so it keeps the
  // address every other gallery has.
  const poolHref = (g: GalleryView) =>
    `/profile/${encodeURIComponent(g.creator?.did ?? '')}/gallery/${(g.uri ?? '').split('/').pop()}?group=${encodeURIComponent(did)}`

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
  <!-- The card that goes out to anyone: members, never the pool's size. -->
  <OGMeta title="{name} (@{g.handle}) — Groups — Grain" description="{g.memberCount ?? 0} members" />

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
        <!-- Counted from the pool itself, and only by someone who can read it.
             There is no public number to fall back on: that is what private
             means here. -->
        {#if pool.isSuccess}
          {@const n = pool.data?.galleries?.length ?? 0}
          <span><strong>{n.toLocaleString()}</strong> {n === 1 ? 'gallery' : 'galleries'}</span>
        {/if}
        <span><strong>{(g.memberCount ?? 0).toLocaleString()}</strong> {g.memberCount === 1 ? 'member' : 'members'}</span>
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
    <div class="pool-label"><Lock size={14} /> Members' pool</div>
    {#if member}
      <a class="select-text-btn" href="/group/{did}/create"><ImagePlus size={15} /> Add a gallery</a>
    {/if}
  </div>

  {#if !$viewer}
    <div class="empty-state">
      This pool is the club's, not the network's. Sign in as a member to see it.
    </div>
  {:else if pool.isError}
    <div class="empty-state">
      Only members can open this pool. If you have just joined, reload — the
      credential is minted fresh each time.
    </div>
  {:else}
    <GalleryGrid
      {items}
      loading={pool.isLoading}
      emptyText="Nothing in the pool yet."
      hrefFor={poolHref}
      showAuthor
    />
  {/if}
{/if}
</div>

<Toast message={toastMessage} bind:visible={showToast} />

<style>
  /* Everything down to .rules mirrors /profile/[did] — same header grid,
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
    justify-content: space-between;
    gap: 12px;
    padding: 8px 16px;
  }
  .select-text-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    font-size: 13px;
    font-weight: 500;
    font-family: inherit;
    color: var(--grain);
    text-decoration: none;
    cursor: pointer;
    padding: 4px 0;
  }
  .select-text-btn:hover { opacity: 0.8; }
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

  /* The pool's own band, where the profile has its tab bar: what this grid is,
     and the one thing a member can do to it. */
  .pool-label {
    display: flex; align-items: center; gap: 6px;
    font-size: 13px; color: var(--text-secondary);
  }
</style>
