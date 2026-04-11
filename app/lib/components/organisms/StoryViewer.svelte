<script lang="ts">
  import { createQuery, useQueryClient } from '@tanstack/svelte-query'
  import { X, MapPin, Trash2, AlertTriangle, Info, Heart } from 'lucide-svelte'
  import { goto } from '$app/navigation'
  import { callXrpc } from '$hatk/client'
  import { storiesQuery, storyAuthorsQuery, storyQuery, commentThreadQuery } from '$lib/queries'
  import { viewer as viewerStore } from '$lib/stores'
  import { resolveLabels, labelDefsQuery } from '$lib/labels'
  import ReportButton from '$lib/components/molecules/ReportButton.svelte'
  import CommentSheet from '$lib/components/organisms/CommentSheet.svelte'
  import BskyIcon from '$lib/components/atoms/BskyIcon.svelte'
  import { requireAuth } from '$lib/stores'

  let {
    initialDid,
    onclose,
    singleStory,
  }: {
    initialDid: string
    onclose: () => void
    singleStory?: { uri: string } | null
  } = $props()

  const queryClient = useQueryClient()

  // Reactively read author list from cache; fall back to just the initialDid
  const storyAuthors = createQuery(() => storyAuthorsQuery())
  const authorDids = $derived.by(() => {
    const authors = storyAuthors.data
    return authors && authors.length > 0
      ? authors.map((a: any) => a.profile.did)
      : [initialDid]
  })

  // If initialDid isn't in the list, fall back to index 0 (intentionally one-time)
  // svelte-ignore state_referenced_locally
  const startIndex = Math.max(0, authorDids.indexOf(initialDid))

  let currentAuthorIndex = $state(startIndex)
  let currentStoryIndex = $state(0)
  let progress = $state(0)
  let paused = $state(false)
  let timer: ReturnType<typeof setInterval> | null = null

  const DURATION = 5000 // 5 seconds per story
  const TICK = 50

  // Track author index changes to reset story index
  let prevAuthorIndex = $state(startIndex)
  $effect(() => {
    if (currentAuthorIndex !== prevAuthorIndex) {
      prevAuthorIndex = currentAuthorIndex
      currentStoryIndex = 0
      progress = 0
    }
  })

  const currentDid = $derived(authorDids[currentAuthorIndex] ?? initialDid)
  const stories = createQuery(() => ({
    ...storiesQuery(currentDid),
    enabled: !singleStory,
  }))
  const singleStoryData = createQuery(() => ({
    ...storyQuery(singleStory?.uri ?? ''),
    enabled: !!singleStory,
  }))

  const currentStory = $derived(
    singleStory ? (singleStoryData.data ?? undefined) : stories.data?.[currentStoryIndex]
  )
  const totalStories = $derived(singleStory ? 1 : (stories.data?.length ?? 0))
  const isOwn = $derived(currentDid === $viewerStore?.did)
  const bskyUrl = $derived((currentStory as any)?.crossPost?.url ?? null)
  const isExpired = $derived(currentStory?.expired ?? false)

  let deleting = $state(false)

  // Label moderation
  const labelDefs = createQuery(() => labelDefsQuery())
  const labelResult = $derived(resolveLabels(currentStory?.labels, labelDefs.data ?? []))
  let labelRevealed = $state(false)

  // Reset revealed state when story changes
  let prevStoryUri = $state('')
  $effect(() => {
    const uri = currentStory?.uri ?? ''
    if (uri !== prevStoryUri) {
      prevStoryUri = uri
      labelRevealed = false
    }
  })


  async function deleteStory() {
    if (!currentStory || deleting) return
    if (!confirm('Delete this story?')) return
    deleting = true
    try {
      const rkey = currentStory.uri.split('/').pop()!
      const countBeforeDelete = totalStories
      await callXrpc('dev.hatk.deleteRecord', {
        collection: 'social.grain.story',
        rkey,
      })
      // If this was the last story, close or advance before refetching
      if (countBeforeDelete <= 1) {
        if (currentAuthorIndex < authorDids.length - 1) {
          currentAuthorIndex++
        } else {
          onclose()
          return
        }
      } else if (currentStoryIndex >= countBeforeDelete - 1) {
        // Was viewing the last story — step back so index stays valid
        currentStoryIndex = Math.max(0, currentStoryIndex - 1)
      }
      await queryClient.invalidateQueries({ queryKey: ['stories', currentDid] })
      queryClient.invalidateQueries({ queryKey: ['stories', 'archive'] })
      queryClient.invalidateQueries({ queryKey: ['storyAuthors'] })
    } catch (err) {
      console.error('Failed to delete story:', err)
    } finally {
      deleting = false
    }
  }

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours < 1) {
      const mins = Math.floor(diff / (1000 * 60))
      return `${mins}m`
    }
    if (hours < 24) {
      return `${hours}h`
    }
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  function startTimer() {
    stopTimer()
    progress = 0
    timer = setInterval(() => {
      if (paused) return
      progress += TICK / DURATION
      if (progress >= 1) {
        next()
      }
    }, TICK)
  }

  function stopTimer() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function next() {
    if (currentStoryIndex < totalStories - 1) {
      currentStoryIndex++
      progress = 0
    } else if (!singleStory && currentAuthorIndex < authorDids.length - 1) {
      currentAuthorIndex++
      // currentStoryIndex reset by $effect above
    } else {
      onclose()
    }
  }

  function prev() {
    if (currentStoryIndex > 0) {
      currentStoryIndex--
      progress = 0
    } else if (!singleStory && currentAuthorIndex > 0) {
      currentAuthorIndex--
      // currentStoryIndex reset by $effect above
    }
  }

  function doFavoriteOnly() {
    if (isFaved) return
    showHeartAnim = true
    setTimeout(() => (showHeartAnim = false), 800)
    toggleFav()
  }

  let lastTapTime = 0
  function handleTap(e: MouseEvent) {
    if ((e.target as HTMLElement).closest('dialog')) return
    const now = Date.now()
    if (now - lastTapTime < 300) {
      // Double tap — favorite only
      lastTapTime = 0
      doFavoriteOnly()
      return
    }
    lastTapTime = now
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const width = rect.width
    setTimeout(() => {
      if (lastTapTime === 0) return // was consumed by double tap
      if (x < width / 3) {
        prev()
      } else {
        next()
      }
    }, 300)
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose()
    if (e.key === 'ArrowRight') next()
    if (e.key === 'ArrowLeft') prev()
  }

  // Restart timer when the current story changes (including after refetch)
  $effect(() => {
    if (currentStory?.uri) startTimer()
    return () => stopTimer()
  })

  // Favorite state — keyed by story URI so it persists across author switches
  let favOverrides = $state<Record<string, string | null>>({})
  const viewerFav = $derived(currentStory?.viewer?.fav ?? null)
  const storyFavOverride = $derived(currentStory?.uri ? favOverrides[currentStory.uri] : undefined)
  const favUri = $derived(storyFavOverride !== undefined ? storyFavOverride : viewerFav)
  const isFaved = $derived(!!favUri)
  let favPending = $state(false)
  let showHeartAnim = $state(false)

  async function toggleFav() {
    if (favPending || !currentStory) return
    if (!requireAuth()) return
    const uri = currentStory.uri
    favPending = true
    try {
      if (isFaved && favUri && favUri !== 'pending') {
        // Unfavorite — capture URI before optimistic update clears it
        const deleteFavUri = favUri
        favOverrides[uri] = null
        const rkey = deleteFavUri.split('/').pop()!
        await callXrpc('dev.hatk.deleteRecord', { collection: 'social.grain.favorite', rkey })
        queryClient.invalidateQueries({ queryKey: ['stories', currentDid], refetchType: 'none' })
        queryClient.invalidateQueries({ queryKey: ['getStory'], refetchType: 'none' })
      } else if (!isFaved) {
        // Favorite
        favOverrides[uri] = 'pending'
        const res: any = await callXrpc('dev.hatk.createRecord', {
          collection: 'social.grain.favorite',
          record: { subject: uri, createdAt: new Date().toISOString() },
        })
        favOverrides[uri] = res?.uri ?? null
        queryClient.invalidateQueries({ queryKey: ['stories', currentDid], refetchType: 'none' })
        queryClient.invalidateQueries({ queryKey: ['getStory'], refetchType: 'none' })
      }
    } catch {
      delete favOverrides[uri] // rolls back to server value
    } finally {
      favPending = false
    }
  }

  // Comment sheet
  let commentSheetOpen = $state(false)
  const commentCount = $derived(currentStory?.commentCount ?? 0)
  const commentsQ = createQuery(() => ({
    ...commentThreadQuery(currentStory?.uri ?? ''),
    enabled: !!currentStory?.uri,
  }))
  const latestComment = $derived.by(() => {
    const comments = (commentsQ.data as any)?.comments
    if (!Array.isArray(comments) || comments.length === 0) return null
    return comments[comments.length - 1]
  })

  let wrapper: HTMLDivElement = $state()!

  $effect(() => {
    if (!wrapper) return
    document.body.appendChild(wrapper)
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      wrapper?.remove()
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
      stopTimer()
    }
  })
</script>

<svelte:window onkeydown={handleKeydown} />

<div bind:this={wrapper}>
<div class="story-overlay">
  <div class="story-container" onclick={handleTap} onkeydown={handleKeydown} role="button" tabindex="0">
    <!-- Progress bars -->
    <div class="progress-bars">
      {#each Array(totalStories) as _, i}
        <div class="progress-segment">
          <div
            class="progress-fill"
            style="width: {i < currentStoryIndex ? 100 : i === currentStoryIndex ? progress * 100 : 0}%"
          ></div>
        </div>
      {/each}
    </div>

    <!-- Header -->
    {#if currentStory}
      <div class="story-header">
        <div class="author-info">
          <a class="author-link" href="/profile/{currentStory.creator.did}" onclick={(e) => { e.stopPropagation(); onclose(); goto(`/profile/${currentStory.creator.did}`) }}>
            {#if currentStory.creator.avatar}
              <img class="author-avatar" src={currentStory.creator.avatar} alt="" />
            {/if}
            <div class="author-text">
              <span class="author-name-row">
                <span class="author-name">
                  {currentStory.creator.displayName ?? currentStory.creator.handle}
                </span>
                <span class="story-time">
                  {timeAgo(currentStory.createdAt)}
                </span>
              </span>
              {#if currentStory.location}
                <span class="header-location">
                  {currentStory.location.name}
                </span>
              {/if}
            </div>
          </a>
        </div>
        <div class="header-actions">
          {#if isOwn}
            <button class="close-btn" onclick={(e) => { e.stopPropagation(); deleteStory() }} disabled={deleting}>
              <Trash2 size={20} />
            </button>
          {:else}
            <ReportButton subjectUri={currentStory.uri} subjectCid={currentStory.cid} variant="overlay" onopen={() => { paused = true; stopTimer() }} onclose={() => { paused = false; startTimer() }} />
          {/if}
          <button class="close-btn" onclick={onclose}>
            <X size={24} />
          </button>
        </div>
      </div>

      <!-- Image -->
      <div class="story-image-wrapper" class:media-obscured={(labelResult.action === 'warn-media' || labelResult.action === 'warn-content' || labelResult.action === 'hide') && !labelRevealed}>
        {#if (labelResult.action === 'warn-media' || labelResult.action === 'warn-content' || labelResult.action === 'hide') && !labelRevealed}
          <div class="media-warning-bar">
            <div class="media-warning-left">
              <Info size={16} />
              <span>{labelResult.name}</span>
            </div>
            <button class="media-warning-show" onclick={(e) => { e.stopPropagation(); labelRevealed = true }}>Show</button>
          </div>
        {/if}
        <img
          class="story-image"
          src={currentStory.fullsize}
          alt=""
          style="aspect-ratio: {currentStory.aspectRatio.width}/{currentStory.aspectRatio.height}"
        />
        {#if showHeartAnim}
          <div class="heart-anim">
            <Heart size={64} fill="currentColor" />
          </div>
        {/if}
      </div>

      <!-- Bluesky cross-post link -->
      {#if bskyUrl}
        <a class="bsky-link" href={bskyUrl} target="_blank" rel="noopener noreferrer" title="View on Bluesky" onclick={(e) => e.stopPropagation()}>
          <BskyIcon size={16} />
        </a>
      {/if}

      <!-- Bottom input bar -->
      {#if !isExpired}
      <div class="story-bottom-bar" onclick={(e) => e.stopPropagation()}>
        {#if latestComment}
          <div class="latest-comment">
            {#if latestComment.author?.avatar}
              <img class="comment-avatar" src={latestComment.author.avatar} alt="" />
            {/if}
            <span class="comment-text">{latestComment.text}</span>
          </div>
        {/if}
        <div class="input-row">
          <button class="input-placeholder" onclick={() => { if (!requireAuth()) return; paused = true; stopTimer(); commentSheetOpen = true }}>
            Add a comment...
          </button>
          <button class="fav-btn" class:faved={isFaved} onclick={() => toggleFav()}>
            <Heart size={24} fill={isFaved ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>
      {/if}
    {/if}

    {#if commentSheetOpen && currentStory}
      <div class="contained-sheet-wrapper" onclick={(e) => e.stopPropagation()} role="presentation">
        <div class="contained-sheet-backdrop" onclick={() => { commentSheetOpen = false; paused = false; startTimer() }} role="button" tabindex="-1"></div>
        <CommentSheet
          open={commentSheetOpen}
          subjectUri={currentStory.uri}
          onClose={() => { commentSheetOpen = false; paused = false; startTimer() }}
          contained
        />
      </div>
    {/if}
  </div>
</div>
</div>

<style>
  .story-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: black;
    display: flex;
    align-items: center;
    justify-content: center;
    overscroll-behavior: contain;
    touch-action: none;
  }
  .story-container {
    position: relative;
    width: 100%;
    max-width: 420px;
    height: 100%;
    display: flex;
    flex-direction: column;
    outline: none;
  }

  /* Progress bars */
  .progress-bars {
    display: flex;
    gap: 3px;
    padding: 8px 8px 0;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 10;
  }
  .progress-segment {
    flex: 1;
    height: 2px;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 1px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: white;
    transition: width 50ms linear;
  }

  /* Header */
  .story-header {
    position: absolute;
    top: 16px;
    left: 0;
    right: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
  }
  .author-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .author-link {
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    color: inherit;
  }
  .author-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
  }
  .author-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .author-name-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .author-name {
    color: white;
    font-size: 14px;
    font-weight: 600;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  }
  .story-time {
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  }
  .header-location {
    display: flex;
    align-items: center;
    gap: 3px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 11px;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  }
  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .close-btn {
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    padding: 4px;
    filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.5));
  }

  /* Image */
  .heart-anim {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    color: var(--grain);
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
  .story-image-wrapper {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .story-image {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  /* Label moderation */
  .media-obscured {
    position: relative;
  }
  .media-obscured .story-image {
    visibility: hidden;
  }
  .media-obscured::before {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--bg-elevated, #1a1a1a);
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
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.15);
  }
  .media-warning-left {
    display: flex;
    align-items: center;
    gap: 8px;
    color: rgba(255, 255, 255, 0.7);
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

  /* Bluesky link */
  .bsky-link {
    position: absolute;
    bottom: 24px;
    right: 12px;
    display: flex;
    align-items: center;
    color: white;
    background: rgba(0, 0, 0, 0.4);
    padding: 6px;
    border-radius: 50%;
    backdrop-filter: blur(4px);
  }

  /* Bottom input bar */
  .story-bottom-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 14px 24px;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
  }
  .latest-comment {
    display: flex;
    align-items: center;
    gap: 8px;
    color: white;
    font-size: 14px;
    overflow: hidden;
  }
  .comment-text {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 999px;
    padding: 4px 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .comment-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }
  .comment-author {
    font-weight: 600;
    flex-shrink: 0;
  }
  .input-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .input-placeholder {
    flex: 1;
    background: none;
    border: 1.5px solid rgba(255, 255, 255, 0.35);
    border-radius: 20px;
    padding: 8px 16px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 14px;
    font-family: inherit;
    cursor: pointer;
    text-align: left;
  }
  .input-placeholder:hover {
    border-color: rgba(255, 255, 255, 0.5);
  }
  .fav-btn {
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    padding: 0;
    display: flex;
    flex-shrink: 0;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4));
    transition: color 0.15s;
  }
  .fav-btn:hover { opacity: 0.8; }
  .fav-btn.faved { color: var(--grain); }

  /* Contained comment sheet */
  .contained-sheet-wrapper {
    position: absolute;
    inset: 0;
    z-index: 20;
  }
  .contained-sheet-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
  }
</style>
