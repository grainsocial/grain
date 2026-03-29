<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query'
  import type { StoryView } from '$hatk/client'
  import { storyArchiveQuery } from '$lib/queries'
  import { callXrpc } from '$hatk/client'
  import StoryViewer from '$lib/components/organisms/StoryViewer.svelte'

  let { did }: { did: string } = $props()

  const initial = createQuery(() => storyArchiveQuery(did))

  let allStories = $state<StoryView[]>([])
  let cursor = $state<string | undefined>(undefined)
  let loadingMore = $state(false)
  let hasLoadedMore = $state(false)
  let viewingStory = $state<{ uri: string } | null>(null)

  // Sync initial query data into local state (skip if user has loaded more pages)
  $effect(() => {
    const data = initial.data as { stories?: StoryView[]; cursor?: string } | undefined
    if (data?.stories && !hasLoadedMore) {
      allStories = data.stories
      cursor = data.cursor
    }
  })

  async function loadMore() {
    if (!cursor || loadingMore) return
    loadingMore = true
    try {
      const result = await callXrpc('social.grain.unspecced.getStoryArchive', { actor: did, cursor }) as { stories?: StoryView[]; cursor?: string }
      allStories = [...allStories, ...(result.stories ?? [])]
      cursor = result.cursor
      hasLoadedMore = true
    } finally {
      loadingMore = false
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }
</script>

{#if initial.isLoading}
  <div class="archive-grid">
    {#each { length: 6 } as _}
      <div class="cell placeholder"></div>
    {/each}
  </div>
{:else if allStories.length === 0}
  <div class="empty">No stories yet.</div>
{:else}
  <div class="archive-grid">
    {#each allStories as story (story.uri)}
      <button class="cell" onclick={() => (viewingStory = { uri: story.uri })}>
        <img
          src={story.thumb}
          alt=""
          decoding="async"
          loading="lazy"
          onload={(e) => (e.currentTarget as HTMLImageElement).classList.add('loaded')}
        />
        <span class="date-badge">{formatDate(story.createdAt)}</span>
      </button>
    {/each}
  </div>

  {#if cursor}
    <div class="load-more">
      <button class="load-more-btn" onclick={loadMore} disabled={loadingMore}>
        {loadingMore ? 'Loading\u2026' : 'Load more'}
      </button>
    </div>
  {/if}
{/if}

{#if viewingStory}
  <StoryViewer initialDid={did} singleStory={viewingStory} onclose={() => (viewingStory = null)} />
{/if}

<style>
  .archive-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2px;
  }
  .cell {
    display: block;
    aspect-ratio: 3 / 4;
    background: var(--bg-elevated);
    position: relative;
    overflow: hidden;
    border: none;
    padding: 0;
    cursor: pointer;
  }
  .cell img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  .cell img:global(.loaded) {
    opacity: 1;
  }
  .placeholder {
    animation: pulse 1.5s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.7; }
  }
  .date-badge {
    position: absolute;
    bottom: 6px;
    left: 6px;
    font-size: 11px;
    font-weight: 600;
    color: #fff;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
  }
  .load-more {
    display: flex;
    justify-content: center;
    padding: 16px;
  }
  .load-more-btn {
    background: none;
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 8px 24px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    cursor: pointer;
    font-family: inherit;
  }
  .load-more-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  .load-more-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .empty {
    padding: 32px;
    text-align: center;
    color: var(--text-muted);
    font-size: 14px;
  }
</style>
