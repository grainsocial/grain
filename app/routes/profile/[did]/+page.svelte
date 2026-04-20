<script lang="ts">
  import GalleryGrid from '$lib/components/organisms/GalleryGrid.svelte'
  import Avatar from '$lib/components/atoms/Avatar.svelte'
  import AvatarLightbox from '$lib/components/atoms/AvatarLightbox.svelte'
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'
  import Skeleton from '$lib/components/atoms/Skeleton.svelte'
  import FollowButton from '$lib/components/molecules/FollowButton.svelte'
  import OverflowMenu from '$lib/components/atoms/OverflowMenu.svelte'
  import RichText from '$lib/components/atoms/RichText.svelte'
  import { ArrowUpRight, Grid3x3, Heart, Clock, Ban, VolumeX, Share, Trash2, X, LoaderCircle } from 'lucide-svelte'
  import { callXrpc } from '$hatk/client'
  import { share } from '$lib/utils/share'
  import Toast from '$lib/components/atoms/Toast.svelte'
  import { createQuery, createInfiniteQuery, useQueryClient } from '@tanstack/svelte-query'
  import { actorProfileQuery, actorFeedQuery, actorFavoritesInfiniteQuery, knownFollowersQuery, storiesQuery } from '$lib/queries'
  import { viewer as viewerStore, requireAuth } from '$lib/stores'
  import { blockActor, unblockActor, muteActor, unmuteActor } from '$lib/mutations'
  import StoryViewer from '$lib/components/organisms/StoryViewer.svelte'
  import StoryArchive from '$lib/components/molecules/StoryArchive.svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'

  const validTabs = ['grid', 'favorites', 'stories'] as const
  type ViewMode = (typeof validTabs)[number]
  function parseTab(v: string | null): ViewMode {
    return validTabs.includes(v as ViewMode) ? (v as ViewMode) : 'grid'
  }

  let { data } = $props()
  let lightboxSrc: string | null = $state(null)
  const viewMode: ViewMode = $derived.by(() => {
    page.url.href
    return parseTab(page.url.searchParams.get('tab'))
  })
  let followersOffset = $state(0)
  let showStoryViewer = $state(false)
  const did = $derived(data.did)
  $effect(() => { void did; void profile.data; followersOffset = 0 })

  function setTab(tab: ViewMode) {
    exitSelectMode()
    const url = new URL(page.url)
    if (tab === 'grid') {
      url.searchParams.delete('tab')
    } else {
      url.searchParams.set('tab', tab)
    }
    goto(url, { replaceState: true, keepFocus: true, noScroll: true })
  }
  const viewerDid = $derived($viewerStore?.did)
  const isOwnProfile = $derived(viewerDid === did)

  const profile = createQuery(() => actorProfileQuery(did, viewerDid))
  const feed = createInfiniteQuery(() => actorFeedQuery(did))
  const feedItems = $derived(feed.data?.pages.flatMap((p) => p.items ?? []) ?? [])
  const favorites = createInfiniteQuery(() => ({
    ...actorFavoritesInfiniteQuery(did),
    enabled: isOwnProfile && viewMode === 'favorites',
  }))
  const favoriteItems = $derived(favorites.data?.pages.flatMap((p) => p.items ?? []) ?? [])
  const stories = createQuery(() => storiesQuery(did))
  const hasStory = $derived((stories.data?.length ?? 0) > 0)
  const knownFollowers = createQuery(() => ({
    ...knownFollowersQuery(did, viewerDid ?? ''),
    enabled: !!viewerDid && viewerDid !== did,
  }))

  const queryClient = useQueryClient()

  async function handleBlock() {
    if (!requireAuth()) return
    const p = profile.data as any
    if (p?.viewer?.blocking) {
      await unblockActor(did, p.viewer.blocking, queryClient)
    } else {
      await blockActor(did, queryClient)
    }
  }

  async function handleMute() {
    if (!requireAuth()) return
    const p = profile.data as any
    if (p?.viewer?.muted) {
      await unmuteActor(did, queryClient)
    } else {
      await muteActor(did, queryClient)
    }
  }

  let showToast = $state(false)
  let toastMessage = $state('Link copied')

  // Bulk select & delete
  let selectMode = $state(false)
  let selectedUris = $state(new Set<string>())
  let deleting = $state(false)
  let deleteProgress = $state({ current: 0, total: 0 })

  function toggleSelect(uri: string) {
    const next = new Set(selectedUris)
    if (next.has(uri)) next.delete(uri)
    else next.add(uri)
    selectedUris = next
  }

  function exitSelectMode() {
    selectMode = false
    selectedUris = new Set()
  }

  async function bulkDelete() {
    if (selectedUris.size === 0) return
    const count = selectedUris.size
    if (!confirm(`Delete ${count} ${count === 1 ? 'gallery' : 'galleries'}? This cannot be undone.`)) return
    deleting = true
    const uris = [...selectedUris]
    deleteProgress = { current: 0, total: uris.length }
    let deleted = 0
    const failed = new Set<string>()
    for (const uri of uris) {
      const rkey = uri.split('/').pop()!
      try {
        await callXrpc('social.grain.unspecced.deleteGallery', { rkey })
        deleted++
      } catch (err) {
        console.error('Failed to delete gallery:', err)
        failed.add(uri)
      }
      deleteProgress.current++
    }
    deleting = false
    queryClient.invalidateQueries({ queryKey: ['getFeed'] })
    if (failed.size > 0) {
      selectedUris = failed
      toastMessage = `Deleted ${deleted} of ${count}. ${failed.size} failed.`
    } else {
      exitSelectMode()
      toastMessage = `Deleted ${deleted} ${deleted === 1 ? 'gallery' : 'galleries'}`
    }
    showToast = true
  }

  async function handleShare() {
    const url = `${window.location.origin}/profile/${did}`
    const result = await share(url)
    if (result.success && result.method === 'clipboard') {
      toastMessage = 'Link copied'
      showToast = true
    }
  }

  const blockHide = $derived(!!profile.data?.viewer?.blocking || !!profile.data?.viewer?.blockedBy)

  const showGermButton = $derived.by(() => {
    const p = profile.data as any
    if (!p?.messageMe || !viewerDid) return false
    if (isOwnProfile) return true
    const policy = p.messageMe.showButtonTo
    if (policy === 'everyone') return true
    if (policy === 'usersIFollow') return !!p.viewer?.followedBy
    return false
  })
  const germUrl = $derived.by(() => {
    const p = profile.data as any
    if (!p?.messageMe?.messageMeUrl || !viewerDid) return null
    return `${p.messageMe.messageMeUrl}/web#${viewerDid}+${did}`
  })
</script>

<div class="page-wrapper">
{#if profile.isLoading}
  <DetailHeader label={'\u00A0'} />
  <div class="profile-header">
    <div class="profile-info">
      <div class="top-row">
        <Skeleton circle height="64px" />
      </div>
      <div style="margin-top: 10px"><Skeleton width="160px" height="22px" /></div>
      <div style="margin-top: 6px"><Skeleton width="120px" height="14px" /></div>
    </div>
  </div>
{:else if profile.data && !profile.data.cid}
  <DetailHeader label="Not Found" />
  <div class="not-found">
    <p>This user doesn't have a Grain profile yet.</p>
    <a class="bsky-link" href="https://bsky.app/profile/{did}" target="_blank" rel="noopener noreferrer">
      View on Bluesky <ArrowUpRight size={14} />
    </a>
  </div>
{:else if profile.data}
  {@const p = profile.data}
  <OGMeta title="{p.displayName || p.handle || 'Profile'} (@{p.handle || did}) — Grain" description="{p.handle ? `@${p.handle}` : did} on Grain" image="/og/profile/{did}" />

  <DetailHeader label={p.displayName || '\u00A0'} />

  <div class="profile-header">
    <div class="actions">
      {#if viewerDid && viewerDid !== did}
        {#if !p.viewer?.blocking && !p.viewer?.blockedBy}
          <FollowButton {did} viewerFollow={p.viewer?.following ?? null} onCountChange={(d) => (followersOffset += d)} />
        {/if}
      {/if}
      <OverflowMenu>
        <button class="menu-item" type="button" onclick={handleShare}>
          <Share size={15} />
          Share
        </button>
        {#if viewerDid && viewerDid !== did}
          <div class="menu-divider"></div>
          {#if !blockHide}
            <button class="menu-item" type="button" onclick={handleMute}>
              <VolumeX size={15} />
              {p.viewer?.muted ? 'Unmute' : 'Mute'}
            </button>
          {/if}
          <button class="menu-item danger" type="button" onclick={handleBlock}>
            <Ban size={15} />
            {p.viewer?.blocking ? 'Unblock' : 'Block'}
          </button>
        {/if}
      </OverflowMenu>
    </div>
    <div class="profile-info">
      <Avatar {did} src={p.avatar ?? null} name={p.displayName} size={64} {hasStory} onclick={hasStory ? () => (showStoryViewer = true) : p.avatar ? () => (lightboxSrc = p.avatar!) : undefined} />
      <div class="profile-name">{p.displayName || p.handle || did}</div>
      <div class="handle-row">
        {#if !blockHide && p.viewer?.followedBy}<span class="follows-you">Follows you</span>{/if}
        <span class="profile-handle">{p.handle ? `@${p.handle}` : did}</span>
      </div>
      {#if blockHide}
        <div class="block-alert">
          <Ban size={14} />
          {#if p.viewer?.blocking}
            <span>Account blocked</span>
          {:else}
            <span>This user has blocked you</span>
          {/if}
        </div>
      {:else}
        <div class="stat-row">
          <span><strong>{(p.galleryCount ?? 0).toLocaleString()}</strong> {Number(p.galleryCount) === 1 ? 'gallery' : 'galleries'}</span>
          <a href="/profile/{did}/followers" class="stat-link"><strong>{((p.followersCount ?? 0) + followersOffset).toLocaleString()}</strong> followers</a>
          <a href="/profile/{did}/following" class="stat-link"><strong>{(p.followsCount ?? 0).toLocaleString()}</strong> following</a>
        </div>
        {#if p.description}
          <div class="bio"><RichText text={p.description} /></div>
        {/if}
        <div class="links-row">
          <a class="link-pill" href="https://bsky.app/profile/{p.handle || did}" target="_blank" rel="noopener noreferrer">
            Bluesky <ArrowUpRight size={14} />
          </a>
          {#if showGermButton && germUrl}
            <a class="link-pill" href={germUrl} target="_blank" rel="noopener noreferrer">
              <img src="/germ-logo.png" alt="" class="germ-logo" /> Germ DM <ArrowUpRight size={14} />
            </a>
          {/if}
        </div>
        {#if (knownFollowers.data?.items ?? []).length > 0}
          {@const known = knownFollowers.data?.items ?? []}
          <a href="/profile/{did}/known-followers" class="known-followers">
            <div class="known-avatars">
              {#each known.slice(0, 3) as k (k.did)}
                <Avatar did={k.did} src={k.avatar ?? null} name={k.displayName} size={20} />
              {/each}
            </div>
            <span class="known-text">
              Followed by {known.slice(0, 2).map((k) => k.displayName || k.handle).join(', ')}{#if known.length > 2}{' '}and {known.length - 2} other{known.length - 2 !== 1 ? 's' : ''} you follow{/if}
            </span>
          </a>
        {/if}
      {/if}
    </div>
  </div>
{/if}

{#if profile.isError}
  <DetailHeader label="Not Found" />
  <div class="not-found">
    <p>This user doesn't have a Grain profile yet.</p>
    <a class="bsky-link" href="https://bsky.app/profile/{did}" target="_blank" rel="noopener noreferrer">
      View on Bluesky <ArrowUpRight size={14} />
    </a>
  </div>
{:else}
  {#if lightboxSrc}
    <AvatarLightbox src={lightboxSrc} onclose={() => (lightboxSrc = null)} />
  {/if}

  {#if !blockHide}
  <div class="view-toggle">
    <div class="toggle-tabs">
      <button class="toggle-btn" class:active={viewMode === 'grid'} onclick={() => setTab('grid')} aria-label="Grid view">
        <Grid3x3 size={20} />
      </button>
      {#if isOwnProfile}
        <button class="toggle-btn" class:active={viewMode === 'favorites'} onclick={() => setTab('favorites')} aria-label="Favorites">
          <Heart size={20} />
        </button>
        <button class="toggle-btn" class:active={viewMode === 'stories'} onclick={() => setTab('stories')} aria-label="Story archive">
          <Clock size={20} />
        </button>
      {/if}
    </div>
    {#if isOwnProfile && viewMode === 'grid' && !selectMode}
      <button class="select-text-btn" onclick={() => (selectMode = true)}>Select</button>
    {/if}
  </div>

  {#if viewMode === 'stories' && isOwnProfile}
    <StoryArchive {did} />
  {:else if viewMode === 'favorites' && isOwnProfile}
    <GalleryGrid
      items={favoriteItems}
      loading={favorites.isLoading}
      emptyText="No favorites yet."
      hasMore={favorites.hasNextPage}
      loadingMore={favorites.isFetchingNextPage}
      onLoadMore={() => favorites.fetchNextPage()}
    />
  {:else}
    <GalleryGrid
      items={feedItems}
      loading={feed.isLoading}
      hasMore={feed.hasNextPage}
      loadingMore={feed.isFetchingNextPage}
      onLoadMore={() => feed.fetchNextPage()}
      {selectMode}
      {selectedUris}
      onToggle={toggleSelect}
    />
  {/if}
  {/if}

  {#if showStoryViewer}
    <StoryViewer initialDid={did} onclose={() => (showStoryViewer = false)} />
  {/if}
{/if}

{#if selectMode}
  <div class="floating-bar">
    {#if deleting}
      <LoaderCircle size={16} class="spin" />
      <span class="bar-text">Deleting {deleteProgress.current} / {deleteProgress.total}...</span>
    {:else}
      <button class="bar-btn cancel" onclick={exitSelectMode}>
        <X size={16} />
        Cancel
      </button>
      <span class="bar-text">{selectedUris.size} selected</span>
      <button class="bar-btn delete" onclick={bulkDelete} disabled={selectedUris.size === 0}>
        <Trash2 size={16} />
        Delete
      </button>
    {/if}
  </div>
{/if}
</div>

<Toast message={toastMessage} bind:visible={showToast} />

<style>
  .page-wrapper {
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }
  .profile-header { border-bottom: 1px solid var(--border); }
  .profile-header { position: relative; }
  .actions { position: absolute; top: 12px; right: 16px; display: flex; gap: 8px; align-items: center; z-index: 1; }
  .profile-info { padding: 16px 16px 16px; }
  .profile-name { font-family: var(--font-display); font-weight: 700; font-size: 20px; margin-top: 10px; }
  .handle-row { display: flex; align-items: center; gap: 8px; margin-top: 2px; }
  .follows-you {
    font-size: 11px; background: var(--border); color: var(--text-secondary);
    padding: 2px 6px; border-radius: 4px;
  }
  .profile-handle { font-size: 13px; color: var(--text-muted); font-family: monospace; word-break: break-all; }
  .stat-row { display: flex; gap: 16px; margin-top: 10px; font-size: 13px; color: var(--text-secondary); }
  .stat-row strong { color: var(--text-primary); font-weight: 600; }
  .stat-link { text-decoration: none; color: inherit; }
  .stat-link:hover { text-decoration: underline; }
  .bio { margin-top: 8px; font-size: 14px; color: var(--text-secondary); white-space: pre-wrap; }
  .links-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .known-followers {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
    text-decoration: none;
    color: inherit;
  }
  .known-followers:hover .known-text {
    text-decoration: underline;
  }
  .known-avatars {
    display: flex;
    flex-shrink: 0;
  }
  .known-avatars :global(:not(:first-child)) {
    margin-left: -6px;
  }
  .known-text {
    font-size: 12px;
    color: var(--text-muted);
  }
  .link-pill {
    display: inline-flex; align-items: center; gap: 4px; padding: 6px 14px;
    border-radius: 20px; background: var(--bg-elevated); border: 1px solid var(--border);
    font-size: 13px; font-weight: 500; color: var(--text-secondary); transition: all 0.12s;
  }
  .link-pill:hover { background: var(--bg-hover); color: var(--text-primary); }
  .germ-logo { width: 14px; height: 14px; object-fit: contain; }
  .view-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 16px;
    border-bottom: 1px solid var(--border);
    position: relative;
  }
  .toggle-tabs {
    display: flex;
    gap: 4px;
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
    padding: 8px 16px;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    position: relative;
    transition: color 0.15s;
  }
  .toggle-btn::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 28px;
    height: 2.5px;
    border-radius: 2px;
    background: transparent;
    transition: background 0.15s;
  }
  .toggle-btn:hover { color: var(--text-secondary); }
  .toggle-btn.active { color: var(--text-primary); }
  .toggle-btn.active::after { background: var(--grain); }
  .not-found { text-align: center; color: var(--text-muted); padding: 48px 16px; font-size: 14px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .bsky-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--grain);
    text-decoration: none;
    font-size: 13px;
    font-weight: 500;
  }
  .bsky-link:hover { text-decoration: underline; }
  .block-alert {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
    padding: 6px 12px;
    border-radius: 6px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    font-size: 13px;
    color: var(--text-muted);
  }
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
  .menu-item.danger { color: #f87171; }
  .menu-divider { height: 1px; background: var(--border); margin: 4px 0; }
  .floating-bar {
    position: sticky;
    bottom: 0;
    margin-top: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 12px 16px;
    background: rgba(8, 11, 18, 0.92);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-top: 1px solid var(--border);
    z-index: 100;
  }
  .bar-text {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }
  .bar-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .bar-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .bar-btn.cancel {
    background: var(--bg-elevated);
    color: var(--text-primary);
  }
  .bar-btn.delete {
    background: #dc2626;
    color: #fff;
  }
  .bar-btn:not(:disabled):hover { opacity: 0.85; }
</style>
