<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query'
  import { galleryQuery } from '$lib/queries'
  import GalleryMedia from '$lib/components/molecules/GalleryMedia.svelte'
  import GalleryCard from '$lib/components/molecules/GalleryCard.svelte'
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import CommentSheet from '$lib/components/organisms/CommentSheet.svelte'
  import ExifInfo from '$lib/components/atoms/ExifInfo.svelte'
  import Avatar from '$lib/components/atoms/Avatar.svelte'
  import RichText from '$lib/components/atoms/RichText.svelte'
  import FavoriteButton from '$lib/components/molecules/FavoriteButton.svelte'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'
  import BskyIcon from '$lib/components/atoms/BskyIcon.svelte'
  import { ArrowLeft } from 'lucide-svelte'
  import { goto } from '$app/navigation'
  import { relativeTime } from '$lib/utils'
  import type { GalleryView, PhotoView, ExifView } from '$hatk/client'

  let { data } = $props()

  const did = $derived(data.did)
  const rkey = $derived(data.rkey)
  const galleryUri = $derived(data.galleryUri)
  const galleryQ = createQuery(() => galleryQuery(galleryUri))
  const gallery = $derived((galleryQ.data as GalleryView) ?? null)
  const bskyUrl = $derived((gallery as any)?.crossPost?.url ?? null)

  const photos = $derived((gallery?.items ?? []) as PhotoView[])
  let currentIndex = $state(0)
  const currentExif = $derived(photos[currentIndex]?.exif as ExifView | undefined)
  let doFavorite: (() => void) | undefined = $state(undefined)

  let commentSheetOpen = $state(false)

  // Even with the floor above, a caption like a bare URL plus a hashtag block
  // runs 250px and buries the comments. Clamp it and let the reader opt in.
  let captionEl: HTMLDivElement | undefined = $state()
  let captionExpanded = $state(false)
  let captionOverflows = $state(false)
  $effect(() => {
    // Re-measure when the gallery or the available height changes.
    void galleryUri
    void mediaMax
    if (!captionEl) return
    captionExpanded = false
    captionOverflows = captionEl.scrollHeight > captionEl.clientHeight + 1
  })

  // The photo gets whatever height the viewport can spare. Without this a
  // portrait frame at column width runs past the fold, which is the whole
  // reason this page is a split rather than a card.
  let isSplit = $state(false)
  let mediaMax = $state(560)
  // The row follows the photo, not the metadata: whatever height the media
  // settles at, the column matches it and the comment thread absorbs the
  // difference by scrolling. Without this the caption length decides the
  // layout and short photos get letterboxed to fit it.
  //
  // The photo is capped by height, so at most viewport sizes it is narrower
  // than the column it sits in. Sizing the column to the leftover width left a
  // dead strip of pane beside the photo, so measure the container and derive
  // the column from the photo's own shape instead.
  const SIDEBAR_W = 340
  // The column height must not depend on how much is in it, or posting a
  // comment would grow the column and shift the centred photo under you. It is
  // a function of the photo and the viewport only; the thread scrolls inside
  // it. This floor is what a short landscape frame needs before the clamped
  // caption and the actions leave the thread with nothing.
  const SIDEBAR_MIN_H = 540
  let splitEl: HTMLDivElement | undefined = $state()
  let splitW = $state(0)
  let mediaRatio: number | null = $state(null)
  $effect(() => {
    if (!splitEl) return
    const ro = new ResizeObserver(([e]) => (splitW = Math.round(e.contentRect.width)))
    ro.observe(splitEl)
    return () => ro.disconnect()
  })
  // Fits the photo inside the available box, then hands the column exactly the
  // width it settled at. Null while the ratio is unknown, where the old
  // fill-the-column behaviour is the safe fallback.
  const fit = $derived.by(() => {
    if (!mediaRatio || splitW <= SIDEBAR_W) return null
    // Only the height is derived. The column keeps the full available width for
    // every gallery, so the sidebar sits in the same place whatever the photo's
    // shape, and a portrait is centred in the same space a landscape fills.
    return { h: Math.round(Math.min(mediaMax, (splitW - SIDEBAR_W) / mediaRatio)) }
  })
  $effect(() => {
    const mq = window.matchMedia('(min-width: 900px)')
    const sync = () => {
      mediaMax = Math.max(320, Math.round(window.innerHeight - 150))
      isSplit = mq.matches
    }
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  })

  function back() {
    if (window.history.length > 1) history.back()
    else goto('/')
  }
</script>

<OGMeta
  title={gallery ? `${gallery.title} by @${gallery.creator.handle} — Grain` : 'Gallery — Grain'}
  description={gallery ? (gallery.description || `Photo gallery on Grain`) : 'Photo gallery on Grain'}
  image="/og/profile/{did}/gallery/{rkey}"
/>

{#if galleryQ.isLoading}
  <p class="state">Loading...</p>
{:else if !gallery}
  <p class="state">Gallery not found</p>
{:else}
  <!-- Below 900px this collapses to the card, which is already the right
       shape for a phone; the split only earns its keep on a wide screen. -->
  <div class="stacked">
    <!-- The split's own back button lives in the metadata column, which is
         hidden here, so the stacked view needs its own header — as it had
         before this page grew a desktop layout. -->
    <DetailHeader label={gallery.title ?? 'Gallery'}>
      {#snippet actions()}
        {#if bskyUrl}
          <a
            class="bsky-link"
            href={bskyUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="View on Bluesky"
          >
            <BskyIcon />
          </a>
        {/if}
      {/snippet}
    </DetailHeader>
    <GalleryCard {gallery} onCommentClick={() => (commentSheetOpen = true)} />
  </div>

  <!-- The floor is a panorama guard, not a layout target: it is the smallest
       height that still fits the author, actions and composer, so it only bites
       on genuinely short frames. Set any higher and ordinary landscape photos
       get a sidebar hanging below them for no reason. -->
  <div
    class="split"
    bind:this={splitEl}
    style:--row-h="{Math.min(mediaMax, Math.max(fit?.h ?? 0, SIDEBAR_MIN_H))}px"
  >
    <div class="media">
      <GalleryMedia
        {photos}
        bind:currentIndex
        bind:renderedRatio={mediaRatio}
        maxHeight={fit?.h ?? mediaMax}
        onDoubleTap={() => doFavorite?.()}
      />
    </div>

    <aside class="meta">
      <div class="meta-top">
        <button class="icon-btn" type="button" onclick={back} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        {#if bskyUrl}
          <a class="bsky-link" href={bskyUrl} target="_blank" rel="noopener noreferrer" title="View on Bluesky">
            <BskyIcon />
          </a>
        {/if}
      </div>

      <a class="author" href="/profile/{gallery.creator?.did}">
        <Avatar
          did={gallery.creator?.did ?? ''}
          src={gallery.creator?.avatar ?? null}
          name={gallery.creator?.displayName ?? gallery.creator?.handle}
          size={40}
        />
        <span class="author-text">
          <span class="author-name">{gallery.creator?.displayName || gallery.creator?.handle}</span>
          <span class="author-sub">
            {gallery.creator?.handle ? `@${gallery.creator.handle}` : ''}
            {#if gallery.createdAt}· {relativeTime(gallery.createdAt)}{/if}
          </span>
        </span>
      </a>

      <div class="thread">
        <CommentSheet open={isSplit} inline subjectUri={gallery.uri} onClose={() => {}}>
          {#snippet before()}
            <div class="body">
            <h1>{gallery.title}</h1>
            {#if gallery.description}
              <div
                class="description"
                class:clamped={!captionExpanded}
                bind:this={captionEl}
              >
                <RichText text={gallery.description} />
              </div>
              {#if captionOverflows && !captionExpanded}
                <button class="more" type="button" onclick={() => (captionExpanded = true)}>
                  more
                </button>
              {/if}
            {/if}
            {#if currentExif}
              <div class="exif"><ExifInfo exif={currentExif} /></div>
            {/if}
                </div>
          {/snippet}
          {#snippet footer()}
            <div class="actions">
            <FavoriteButton
              galleryUri={gallery.uri}
              viewerFav={gallery.viewer?.fav ?? null}
              favCount={gallery.favCount ?? 0}
              countHref="/profile/{did}/gallery/{rkey}/favorited-by"
              bind:favorite={doFavorite}
            />
                </div>
          {/snippet}
        </CommentSheet>
      </div>
    </aside>
  </div>

  <CommentSheet
    open={commentSheetOpen}
    subjectUri={gallery.uri}
    onClose={() => { commentSheetOpen = false }}
  />
{/if}

<style>
  .state {
    text-align: center;
    color: var(--text-muted);
    padding: 48px 16px;
    font-size: 14px;
  }

  .split { display: none; }
  .stacked { max-width: 600px; margin: 0 auto; }

  @media (min-width: 900px) {
    .stacked { display: none; }
    .split {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 340px;
      gap: 0;
      align-items: start;
    }
    /* Deliberately not stretched to --row-h: when the floor is taller than the
       photo, growing the pane would letterbox it. The sidebar simply runs a
       little past the photo instead, which reads better than black bars.
       No backdrop, so the space a narrower photo leaves beside it reads as page
       rather than as bars — and a hairline of rounding cannot show. */
    .media {
      min-width: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      align-self: center;
    }
    /* A definite height, deliberately: see SIDEBAR_MIN_H. Content-sized would
       make the column jump every time a comment is posted. */
    .meta {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 12px 16px 0;
      min-width: 0;
      height: var(--row-h);
      overflow: hidden;
    }
    .thread {
      flex: 1;
      min-height: 0;
      display: flex;
      overflow: hidden;
    }
    .thread :global(.sheet.inline) { width: 100%; }
  }

  .meta-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    margin-left: -6px;
    border: none;
    border-radius: 50%;
    background: none;
    color: var(--text-primary);
    cursor: pointer;
  }
  .icon-btn:hover { background: var(--bg-hover); }
  .bsky-link { color: var(--text-muted); display: flex; padding: 4px; }
  .bsky-link:hover { color: #0085ff; }

  .author {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    color: inherit;
    min-width: 0;
  }
  .author-text { display: flex; flex-direction: column; min-width: 0; }
  .author-name { font-size: 15px; font-weight: 600; }
  .author-sub { font-size: 13px; color: var(--text-muted); }

  h1 {
    font-size: 18px;
    font-weight: 700;
    margin: 0 0 4px;
    letter-spacing: -0.01em;
  }
  .description {
    font-size: 14px;
    line-height: 1.55;
    color: var(--text-secondary);
    white-space: pre-wrap;
  }
  .exif { font-size: 13px; }
  /* Stacked, this is as tall as the caption and pushes the thread off the
     bottom. The sidebar has the width to run it inline. */
  .exif :global(.exif-info) {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px 12px;
  }

  .description.clamped {
    display: -webkit-box;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .more {
    margin-top: 2px;
    padding: 0;
    border: none;
    background: none;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
    cursor: pointer;
  }
  .more:hover { color: var(--text-primary); }

  .actions {
    display: flex;
    align-items: center;
    gap: 16px;
  }
</style>
