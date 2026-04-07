<script lang="ts">
  import GalleryGrid from '$lib/components/organisms/GalleryGrid.svelte'
  import Avatar from '$lib/components/atoms/Avatar.svelte'
  import AvatarLightbox from '$lib/components/atoms/AvatarLightbox.svelte'
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'
  import Skeleton from '$lib/components/atoms/Skeleton.svelte'
  import FollowButton from '$lib/components/molecules/FollowButton.svelte'
  import RichText from '$lib/components/atoms/RichText.svelte'
  import { ArrowUpRight, Grid3x3, Heart, Clock } from 'lucide-svelte'
  import { createQuery } from '@tanstack/svelte-query'
  import { actorProfileQuery, actorFeedQuery, actorFavoritesQuery, knownFollowersQuery, storiesQuery } from '$lib/queries'
  import { viewer as viewerStore } from '$lib/stores'
  import StoryViewer from '$lib/components/organisms/StoryViewer.svelte'
  import StoryArchive from '$lib/components/molecules/StoryArchive.svelte'

  let { data } = $props()
  let lightboxSrc: string | null = $state(null)
  let viewMode: 'grid' | 'favorites' | 'stories' = $state('grid')
  let followersOffset = $state(0)
  let showStoryViewer = $state(false)
  const did = $derived(data.did)
  $effect(() => { void did; void profile.data; followersOffset = 0; viewMode = 'grid' })
  const viewerDid = $derived($viewerStore?.did)
  const isOwnProfile = $derived(viewerDid === did)

  const profile = createQuery(() => actorProfileQuery(did, viewerDid))
  const feed = createQuery(() => actorFeedQuery(did))
  const favorites = createQuery(() => ({
    ...actorFavoritesQuery(did),
    enabled: isOwnProfile,
  }))
  const stories = createQuery(() => storiesQuery(did))
  const hasStory = $derived((stories.data?.length ?? 0) > 0)
  const knownFollowers = createQuery(() => ({
    ...knownFollowersQuery(did, viewerDid ?? ''),
    enabled: !!viewerDid && viewerDid !== did,
  }))

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

{#if profile.isLoading}
  <DetailHeader label={'\u00A0'} />
  <div class="profile-header">
    <div class="profile-banner-skeleton"><Skeleton width="100%" height="120px" radius="0" /></div>
    <div class="profile-info">
      <div class="top-row">
        <Skeleton circle height="64px" />
      </div>
      <div style="margin-top: 10px"><Skeleton width="160px" height="22px" /></div>
      <div style="margin-top: 6px"><Skeleton width="120px" height="14px" /></div>
    </div>
  </div>
{:else if profile.data}
  {@const p = profile.data}
  <OGMeta title="{p.displayName || p.handle || 'Profile'} (@{p.handle || did}) — Grain" description="{p.handle ? `@${p.handle}` : did} on Grain" image="/og/profile/{did}" />

  <DetailHeader label={p.displayName || '\u00A0'} />

  <div class="profile-header">
    <div class="profile-banner"></div>
    <div class="profile-info">
      <div class="top-row">
        <Avatar {did} src={p.avatar ?? null} name={p.displayName} size={64} {hasStory} onclick={hasStory ? () => (showStoryViewer = true) : p.avatar ? () => (lightboxSrc = p.avatar!) : undefined} />
        {#if viewerDid && viewerDid !== did}
          <div class="actions">
            <FollowButton {did} viewerFollow={p.viewer?.following ?? null} onCountChange={(d) => (followersOffset += d)} />
          </div>
        {/if}
      </div>
      <div class="profile-name">{p.displayName || did.slice(0, 18)}</div>
      <div class="handle-row">
        {#if p.viewer?.followedBy}<span class="follows-you">Follows you</span>{/if}
        <span class="profile-handle">{p.handle ? `@${p.handle}` : did}</span>
      </div>
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
    </div>
  </div>
{/if}

{#if profile.isError}
  <DetailHeader label="Not Found" />
  <div class="not-found">This profile doesn't exist.</div>
{:else}
  {#if lightboxSrc}
    <AvatarLightbox src={lightboxSrc} onclose={() => (lightboxSrc = null)} />
  {/if}

  <div class="view-toggle">
    <button class="toggle-btn" class:active={viewMode === 'grid'} onclick={() => (viewMode = 'grid')} aria-label="Grid view">
      <Grid3x3 size={20} />
    </button>
    {#if isOwnProfile}
      <button class="toggle-btn" class:active={viewMode === 'favorites'} onclick={() => (viewMode = 'favorites')} aria-label="Favorites">
        <Heart size={20} />
      </button>
      <button class="toggle-btn" class:active={viewMode === 'stories'} onclick={() => (viewMode = 'stories')} aria-label="Story archive">
        <Clock size={20} />
      </button>
    {/if}
  </div>

  {#if viewMode === 'stories' && isOwnProfile}
    <StoryArchive {did} />
  {:else if viewMode === 'favorites' && isOwnProfile}
    <GalleryGrid items={favorites.data?.items ?? []} loading={favorites.isLoading} />
  {:else}
    <GalleryGrid items={feed.data?.items ?? []} loading={feed.isLoading} />
  {/if}

  {#if showStoryViewer}
    <StoryViewer initialDid={did} onclose={() => (showStoryViewer = false)} />
  {/if}
{/if}

<style>
  .profile-header { border-bottom: 1px solid var(--border); }
  .profile-banner-skeleton { line-height: 0; }
  .profile-banner {
    height: 120px;
    background: var(--bg-elevated);
  }
  .profile-info { padding: 0 16px 16px; position: relative; }
  .top-row { display: flex; align-items: flex-start; justify-content: space-between; margin-top: -32px; min-height: 72px; }
  .actions { display: flex; gap: 8px; align-items: center; margin-top: 40px; }
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
    justify-content: center;
    gap: 4px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--border);
  }
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
  .not-found { text-align: center; color: var(--text-muted); padding: 48px 16px; font-size: 14px; }
</style>
