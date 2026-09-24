<script lang="ts">
  import { createQuery, createInfiniteQuery } from '@tanstack/svelte-query'
  import { galleryQuery, actorFeedQuery, groupQuery, poolGalleryQuery } from '$lib/queries'
  import { page } from '$app/state'
  import GalleryMedia from '$lib/components/molecules/GalleryMedia.svelte'
  import GalleryCard from '$lib/components/molecules/GalleryCard.svelte'
  import GalleryMenu from '$lib/components/molecules/GalleryMenu.svelte'
  import GalleryGrid from '$lib/components/organisms/GalleryGrid.svelte'
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import CommentSheet from '$lib/components/organisms/CommentSheet.svelte'
  import ExifInfo from '$lib/components/atoms/ExifInfo.svelte'
  import Avatar from '$lib/components/atoms/Avatar.svelte'
  import RichText from '$lib/components/atoms/RichText.svelte'
  import FavoriteButton from '$lib/components/molecules/FavoriteButton.svelte'
  import FavedByFollowing from '$lib/components/molecules/FavedByFollowing.svelte'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'
  import BskyIcon from '$lib/components/atoms/BskyIcon.svelte'
  import { ArrowLeft, AlertTriangle, Info, MapPin, CircleMinus } from 'lucide-svelte'
  import OverflowMenu from '$lib/components/atoms/OverflowMenu.svelte'
  import { viewer } from '$lib/stores'
  import { removeFromPool, withdrawFromPool} from '$lib/mutations'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { goto } from '$app/navigation'
  import { relativeTime, profilePath } from '$lib/utils'
  import { resolveLabels, labelDefsQuery } from '$lib/labels'
  import type { GalleryView, PhotoView, ExifView } from '$hatk/client'
  import { spaceBlobViews } from '$lib/spaceBlob'

  let { data } = $props()

  const actor = $derived(data.actor)
  const rkey = $derived(data.rkey)
  const galleryUri = $derived(data.galleryUri)

  // A gallery in a group's pool has the same address as any other — it is
  // the author's record, at their DID and rkey — but it is not in the public
  // repo, so it cannot be read the public way. `?group=` says which pool to
  // ask, and from there this is the same page: same split, same media, same
  // author line. What it is not is a second page for private galleries.
  const group = $derived(page.url.searchParams.get('group'))
  const galleryQ = createQuery(() => ({ ...galleryQuery(galleryUri), enabled: !group }))
  const poolQ = createQuery(() => ({
    // `actor` is the author's DID on a pooled link — see GalleryCard, which
    // builds those in DID form precisely because this read matches on it.
    ...poolGalleryQuery(group ?? '', actor, rkey),
    enabled: !!group,
  }))
  // Which group it is, is public and indexed; what is in its pool is not. So
  // the name under the author comes from the ordinary group read, and arrives
  // whether or not the credentialed one does.
  const groupQ = createQuery(() => ({ ...groupQuery(group ?? ''), enabled: !!group }))

  // Shaped into the view the rest of this page reads. Counts are absent rather
  // than zero: a favorite or a comment is a public record naming the gallery,
  // and this gallery is not public, so there is nothing to count and nothing
  // offered — see `pooled` below.
  const poolView = $derived.by((): GalleryView | null => {
    const d = poolQ.data
    if (!d || !group) return null
    return {
      uri: galleryUri,
      cid: '',
      title: d.gallery?.title ?? 'Untitled',
      description: d.gallery?.description,
      createdAt: d.gallery?.createdAt,
      creator: { did: actor, handle: d.handle, displayName: d.displayName, avatar: d.avatar },
      favCount: d.favCount ?? 0,
      commentCount: d.commentCount ?? 0,
      viewer: d.viewerFav ? { fav: d.viewerFav } : undefined,
      group: {
        did: group,
        handle: groupQ.data?.handle,
        displayName: groupQ.data?.displayName,
      },
      items: (d.items ?? []).map((item) => ({
        uri: item.uri,
        cid: item.cid,
        ...spaceBlobViews(d.space, item.did, item.cid),
        alt: item.alt,
        aspectRatio: item.aspectRatio,
      })),
    } as unknown as GalleryView
  })

  const gallery = $derived(group ? poolView : ((galleryQ.data as GalleryView) ?? null))
  /**
   * In a pool, the public-repo actions stay off — a report, an edit or a delete
   * all act on a record that is not there. Favouriting and commenting are on,
   * and go into the pool: `pool` is what routes them there.
   */
  const pooled = $derived(!!group)
  const loading = $derived(group ? poolQ.isLoading : galleryQ.isLoading)
  // Groups: the owner may offer this gallery to a group; whoever is signed in
  // as the pooling group may take it back out. Same menu the feed card has.
  const queryClient = useQueryClient()
  const isOwner = $derived(!!gallery && $viewer?.did === gallery.creator?.did)
  const actingForPool = $derived(!!gallery?.group && $viewer?.did === gallery.group.did)
  let removing = $state(false)
  // Your own gallery, out of somebody else's space. Deletes your records
  // there; the group keeps everything of its own.
  let withdrawing = $state(false)
  async function handleWithdraw() {
    if (!group || !gallery || withdrawing) return
    if (!confirm('Take this gallery out of the pool? Your photos stay yours either way.')) return
    withdrawing = true
    try {
      await withdrawFromPool(group, rkey, queryClient)
      goto(profilePath(gallery.creator))
    } catch (e) {
      alert('Could not take it out of the pool. Please try again.')
    } finally {
      withdrawing = false
    }
  }

  async function handleRemoveFromPool() {
    if (!gallery?.group || removing) return
    if (!confirm(`Remove this gallery from ${gallery.group.displayName ?? gallery.group.handle}'s pool?`)) return
    removing = true
    try {
      await removeFromPool(gallery.group.item, queryClient)
    } finally {
      removing = false
    }
  }
  const bskyUrl = $derived((gallery as any)?.crossPost?.url ?? null)
  // A pooled gallery's favorites live in the space, so nobody's public
  // favorites name it and there is no facepile to show.
  const favedByFollowing = $derived(pooled ? [] : (gallery?.favedByFollowing ?? []))

  // Same fallback chain the card uses, so a gallery reads the same place name
  // in either layout.
  const locationLabel = $derived(
    gallery?.location
      ? (gallery.locationDisplay ?? gallery.location.name ?? gallery.location.value)
      : null,
  )
  const locationHref = $derived(
    gallery?.location && locationLabel
      ? `/location/${encodeURIComponent(gallery.location.value)}?name=${encodeURIComponent(locationLabel)}`
      : null,
  )

  const photos = $derived((gallery?.items ?? []) as PhotoView[])

  // The author's other galleries, from the same feed the profile page shows,
  // so the two share a cache entry. Only the first page is wanted: this is a
  // taste of the rest of the profile, not a second copy of it.
  const MORE_COUNT = 6
  const actorFeed = createInfiniteQuery(() => actorFeedQuery(actor))
  const moreGalleries = $derived(
    ((actorFeed.data?.pages[0]?.items ?? []) as GalleryView[])
      .filter((g) => g.uri !== galleryUri)
      .slice(0, MORE_COUNT),
  )
  const creatorHandle = $derived(gallery?.creator?.handle ?? null)
  let currentIndex = $state(0)
  const currentExif = $derived(photos[currentIndex]?.exif as ExifView | undefined)
  let doFavorite: (() => void) | undefined = $state(undefined)

  let commentSheetOpen = $state(false)

  // The card carried moderation itself; the split renders the media directly,
  // so it has to resolve the same labels. Four outcomes: hide the media behind
  // a warning, blur it, badge it, or nothing.
  const labelDefs = createQuery(() => labelDefsQuery())
  const labelResult = $derived(resolveLabels(gallery?.labels, labelDefs.data ?? []))
  let revealed = $state(false)
  const mediaHidden = $derived(
    (labelResult.action === 'hide' || labelResult.action === 'warn-content') && !revealed,
  )
  // Re-hide when navigating to another gallery, so a reveal cannot carry over.
  $effect(() => {
    void galleryUri
    revealed = false
  })

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
  image="/og/profile/{actor}/gallery/{rkey}"
/>

{#if loading}
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
    <GalleryCard
      {gallery}
      privateGallery={pooled}
      pool={group ?? undefined}
      onCommentClick={() => (commentSheetOpen = true)}
    />
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
      {#if mediaHidden}
        <div class="media-hidden" style:height="{fit?.h ?? 420}px">
          <div class="warning">
            <Info size={16} />
            <span>{labelResult.name}</span>
          </div>
          <button class="warning-show" type="button" onclick={() => (revealed = true)}>
            Show
          </button>
        </div>
      {:else}
        <GalleryMedia
          {photos}
          bind:currentIndex
          bind:renderedRatio={mediaRatio}
          maxHeight={fit?.h ?? mediaMax}
          obscured={labelResult.action === 'warn-media' && !revealed}
          warnLabel={labelResult.name}
          onShow={() => (revealed = true)}
          onDoubleTap={() => doFavorite?.()}
        />
      {/if}
    </div>

    <aside class="meta">
      <div class="meta-top">
        <button class="icon-btn" type="button" onclick={back} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <div class="meta-actions">
          {#if bskyUrl}
            <a class="bsky-link" href={bskyUrl} target="_blank" rel="noopener noreferrer" title="View on Bluesky">
              <BskyIcon />
            </a>
          {/if}
          <!-- A pooled gallery gets only the pool action. GalleryMenu offers
               report, edit and delete, and all three assume a record in the
               author's public repo: deleteGallery resolves the gallery through
               grain's index, and a gallery in a space is never indexed, so it
               answers "not found" and the UI reports a failure the viewer can
               do nothing about. -->
          {#if !pooled}
            <GalleryMenu {gallery} />
          {:else if actingForPool || isOwner}
            <span class="menu-slot">
              <OverflowMenu>
                {#if actingForPool}{@render removeFromPoolItem()}{/if}
                {#if isOwner}{@render withdrawItem()}{/if}
              </OverflowMenu>
            </span>
          {/if}
        </div>
      </div>

      <!-- The location is a sibling of the author link rather than nested in
           it: both are links, and the card only gets away with nesting them
           because it silences the SSR placement check. -->
      <div class="identity">
        <a class="author" href={profilePath(gallery.creator)}>
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
            {#if gallery.group}
              <!-- svelte-ignore node_invalid_placement_ssr -->
              <a class="group-link" href="/group/{gallery.group.did}" onclick={(e) => e.stopPropagation()}>in <b>{gallery.group.displayName ?? gallery.group.handle}</b></a>
            {/if}
          </span>
        </a>
        {#if locationHref && locationLabel}
          <a class="location" href={locationHref}>
            <MapPin size={14} />
            <span>{locationLabel}</span>
          </a>
        {/if}
      </div>

      <!-- The title, caption and EXIF, one block, whether or not a comment
           thread is wrapped around them. -->
      {#snippet body()}
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
          {#if labelResult.action === 'badge'}
            <span class="label-badge"><AlertTriangle size={12} /> {labelResult.name}</span>
          {/if}
          {#if currentExif}
            <div class="exif"><ExifInfo exif={currentExif} /></div>
          {/if}
        </div>
      {/snippet}

      <div class="thread">
        <!-- The same thread either way. In a pool it is read from the members'
             own repos inside the space and written back into it, so it reaches
             exactly the people the gallery does. -->
        <CommentSheet
          open={isSplit}
          inline
          subjectUri={gallery.uri}
          pool={group ?? undefined}
          onClose={() => {}}
        >
          {#snippet before()}
            {@render body()}
          {/snippet}
          {#snippet footer()}
            <div class="actions">
              <FavoriteButton
                galleryUri={gallery.uri}
                viewerFav={gallery.viewer?.fav ?? null}
                favCount={gallery.favCount ?? 0}
                pool={group ?? undefined}
                countHref={pooled ? undefined : `/profile/${actor}/gallery/${rkey}/favorited-by`}
                bind:favorite={doFavorite}
              />
            </div>
            {#if favedByFollowing.length > 0}
              <div class="faved-by-row">
                <FavedByFollowing
                  people={favedByFollowing}
                  href="/profile/{actor}/gallery/{rkey}/favorited-by"
                />
              </div>
            {/if}
          {/snippet}
        </CommentSheet>
      </div>
    </aside>
  </div>

  {#if moreGalleries.length > 0}
    <section class="more">
      <a class="more-head" href="/profile/{actor}">
        <h2 class="more-title">
          More galleries from
          <strong>{creatorHandle ? `@${creatorHandle}` : 'this account'}</strong>
        </h2>
      </a>
      <GalleryGrid items={moreGalleries} />
    </section>
  {/if}

  <CommentSheet
    open={commentSheetOpen}
    subjectUri={gallery.uri}
    pool={group ?? undefined}
    onClose={() => { commentSheetOpen = false }}
  />
{/if}

{#snippet withdrawItem()}
  <button class="menu-item" type="button" onclick={handleWithdraw} disabled={withdrawing}>
    <CircleMinus size={15} />
    Take out of the pool
  </button>
{/snippet}

{#snippet removeFromPoolItem()}
  <button class="menu-item" type="button" onclick={handleRemoveFromPool} disabled={removing}>
    <CircleMinus size={15} />
    Remove from pool
  </button>
{/snippet}

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
    gap: 4px;
  }
  /* Back stays left; the actions sit right. */
  .meta-top > :nth-child(2) { margin-left: auto; }
  .meta-actions {
    display: flex;
    align-items: center;
    gap: 4px;
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
  .menu-slot { margin-left: auto; display: flex; }
  .menu-item {
    display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 12px;
    border: none; background: none; color: var(--text-primary); font-size: 13px; font-family: inherit;
    cursor: pointer; border-radius: 6px; transition: background 0.15s; white-space: nowrap;
  }
  .menu-item:hover { background: var(--bg-hover); }
  .group-link { font-size: 13px; color: var(--text-muted); text-decoration: none; }
  .group-link b { color: var(--grain); font-weight: 600; }
  .group-link:hover b { text-decoration: underline; }
  .bsky-link:hover { color: #0085ff; }

  .author {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    color: inherit;
    min-width: 0;
  }
  .identity { display: flex; flex-direction: column; gap: 8px; }
  .author-text { display: flex; flex-direction: column; min-width: 0; }
  .author-name { font-size: 15px; font-weight: 600; }
  .author-sub { font-size: 13px; color: var(--text-muted); }

  .location {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    font-size: 13px;
    color: var(--text-muted);
    text-decoration: none;
    transition: color 0.12s;
  }
  .location span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .location :global(svg) { flex-shrink: 0; }
  .location:hover { color: var(--grain); }

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

  /* Mirrors the card's treatment: the warning stands in for the media rather
     than sitting over it, so a hidden gallery shows nothing of the photo. */
  .media-hidden {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    width: 100%;
    padding: 16px;
    border-radius: 8px;
    background: var(--bg-elevated);
  }
  .warning {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-secondary);
    font-size: 14px;
    font-weight: 500;
  }
  .warning-show {
    background: none;
    border: none;
    padding: 0;
    color: var(--grain);
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
  }
  .warning-show:hover { text-decoration: underline; }
  .label-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 6px;
    padding: 3px 8px;
    border-radius: 999px;
    background: var(--bg-elevated);
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 600;
  }
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

  /* "Favorited by people you follow", under the favorite button it summarizes. */
  .faved-by-row {
    padding-top: 8px;
  }

  .more {
    max-width: 600px;
    margin: 0 auto;
    padding: 24px 0 32px;
  }
  .more-head {
    display: block;
    padding: 0 16px 12px;
    text-decoration: none;
    color: inherit;
  }
  .more-title {
    margin: 0;
    font-size: 14px;
    font-weight: 400;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .more-title strong { font-weight: 700; }
  .more-head:hover .more-title { text-decoration: underline; }
  @media (min-width: 900px) {
    /* The split runs the full 935px column, so the strip below it does too.
       The grid itself stays three across, the same grid as the profile. */
    .more {
      max-width: none;
      margin-top: 8px;
    }
    /* Flush with the column, in line with the photo's left edge above it. */
    .more-head { padding-inline: 0; }
  }
</style>
