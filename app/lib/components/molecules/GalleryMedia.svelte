<script lang="ts">
  /**
   * The media viewer for a gallery: swipeable photos, arrows, dots, alt text
   * and the moderation cover. Extracted from GalleryCard so the detail page can
   * show the same carousel beside the metadata instead of above it.
   */
  import { browser } from '$app/environment'
  import { ChevronLeft, ChevronRight, Heart, Info } from 'lucide-svelte'
  import type { PhotoView } from '$hatk/client'

  let {
    photos,
    currentIndex = $bindable(0),
    /** Cap the media height (detail view). Portrait photos otherwise run past
        the viewport. Unset in the feed, where width drives height. */
    maxHeight = null,
    obscured = false,
    warnLabel = null,
    onShow,
    onDoubleTap,
    /** The aspect ratio the carousel actually renders at, reported back so a
        parent can size its column to the photo instead of leaving dead space
        beside it. Null until photos are known, or when uncapped. */
    renderedRatio = $bindable(null),
  }: {
    photos: PhotoView[]
    currentIndex?: number
    maxHeight?: number | null
    obscured?: boolean
    warnLabel?: string | null
    onShow?: () => void
    onDoubleTap?: () => void
    renderedRatio?: number | null
  } = $props()

  const isDesktop = browser ? window.matchMedia('(min-width: 768px)').matches : false

  let carouselEl: HTMLDivElement | undefined = $state(undefined)
  let activeAltIndex: number | null = $state(null)
  let showHeartAnim = $state(false)

  function photoRatio(photo: PhotoView): number {
    const ar = photo.aspectRatio as { width?: number; height?: number } | undefined
    if (ar?.width && ar?.height) return ar.width / ar.height
    return 1
  }

  const ratios = $derived(photos.map(photoRatio))
  const hasPortrait = $derived(photos.some((p) => photoRatio(p) < 1))
  const needsFixedHeight = $derived(
    photos.length > 1 && new Set(ratios.map((r) => r.toFixed(2))).size > 1,
  )
  const minRatio = $derived(
    photos.length > 0 ? Math.max(Math.min(...ratios), hasPortrait ? 0.56 : Math.min(...ratios)) : 1,
  )
  // Single source of truth for the capped carousel's shape: the inline
  // aspect-ratio below and the ratio reported to the parent must not drift.
  const cappedRatio = $derived(
    needsFixedHeight ? minRatio : photos[0] ? photoRatio(photos[0]) : 1,
  )
  $effect(() => {
    renderedRatio = maxHeight != null && photos.length > 0 ? cappedRatio : null
  })

  function onScroll() {
    if (!carouselEl) return
    const idx = Math.round(carouselEl.scrollLeft / carouselEl.offsetWidth)
    if (idx !== currentIndex) currentIndex = idx
  }

  function goTo(index: number) {
    if (!carouselEl) return
    const slides = carouselEl.querySelectorAll('.slide')
    const target = slides[index] as HTMLElement | undefined
    if (target) carouselEl.scrollTo({ left: target.offsetLeft, behavior: 'smooth' })
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
    let start = Math.max(0, currentIndex - 2)
    let end = Math.min(total, start + 5)
    if (end - start < 5) start = Math.max(0, end - 5)
    return Array.from({ length: end - start }, (_, i) => start + i)
  })

  function doubleTap() {
    onDoubleTap?.()
    showHeartAnim = true
    setTimeout(() => (showHeartAnim = false), 800)
  }
</script>

{#if photos.length > 0}
  <div
    class="carousel-host"
    class:media-obscured={obscured}
    class:capped={maxHeight != null}
    style={maxHeight != null ? `--max-h:${maxHeight}px` : ''}
  >
    {#if obscured && warnLabel}
      <div class="media-warning-bar">
        <div class="media-warning-left">
          <Info size={16} />
          <span>{warnLabel}</span>
        </div>
        <button class="media-warning-show" onclick={() => onShow?.()}>Show</button>
      </div>
    {/if}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="carousel"
      bind:this={carouselEl}
      onscroll={onScroll}
      ondblclick={doubleTap}
      style={maxHeight != null
        ? needsFixedHeight
          ? `height: ${maxHeight}px;`
          : `aspect-ratio: ${cappedRatio};`
        : needsFixedHeight
          ? `aspect-ratio: ${minRatio};`
          : ''}
    >
      {#each photos as photo, i}
        <div class="slide" class:centered={needsFixedHeight || maxHeight != null}>
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

<style>
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
    color: var(--danger);
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
.media-obscured {
    position: relative;
  }
.media-obscured .carousel {
    visibility: hidden;
  }
  /* Paging chrome would otherwise draw over the warning and let you step
     through media the label says to hide. */
  .media-obscured .nav-arrow,
  .media-obscured .dots {
    display: none;
  }
.media-obscured::before {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--bg-elevated);
    z-index: 1;
  }
  /* These live here rather than in GalleryCard because the markup does: the
     card's copies are scoped to the card, so they never reached this overlay
     and the Show button sat under the obscuring layer, unclickable. */
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

  /* Height-capped mode: the slide is sized by the cap and the photo is
     letterboxed inside it, so a portrait frame cannot outgrow the viewport. */
  /* The host is a flex item in the detail view's pane, so without a definite
     width it shrink-to-fits its content — which is nothing until the image
     loads. That rendered the photo small and snapped it to full size on load.
     The aspect ratio below then gives the box its height, so the space is
     reserved from the first frame. */
  .carousel-host.capped {
    width: 100%;
  }
  .carousel-host.capped .carousel {
    max-height: var(--max-h);
    /* The host fills the column, but the cap can leave the carousel narrower
       than it — centre it so a portrait sits in the middle of the same space a
       landscape fills, rather than hugging the left edge. */
    margin-inline: auto;
  }
  .carousel-host.capped .slide {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .carousel-host.capped .grain-image {
    height: 100%;
    width: 100%;
    padding-bottom: 0 !important;
  }
  .carousel-host.capped .spacer { display: none; }
  .carousel-host.capped .grain-image img {
    position: relative;
    height: 100%;
    width: 100%;
    object-fit: contain;
  }

  /* Edge to edge on phones, matching the card's gutter. */
  @media (max-width: 600px) {
    .carousel-host {
      margin-left: -12px;
      margin-right: -12px;
    }
  }
</style>
