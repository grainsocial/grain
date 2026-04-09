<script lang="ts">
  import { GripVertical } from 'lucide-svelte'
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import PinButton from '$lib/components/atoms/PinButton.svelte'
  import { pinnedFeeds, DEFAULT_PINNED, feedIcon, reorderFeeds } from '$lib/preferences'
  import { isAuthenticated } from '$lib/stores'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'

  const coreIds = new Set(DEFAULT_PINNED.map((f) => f.id))
  const customFeeds = $derived($pinnedFeeds.filter((f) => !coreIds.has(f.id)))
  const pinnedIds = $derived(new Set($pinnedFeeds.map((f) => f.id)))
  const unpinnedDefaults = $derived(DEFAULT_PINNED.filter((f) => !pinnedIds.has(f.id)))

  // Drag state
  let dragIndex: number | null = $state(null)
  let overIndex: number | null = $state(null)

  function handleDragStart(e: DragEvent, index: number) {
    dragIndex = index
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', String(index))
    }
  }

  function handleDragOver(e: DragEvent, index: number) {
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
    overIndex = index
  }

  function handleDrop(e: DragEvent, index: number) {
    e.preventDefault()
    if (dragIndex !== null && dragIndex !== index) {
      const feeds = [...$pinnedFeeds]
      const [moved] = feeds.splice(dragIndex, 1)
      feeds.splice(index, 0, moved)
      reorderFeeds(feeds)
    }
    dragIndex = null
    overIndex = null
  }

  function handleDragEnd() {
    dragIndex = null
    overIndex = null
  }

  // Touch reorder
  let touchIndex: number | null = $state(null)
  let touchY = $state(0)
  let touchStartY = $state(0)
  let rowHeight = $state(0)
  let listEl: HTMLDivElement | undefined = $state(undefined)

  function handleTouchStart(e: TouchEvent, index: number) {
    const touch = e.touches[0]
    if (!touch) return
    touchIndex = index
    touchStartY = touch.clientY
    touchY = touch.clientY
    const row = (e.currentTarget as HTMLElement).closest('.feed-row') as HTMLElement | null
    if (row) rowHeight = row.offsetHeight
  }

  function handleTouchMove(e: TouchEvent) {
    if (touchIndex === null) return
    e.preventDefault()
    const touch = e.touches[0]
    if (!touch) return
    touchY = touch.clientY
    const delta = touchY - touchStartY
    const indexShift = Math.round(delta / rowHeight)
    const newIndex = Math.max(0, Math.min($pinnedFeeds.length - 1, touchIndex + indexShift))
    overIndex = newIndex
  }

  function handleTouchEnd() {
    if (touchIndex !== null && overIndex !== null && touchIndex !== overIndex) {
      const feeds = [...$pinnedFeeds]
      const [moved] = feeds.splice(touchIndex, 1)
      feeds.splice(overIndex, 0, moved)
      reorderFeeds(feeds)
    }
    touchIndex = null
    overIndex = null
  }
</script>

<OGMeta title="My Feeds - grain" />
<DetailHeader label="My Feeds" />

<div class="feeds-page" bind:this={listEl}>
  {#each $pinnedFeeds as feed, i (feed.id)}
    {@const Icon = feedIcon(feed)}
    <a
      href={feed.path}
      class="feed-row"
      class:dragging={dragIndex === i || touchIndex === i}
      class:drag-over={overIndex === i && dragIndex !== i && touchIndex !== i}
      draggable={$isAuthenticated}
      ondragstart={(e) => handleDragStart(e, i)}
      ondragover={(e) => handleDragOver(e, i)}
      ondrop={(e) => handleDrop(e, i)}
      ondragend={handleDragEnd}
    >
      <span class="feed-icon">
        <Icon size={18} />
      </span>
      <span class="feed-label">{feed.label}</span>
      {#if $isAuthenticated}
        <PinButton {feed} stopPropagation />
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <span
          class="drag-handle"
          onclick={(e) => { e.preventDefault(); e.stopPropagation() }}
          ontouchstart={(e) => handleTouchStart(e, i)}
          ontouchmove={(e) => handleTouchMove(e)}
          ontouchend={handleTouchEnd}
        >
          <GripVertical size={18} />
        </span>
      {/if}
    </a>
  {/each}

  {#if customFeeds.length > 0}
    <div class="section-label">Pinned</div>
    {#each customFeeds as feed (feed.id)}
      {@const Icon = feedIcon(feed)}
      <a href={feed.path} class="feed-row">
        <span class="feed-icon">
          <Icon size={18} />
        </span>
        <span class="feed-label">{feed.label}</span>
        {#if $isAuthenticated}
          <PinButton {feed} stopPropagation />
        {/if}
      </a>
    {/each}
  {/if}

  {#if unpinnedDefaults.length > 0 && $isAuthenticated}
    <div class="section-label">Feeds</div>
    {#each unpinnedDefaults as feed (feed.id)}
      {@const Icon = feedIcon(feed)}
      <a href={feed.path} class="feed-row">
        <span class="feed-icon">
          <Icon size={18} />
        </span>
        <span class="feed-label">{feed.label}</span>
        <PinButton {feed} stopPropagation />
      </a>
    {/each}
  {/if}
</div>

<style>
  .feeds-page {
    display: flex;
    flex-direction: column;
  }
  .feed-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
    text-decoration: none;
    color: var(--text-primary);
    transition: background 0.12s, opacity 0.12s;
  }
  .feed-row:hover {
    background: var(--bg-hover);
  }
  .feed-row.dragging {
    opacity: 0.4;
  }
  .feed-row.drag-over {
    border-top: 2px solid var(--grain);
  }
  .feed-icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: var(--bg-elevated);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--grain);
    flex-shrink: 0;
  }
  .feed-label {
    font-size: 15px;
    font-weight: 500;
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
  .drag-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    color: var(--text-muted);
    cursor: grab;
    touch-action: none;
    flex-shrink: 0;
  }
  .drag-handle:active {
    cursor: grabbing;
  }
  .section-label {
    padding: 12px 16px 4px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
</style>
