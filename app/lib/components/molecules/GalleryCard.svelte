<script lang="ts">
  import type { GalleryView, PhotoView, ExifView } from '$hatk/client'
  import { callXrpc } from '$hatk/client'
  import { goto } from '$app/navigation'
  import Avatar from '../atoms/Avatar.svelte'
  import RichText from '../atoms/RichText.svelte'
  import Toast from '../atoms/Toast.svelte'
  import ExifInfo from '../atoms/ExifInfo.svelte'
  import FavoriteButton from './FavoriteButton.svelte'
  import ReportButton from './ReportButton.svelte'
  import ProfilePopover from './ProfilePopover.svelte'
  import { relativeTime } from '$lib/utils'
  import { MessageCircle, Send, ChevronLeft, ChevronRight, Trash2, Heart, Flag } from 'lucide-svelte'
  import OverflowMenu from '../atoms/OverflowMenu.svelte'
  import { share } from '$lib/utils/share'
  import { browser } from '$app/environment'
  import { isAuthenticated, requireAuth, viewer } from '$lib/stores'
  import { resolveLabels, labelDefsQuery } from '$lib/labels'
  import { createQuery, useQueryClient } from '@tanstack/svelte-query'
  import { storyAuthorsQuery } from '$lib/queries'
  import { EyeOff, AlertTriangle, Info } from 'lucide-svelte'

  let { gallery, onCommentClick, onStoryTap }: { gallery: GalleryView; onCommentClick?: () => void; onStoryTap?: (did: string) => void } = $props()

  const queryClient = useQueryClient()
  const isOwner = $derived($viewer?.did === gallery.creator?.did)
  const storyAuthors = createQuery(() => storyAuthorsQuery())
  const creatorHasStory = $derived(
    storyAuthors.data?.some((a) => a.profile.did === gallery.creator?.did) ?? false
  )
  let deleting = $state(false)
  let reportOpen = $state(false)
  let doFavorite: (() => void) | undefined = $state(undefined)
  let showHeartAnim = $state(false)

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

  const isDesktop = browser ? window.matchMedia('(min-width: 768px)').matches : false

  const displayName = $derived(
    gallery.creator?.displayName || (gallery.creator?.handle ? `@${gallery.creator.handle}` : gallery.creator?.did?.slice(0, 18) + '\u2026')
  )
  const handle = $derived(gallery.creator?.handle ? `@${gallery.creator.handle}` : '')
  const avatarSrc = $derived(gallery.creator?.avatar ?? null)
  const timeStr = $derived(relativeTime(gallery.createdAt || ''))
  const photos = $derived((gallery.items ?? []) as PhotoView[])
  const favCount = $derived(gallery.favCount ?? 0)
  const commentCount = $derived(gallery.commentCount ?? 0)

  function photoRatio(photo: PhotoView): number {
    const ar = photo.aspectRatio
    if (!ar) return 1
    return ar.width / ar.height
  }

  let showToast = $state(false)

  async function handleShare() {
    const rkey = gallery.uri.split('/').pop()
    const url = `${window.location.origin}/profile/${gallery.creator?.did}/gallery/${rkey}`
    const result = await share(url)
    if (result.success && result.method === 'clipboard') {
      showToast = true
    }
  }

  const hasPortrait = $derived(photos.some((p) => photoRatio(p) < 1))
  const ratios = $derived(photos.map(photoRatio))
  const needsFixedHeight = $derived(
    photos.length > 1 && new Set(ratios.map((r) => r.toFixed(2))).size > 1
  )
  const minRatio = $derived(
    photos.length > 0 ? Math.max(Math.min(...ratios), hasPortrait ? 0.56 : Math.min(...ratios)) : 1
  )

  const labelDefs = createQuery(() => labelDefsQuery())
  const labelResult = $derived(resolveLabels(gallery.labels, labelDefs.data ?? []))
  let revealed = $state(false)

  let currentIndex = $state(0)
  let carouselEl: HTMLDivElement | undefined = $state(undefined)
  let activeAltIndex: number | null = $state(null)
  let descriptionExpanded = $state(false)
  let descriptionClamped = $state(false)
  let descriptionEl: HTMLParagraphElement | undefined = $state(undefined)

  $effect(() => {
    if (descriptionEl && !descriptionExpanded) {
      descriptionClamped = descriptionEl.scrollHeight > descriptionEl.clientHeight + 1
    }
  })
  const currentExif = $derived(photos[currentIndex]?.exif as ExifView | undefined)

  function onScroll() {
    if (!carouselEl) return
    const idx = Math.round(carouselEl.scrollLeft / carouselEl.offsetWidth)
    if (idx !== currentIndex) {
      currentIndex = idx
      activeAltIndex = null
    }
  }

  function goTo(index: number) {
    if (!carouselEl) return
    const slides = carouselEl.querySelectorAll('.slide')
    slides[index]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
  }

  function dotClass(index: number): string {
    const distance = Math.abs(index - currentIndex)
    if (index === currentIndex) return 'dot active'
    if (distance === 1) return 'dot'
    if (distance === 2) return 'dot small'
    return 'dot tiny'
  }

  const visibleDots = $derived.by(() => {
    const total = photos.length
    if (total <= 5) return Array.from({ length: total }, (_, i) => i)
    const maxVisible = 5
    let start = Math.max(0, currentIndex - 2)
    let end = start + maxVisible
    if (end > total) {
      end = total
      start = end - maxVisible
    }
    return Array.from({ length: end - start }, (_, i) => start + i)
  })
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
        <Avatar did={gallery.creator?.did ?? ''} src={avatarSrc} size={32} hasStory={creatorHasStory} onclick={creatorHasStory && onStoryTap ? () => { onStoryTap!(gallery.creator!.did) } : undefined} />
        <div class="author-info">
          <span class="author-name-row">
            <span class="author-handle">{displayName}</span>
            {#if handle}<span class="author-subtext">{handle}</span>{/if}
            <span class="header-time">· {timeStr}</span>
          </span>
          {#if gallery.location}
            <!-- svelte-ignore node_invalid_placement_ssr -->
            <a class="location-link" href="/location/{encodeURIComponent(gallery.location.value)}?name={encodeURIComponent(gallery.location.name ?? gallery.location.value)}" onclick={(e) => e.stopPropagation()}>
              {gallery.location.name ?? gallery.address?.locality ?? gallery.location.value}
            </a>
          {/if}
        </div>
      </a>
    </ProfilePopover>
    <OverflowMenu horizontal>
      {#if $isAuthenticated}
        <button class="menu-item" type="button" onclick={() => (reportOpen = true)}>
          <Flag size={15} />
          Report
        </button>
      {/if}
      {#if isOwner}
        <div class="menu-divider"></div>
        <button class="menu-item delete" type="button" onclick={deleteGallery} disabled={deleting}>
          <Trash2 size={15} />
          Delete gallery
        </button>
      {/if}
    </OverflowMenu>
  </header>

  {#if photos.length > 0}
    <div class="carousel-host" class:media-obscured={labelResult.action === 'warn-media' && !revealed}>
      {#if labelResult.action === 'warn-media' && !revealed}
        <div class="media-warning-bar">
          <div class="media-warning-left">
            <Info size={16} />
            <span>{labelResult.name}</span>
          </div>
          <button class="media-warning-show" onclick={() => (revealed = true)}>Show</button>
        </div>
      {/if}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="carousel"
        bind:this={carouselEl}
        onscroll={onScroll}
        ondblclick={() => { doFavorite?.(); showHeartAnim = true; setTimeout(() => (showHeartAnim = false), 800) }}
        style={needsFixedHeight ? `aspect-ratio: ${minRatio};` : ''}
      >
        {#each photos as photo, i}
          <div class="slide" class:centered={needsFixedHeight}>
            <div class="grain-image">
              <svg class="spacer" viewBox="0 0 1 {1 / Math.max(photoRatio(photo), needsFixedHeight ? minRatio : photoRatio(photo))}"></svg>
              <img
                src={Math.abs(i - currentIndex) <= 1 ? (isDesktop ? photo.fullsize : photo.thumb) : ''}
                alt={photo.alt ?? ''}
                decoding="async"
                loading="lazy"
                onload={(e) => (e.currentTarget as HTMLImageElement).classList.add('loaded')}
              />
            </div>
            {#if photo.alt}
              <button class="alt-badge" onclick={() => (activeAltIndex = i)}>ALT</button>
            {/if}
            {#if activeAltIndex === i}
              <button class="alt-overlay" onclick={() => (activeAltIndex = null)}>
                {photo.alt}
              </button>
            {/if}
          </div>
        {/each}
      </div>

      {#if photos.length > 1 && currentIndex > 0}
        <button class="nav-arrow nav-left" onclick={() => goTo(currentIndex - 1)} aria-label="Previous">
          <ChevronLeft size={14} />
        </button>
      {/if}
      {#if photos.length > 1 && currentIndex < photos.length - 1}
        <button class="nav-arrow nav-right" onclick={() => goTo(currentIndex + 1)} aria-label="Next">
          <ChevronRight size={14} />
        </button>
      {/if}

      {#if photos.length > 1}
        <div class="dots">
          {#each visibleDots as i}
            <span class={dotClass(i)}></span>
          {/each}
        </div>
      {/if}

      {#if showHeartAnim}
        <div class="heart-anim">
          <Heart size={64} fill="currentColor" />
        </div>
      {/if}
    </div>
  {/if}

  <div class="engagement">
    <FavoriteButton galleryUri={gallery.uri} viewerFav={gallery.viewer?.fav ?? null} {favCount} bind:favorite={doFavorite} />
    <button class="stat" type="button" onclick={() => requireAuth() && onCommentClick?.()}>
      <MessageCircle size={20} />
      {#if commentCount > 0}<span class="stat-count">{commentCount}</span>{/if}
    </button>
    <button class="stat" type="button" onclick={handleShare} aria-label="Share">
      <Send size={20} />
    </button>
  </div>
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
    border-bottom: 1px solid var(--border);
  }

  /* Header */
  .card-header { padding: 12px 16px; display: flex; align-items: center; }
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
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .author-subtext {
    font-size: 12px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 1;
  }
  .header-time {
    font-size: 12px;
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
    color: #f87171;
  }
  .menu-divider { height: 1px; background: var(--border); margin: 4px 0; }
  .menu-item:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Carousel — matches grain-next's grain-image-carousel */
  .carousel-host {
    display: block;
    position: relative;
  }
  .heart-anim {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    color: #f87171;
    animation: heart-pop 0.8s ease-out forwards;
    z-index: 5;
  }
  @keyframes heart-pop {
    0% { opacity: 0; transform: scale(0); }
    15% { opacity: 1; transform: scale(1.2); }
    30% { transform: scale(0.95); }
    45% { transform: scale(1); }
    70% { opacity: 1; }
    100% { opacity: 0; transform: scale(1); }
  }
  .carousel {
    display: flex;
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .carousel::-webkit-scrollbar { display: none; }

  .slide {
    flex: 0 0 100%;
    scroll-snap-align: start;
    position: relative;
  }
  .slide.centered {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .slide.centered .grain-image {
    width: 100%;
  }

  /* grain-image equivalent — SVG spacer + absolute img */
  .grain-image {
    display: block;
    position: relative;
    overflow: hidden;
    background: var(--bg-elevated);
  }
  .spacer {
    display: block;
    width: 100%;
  }
  .grain-image img {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  .grain-image img:global(.loaded) {
    opacity: 1;
  }

  /* Alt text */
  .alt-badge {
    position: absolute;
    bottom: 8px;
    right: 8px;
    padding: 2px 6px;
    border-radius: 4px;
    border: none;
    background: rgba(0, 0, 0, 0.65);
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.5px;
    cursor: pointer;
    z-index: 2;
  }
  .alt-badge:hover { background: rgba(0, 0, 0, 0.85); }
  .alt-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    color: #fff;
    padding: 16px;
    font-size: 14px;
    line-height: 1.5;
    overflow-y: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    border: none;
    cursor: pointer;
    z-index: 3;
    font-family: inherit;
  }

  /* Nav arrows */
  .nav-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.75);
    color: rgba(0, 0, 0, 0.7);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    z-index: 1;
    transition: background 0.15s;
  }
  .nav-arrow:hover { background: rgba(255, 255, 255, 0.95); }
  .nav-left { left: 8px; }
  .nav-right { right: 8px; }

  /* Dots */
  .dots {
    position: absolute;
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 5px;
  }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.4);
    transition: opacity 0.2s, width 0.2s, height 0.2s;
  }
  .dot.active { background: #fff; opacity: 1; }
  .dot.small { width: 4px; height: 4px; opacity: 0.3; }
  .dot.tiny { width: 3px; height: 3px; opacity: 0.2; }

  /* Engagement */
  .engagement {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 10px 16px;
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

  /* Content */
  .card-content { padding: 0 16px 14px; }
  .title-link {
    text-decoration: none;
    color: inherit;
  }
  .title-link:hover .title {
    text-decoration: underline;
  }
  .title {
    font-weight: 600;
    font-size: 14px;
    margin: 0 0 4px;
  }
  .description {
    font-size: 13px;
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
    font-size: 12px;
    color: var(--text-muted);
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .location-link:hover {
    color: var(--grain);
  }
  .timestamp {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  /* Label moderation states */
  .gallery-hidden {
    padding: 0;
  }
  .content-warning {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 16px;
    color: var(--text-muted);
    font-size: 13px;
  }
  .content-warning-full {
    flex-direction: column;
    text-align: center;
    padding: 32px 16px;
    gap: 6px;
  }
  .cw-label {
    font-weight: 600;
    font-size: 14px;
    color: var(--text-secondary);
  }
  .cw-text {
    margin: 0;
    font-size: 13px;
    color: var(--text-muted);
  }
  .cw-reveal {
    background: none;
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 6px 14px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    cursor: pointer;
    font-family: var(--font-body);
    margin-left: auto;
    transition: all 0.15s;
  }
  .cw-reveal:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  .media-obscured {
    position: relative;
  }
  .media-obscured .carousel {
    visibility: hidden;
  }
  .media-obscured::before {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--bg-elevated);
    z-index: 1;
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
</style>
