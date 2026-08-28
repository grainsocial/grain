<script lang="ts">
  import type { GalleryView, PhotoView, ExifView } from '$hatk/client'
  import { callXrpc } from '$hatk/client'
  import { goto } from '$app/navigation'
  import Avatar from '../atoms/Avatar.svelte'
  import Facepile from '../atoms/Facepile.svelte'
  import RichText from '../atoms/RichText.svelte'
  import Toast from '../atoms/Toast.svelte'
  import ExifInfo from '../atoms/ExifInfo.svelte'
  import GalleryMedia from './GalleryMedia.svelte'
  import FavoriteButton from './FavoriteButton.svelte'
  import ReportButton from './ReportButton.svelte'
  import ProfilePopover from './ProfilePopover.svelte'
  import { relativeTime } from '$lib/utils'
  import { MessageCircle, Send, ChevronLeft, ChevronRight, Trash2, Heart, Flag, Pencil } from 'lucide-svelte'
  import OverflowMenu from '../atoms/OverflowMenu.svelte'
  import { share } from '$lib/utils/share'
  import { browser } from '$app/environment'
  import { isAuthenticated, requireAuth, viewer } from '$lib/stores'
  import { resolveLabels, labelDefsQuery } from '$lib/labels'
  import { createQuery, useQueryClient } from '@tanstack/svelte-query'
  import { storyAuthorsQuery } from '$lib/queries'
  import { EyeOff, AlertTriangle, Info } from 'lucide-svelte'

  // `privateGallery` strips everything that would write a public record about
  // this gallery. A favorite, a comment or a report is an ordinary record in
  // the viewer's public repo naming the gallery's URI, so offering them for a
  // gallery that lives in a permissioned space would publish its existence to
  // the network. Delete and edit are wrong for a different reason: they act on
  // the public repo, where a private gallery has no record at all.
  let {
    gallery,
    onCommentClick,
    onStoryTap,
    privateGallery = false,
  }: {
    gallery: GalleryView
    onCommentClick?: () => void
    onStoryTap?: (did: string) => void
    privateGallery?: boolean
  } = $props()

  const queryClient = useQueryClient()
  const isOwner = $derived($viewer?.did === gallery.creator?.did)
  const storyAuthors = createQuery(() => storyAuthorsQuery())
  const creatorHasStory = $derived(
    storyAuthors.data?.some((a) => a.profile.did === gallery.creator?.did) ?? false
  )
  let deleting = $state(false)
  let reportOpen = $state(false)
  let doFavorite: (() => void) | undefined = $state(undefined)

  async function deleteGallery() {
    if (deleting) return
    if (!confirm('Delete this gallery? This cannot be undone.')) return

    const rkey = gallery.uri.split('/').pop()
    deleting = true
    try {
      await callXrpc('social.grain.unspecced.deleteGallery', { rkey: rkey! })
      queryClient.invalidateQueries({ queryKey: ['getFeed'] })
      goto(`/profile/${gallery.creator?.did}`)
    } catch (err) {
      console.error('Failed to delete gallery:', err)
      alert('Failed to delete gallery. Please try again.')
    } finally {
      deleting = false
    }
  }


  const displayName = $derived(
    gallery.creator?.displayName || (gallery.creator?.handle ? `@${gallery.creator.handle}` : gallery.creator?.did?.slice(0, 18) + '\u2026')
  )
  const handle = $derived(gallery.creator?.handle ? `@${gallery.creator.handle}` : '')
  const avatarSrc = $derived(gallery.creator?.avatar ?? null)
  const timeStr = $derived(relativeTime(gallery.createdAt || ''))
  const photos = $derived((gallery.items ?? []) as PhotoView[])
  const favCount = $derived(gallery.favCount ?? 0)
  const commentCount = $derived(gallery.commentCount ?? 0)
  const galleryRkey = $derived(gallery.uri.split('/').pop())
  const galleryHref = $derived(`/profile/${gallery.creator?.did}/gallery/${galleryRkey}`)
  const favedByFollowing = $derived(gallery.favedByFollowing ?? [])
  const favedByNames = $derived(
    favedByFollowing.slice(0, 2).map((p) => p.displayName || (p.handle ? `@${p.handle}` : '')),
  )


  let showToast = $state(false)

  async function handleShare() {
    const rkey = gallery.uri.split('/').pop()
    const url = `${window.location.origin}/profile/${gallery.creator?.did}/gallery/${rkey}`
    const result = await share(url)
    if (result.success && result.method === 'clipboard') {
      showToast = true
    }
  }


  const labelDefs = createQuery(() => labelDefsQuery())
  const labelResult = $derived(resolveLabels(gallery.labels, labelDefs.data ?? []))
  let revealed = $state(false)

  let currentIndex = $state(0)
  let descriptionExpanded = $state(false)
  let descriptionClamped = $state(false)
  let descriptionEl: HTMLParagraphElement | undefined = $state(undefined)

  $effect(() => {
    if (descriptionEl && !descriptionExpanded) {
      descriptionClamped = descriptionEl.scrollHeight > descriptionEl.clientHeight + 1
    }
  })
  const currentExif = $derived(photos[currentIndex]?.exif as ExifView | undefined)




</script>

{#if (labelResult.action === 'hide' || labelResult.action === 'warn-content') && !revealed}
  <article class="gallery-card gallery-hidden">
    <div class="media-warning-bar">
      <div class="media-warning-left">
        <Info size={16} />
        <span>{labelResult.name}</span>
      </div>
      <button class="media-warning-show" onclick={() => (revealed = true)}>Show</button>
    </div>
  </article>
{:else}
<article class="gallery-card" class:has-label-badge={labelResult.action === 'badge'}>
  <div>
  <header class="card-header">
    <ProfilePopover did={gallery.creator?.did ?? ''}>
      <a href="/profile/{gallery.creator?.did}" class="author-chip">
        <Avatar did={gallery.creator?.did ?? ''} src={avatarSrc} name={displayName} size={40} hasStory={creatorHasStory} onclick={creatorHasStory && onStoryTap ? () => { onStoryTap!(gallery.creator!.did) } : undefined} />
        <div class="author-info">
          <span class="author-name-row">
            <span class="author-handle">{displayName}</span>
            {#if handle}<span class="author-subtext">{handle}</span>{/if}
            <span class="header-time">· {timeStr}</span>
          </span>
          {#if gallery.location}
            <!-- svelte-ignore node_invalid_placement_ssr -->
            <a class="location-link" href="/location/{encodeURIComponent(gallery.location.value)}?name={encodeURIComponent(gallery.locationDisplay ?? gallery.location.name ?? gallery.location.value)}" onclick={(e) => e.stopPropagation()}>
              {gallery.locationDisplay ?? gallery.location.name ?? gallery.location.value}
            </a>
          {/if}
        </div>
      </a>
    </ProfilePopover>
    {#if !privateGallery}
    <OverflowMenu horizontal>
      {#if $isAuthenticated}
        <button class="menu-item" type="button" onclick={() => (reportOpen = true)}>
          <Flag size={15} />
          Report
        </button>
      {/if}
      {#if isOwner}
        <div class="menu-divider"></div>
        {#if $viewer?.did === 'did:plc:bcgltzqazw5tb6k2g3ttenbj'}
          <a class="menu-item" href="/profile/{gallery.creator?.did}/gallery/{gallery.uri.split('/').pop()}/edit">
            <Pencil size={15} />
            Edit gallery
          </a>
        {/if}
        <button class="menu-item delete" type="button" onclick={deleteGallery} disabled={deleting}>
          <Trash2 size={15} />
          Delete gallery
        </button>
      {/if}
    </OverflowMenu>
    {/if}
  </header>

  <GalleryMedia
    {photos}
    bind:currentIndex
    obscured={labelResult.action === 'warn-media' && !revealed}
    warnLabel={labelResult.name}
    onShow={() => (revealed = true)}
    onDoubleTap={() => doFavorite?.()}
  />

  <div class="engagement">
    {#if !privateGallery}
    <FavoriteButton
      galleryUri={gallery.uri}
      viewerFav={gallery.viewer?.fav ?? null}
      {favCount}
      countHref="{galleryHref}/favorited-by"
      bind:favorite={doFavorite}
    />
    <button class="stat" type="button" onclick={() => requireAuth() && onCommentClick?.()}>
      <MessageCircle size={20} />
      {#if commentCount > 0}<span class="stat-count">{commentCount}</span>{/if}
    </button>
    {/if}
    <button class="stat" type="button" onclick={handleShare} aria-label="Share">
      <Send size={20} />
    </button>
  </div>

  {#if favedByFollowing.length > 0 && !privateGallery}
    <a class="faved-by" href="{galleryHref}/favorited-by">
      <Facepile people={favedByFollowing} size={20} />
      <span class="faved-by-text">
        {#if favedByNames.length === 1}
          Favorited by <strong>{favedByNames[0]}</strong>
        {:else if favedByFollowing.length > 2}
          Favorited by <strong>{favedByNames[0]}</strong>, <strong>{favedByNames[1]}</strong> and others you follow
        {:else}
          Favorited by <strong>{favedByNames[0]}</strong> and <strong>{favedByNames[1]}</strong>
        {/if}
      </span>
    </a>
  {/if}
  {#if $isAuthenticated}
    <ReportButton subjectUri={gallery.uri} subjectCid={gallery.cid} showButton={false} bind:open={reportOpen} />
  {/if}

  <Toast message="Link copied" bind:visible={showToast} />

  {#if currentExif}
    <ExifInfo exif={currentExif} />
  {/if}

  <div class="card-content">
    <a href="/profile/{gallery.creator?.did}/gallery/{gallery.uri.split('/').pop()}" class="title-link">
      <p class="title">{gallery.title}</p>
    </a>
    {#if gallery.description}
      <p class="description" class:expanded={descriptionExpanded} bind:this={descriptionEl}><RichText text={gallery.description} /></p>
      {#if descriptionClamped && !descriptionExpanded}
        <button class="more-btn" type="button" onclick={() => (descriptionExpanded = true)}>more</button>
      {/if}
    {/if}
    {#if labelResult.action === 'badge'}
      <span class="label-badge"><AlertTriangle size={12} /> {labelResult.name}</span>
    {/if}
  </div>
  </div>
</article>
{/if}

<style>
.gallery-card {
    margin-bottom: 32px;
    /* Skip layout/paint for offscreen cards. `auto` remembers the last measured
       size, so scroll position stays stable once a card has been rendered. */
    content-visibility: auto;
    contain-intrinsic-size: auto 640px;
  }
/* Header */
  .card-header { padding: 12px 0; display: flex; align-items: center; }
.author-chip {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    color: inherit;
    min-width: 0;
    overflow: hidden;
  }
.author-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }
.author-name-row {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }
.author-handle {
    font-weight: 600;
    font-size: 15px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
.author-subtext {
    font-size: 13px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 1;
  }
.header-time {
    font-size: 13px;
    color: var(--text-muted);
    white-space: nowrap;
    flex-shrink: 0;
  }
.card-header :global(.overflow-menu) {
    margin-left: auto;
  }
/* Menu items (inside OverflowMenu) */
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
.menu-item:hover {
    background: var(--bg-hover);
  }
.menu-item.delete {
    color: var(--danger);
  }
.menu-divider { height: 1px; background: var(--border); margin: 4px 0; }
.menu-item:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
/* Engagement */
  .engagement {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 10px 0;
  }
.stat {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
    padding: 0;
    font-family: inherit;
    font-size: 13px;
    transition: opacity 0.15s;
  }
.stat:hover { opacity: 0.7; }
.stat-count { color: var(--text-secondary); }
/* "Favorited by people you follow" facepile */
  .faved-by {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 0 10px;
    text-decoration: none;
    color: inherit;
  }
.faved-by:hover .faved-by-text {
    text-decoration: underline;
  }
.faved-by-text {
    font-size: 12px;
    color: var(--text-muted);
  }
.faved-by-text strong {
    color: var(--text-secondary);
    font-weight: 600;
  }
/* Content */
  .card-content { padding: 0 0 14px; }
.title-link {
    text-decoration: none;
    color: inherit;
  }
.title-link:hover .title {
    text-decoration: underline;
  }
.title {
    font-weight: 600;
    font-size: 16px;
    margin: 0 0 4px;
  }
.description {
    font-size: 14px;
    color: var(--text-secondary);
    margin: 0 0 4px;
    white-space: pre-wrap;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
.description.expanded {
    display: block;
    -webkit-line-clamp: unset;
    line-clamp: unset;
    overflow: visible;
  }
.more-btn {
    background: none;
    border: none;
    padding: 0;
    margin: 0 0 4px;
    font-size: 13px;
    font-family: inherit;
    color: var(--text-muted);
    cursor: pointer;
  }
.more-btn:hover {
    color: var(--text-secondary);
  }
.location-link {
    font-size: 13px;
    color: var(--text-muted);
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
.location-link:hover {
    color: var(--grain);
  }
/* Label moderation states */
  .gallery-hidden {
    padding: 12px;
  }
.gallery-hidden .media-warning-bar {
    position: relative;
    top: auto;
    left: auto;
    right: auto;
    transform: none;
  }
.media-warning-bar {
    position: absolute;
    top: 50%;
    left: 12px;
    right: 12px;
    transform: translateY(-50%);
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: var(--bg-secondary);
    border-radius: 8px;
    border: 1px solid var(--border);
  }
.media-warning-left {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-secondary);
    font-size: 14px;
    font-weight: 500;
  }
.media-warning-show {
    background: none;
    border: none;
    color: var(--grain);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    font-family: var(--font-body);
    padding: 0;
  }
.media-warning-show:hover {
    opacity: 0.8;
  }
.label-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--text-muted);
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 2px 8px;
    margin-top: 4px;
  }
/* On a phone the container edge is the screen edge, so text gets a gutter.
     The carousel breaks back out of it and stays edge to edge. */
  @media (max-width: 600px) {
    .gallery-card { padding-left: 12px; padding-right: 12px; }
  }
</style>
