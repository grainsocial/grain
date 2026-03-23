<script lang="ts">
  import { createQuery, useQueryClient } from '@tanstack/svelte-query'
  import { X, MapPin, Trash2 } from 'lucide-svelte'
  import { callXrpc } from '$hatk/client'
  import { storiesQuery, storyAuthorsQuery } from '$lib/queries'
  import { viewer as viewerStore } from '$lib/stores'
  import ReportButton from '$lib/components/molecules/ReportButton.svelte'

  let {
    initialDid,
    onclose,
  }: {
    initialDid: string
    onclose: () => void
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
  const stories = createQuery(() => storiesQuery(currentDid))

  const currentStory = $derived(stories.data?.[currentStoryIndex])
  const totalStories = $derived(stories.data?.length ?? 0)
  const isOwn = $derived(currentDid === $viewerStore?.did)
  let deleting = $state(false)

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
    return `${hours}h`
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
    } else if (currentAuthorIndex < authorDids.length - 1) {
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
    } else if (currentAuthorIndex > 0) {
      currentAuthorIndex--
      // currentStoryIndex reset by $effect above
    }
  }

  // NOTE: ReportButton uses e.stopPropagation() on its trigger to prevent this
  // handler from firing when opening the modal. The dialog guard below handles
  // clicks inside the modal itself, which bubble through the DOM even though
  // <dialog> renders in the top layer. Both are needed for correct behavior.
  function handleTap(e: MouseEvent) {
    if ((e.target as HTMLElement).closest('dialog')) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    if (x < rect.width / 3) {
      prev()
    } else {
      next()
    }
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
          {#if currentStory.creator.avatar}
            <img class="author-avatar" src={currentStory.creator.avatar} alt="" />
          {/if}
          <span class="author-name">
            {currentStory.creator.displayName ?? currentStory.creator.handle}
          </span>
          <span class="story-time">
            {timeAgo(currentStory.createdAt)}
          </span>
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
      <div class="story-image-wrapper">
        <img
          class="story-image"
          src={currentStory.fullsize}
          alt=""
          style="aspect-ratio: {currentStory.aspectRatio.width}/{currentStory.aspectRatio.height}"
        />
      </div>

      <!-- Location overlay -->
      {#if currentStory.location}
        <div class="story-location">
          <MapPin size={12} />
          <span>{currentStory.location.name}</span>
        </div>
      {/if}
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
  .author-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
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

  /* Location */
  .story-location {
    position: absolute;
    bottom: 24px;
    left: 12px;
    display: flex;
    align-items: center;
    gap: 4px;
    color: white;
    font-size: 13px;
    background: rgba(0, 0, 0, 0.4);
    padding: 6px 10px;
    border-radius: 16px;
    backdrop-filter: blur(4px);
  }
</style>
