<script lang="ts">
  import { createInfiniteQuery } from '@tanstack/svelte-query'
  import { storyArchiveQuery } from '$lib/queries'
  import Spinner from '$lib/components/atoms/Spinner.svelte'
  import StoryViewer from '$lib/components/organisms/StoryViewer.svelte'
  import { infiniteScroll } from '$lib/actions/infinite-scroll'

  let { did }: { did: string } = $props()

  const archive = createInfiniteQuery(() => storyArchiveQuery(did))
  const allStories = $derived(archive.data?.pages.flatMap((p) => p.stories ?? []) ?? [])

  let viewingStory = $state<{ uri: string } | null>(null)

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }
</script>

{#if archive.isLoading}
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

  {#if archive.hasNextPage}
    <div use:infiniteScroll={() => archive.fetchNextPage()} class="sentinel">
      {#if archive.isFetchingNextPage}<Spinner />{/if}
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
  .sentinel {
    display: flex;
    justify-content: center;
    padding: 20px;
  }
  .empty {
    padding: 32px;
    text-align: center;
    color: var(--text-muted);
    font-size: 14px;
  }
</style>
