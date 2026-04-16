<script lang="ts">
  import type { GalleryView, PhotoView } from '$hatk/client'
  import Skeleton from '../atoms/Skeleton.svelte'
  import Spinner from '../atoms/Spinner.svelte'
  import { resolveLabels, labelDefsQuery } from '$lib/labels'
  import { createQuery } from '@tanstack/svelte-query'
  import { Info } from 'lucide-svelte'
  import SelectCheck from '../atoms/SelectCheck.svelte'
  import { infiniteScroll } from '$lib/actions/infinite-scroll'

  const labelDefs = createQuery(() => labelDefsQuery())

  let {
    items,
    loading = false,
    emptyText = 'No galleries yet.',
    hasMore = false,
    loadingMore = false,
    onLoadMore,
    selectMode = false,
    selectedUris = new Set<string>(),
    onToggle,
  }: {
    items: GalleryView[]
    loading?: boolean
    emptyText?: string
    hasMore?: boolean
    loadingMore?: boolean
    onLoadMore?: () => void
    selectMode?: boolean
    selectedUris?: Set<string>
    onToggle?: (uri: string) => void
  } = $props()

  function thumb(gallery: GalleryView): string | undefined {
    const photos = (gallery.items ?? []) as PhotoView[]
    return photos[0]?.thumb
  }

  function photoCount(gallery: GalleryView): number {
    return ((gallery.items ?? []) as PhotoView[]).length
  }

  function rkey(uri: string): string {
    return uri.split('/').pop() ?? ''
  }
</script>

{#if loading}
  <div class="grid">
    {#each {length: 9} as _}
      <div class="cell"><Skeleton width="100%" height="100%" radius="0" /></div>
    {/each}
  </div>
{:else if items.length === 0}
  <div class="empty-state">{emptyText}</div>
{:else}
  <div class="grid">
    {#each items as gallery, i (`${gallery.uri}:${i}`)}
      {@const lr = resolveLabels(gallery.labels, labelDefs.data ?? [])}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <a
        class="cell"
        href={selectMode ? undefined : `/profile/${gallery.creator?.did}/gallery/${rkey(gallery.uri)}`}
        role={selectMode ? 'button' : undefined}
        tabindex={selectMode ? 0 : undefined}
        onclick={selectMode ? (e) => { e.preventDefault(); onToggle?.(gallery.uri) } : undefined}
      >
        {#if lr.action === 'warn-media' || lr.action === 'warn-content' || lr.action === 'hide'}
          <div class="label-cover">
            <Info size={14} />
            <span>{lr.name}</span>
          </div>
        {:else}
          {#if thumb(gallery)}
            <img
              src={thumb(gallery)}
              alt={gallery.title ?? ''}
              decoding="async"
              loading="lazy"
              onload={(e) => (e.currentTarget as HTMLImageElement).classList.add('loaded')}
            />
          {/if}
          {#if photoCount(gallery) > 1}
            <div class="multi-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path transform="matrix(0.807,0,0,0.807,-0.41,18.81)" d="M18.43-20.72L6.67-20.72C4.22-20.72 2.99-19.50 2.99-17.09L2.99-5.24C2.99-2.82 4.22-1.61 6.67-1.61L18.43-1.61C20.88-1.61 22.10-2.81 22.10-5.24L22.10-17.09C22.10-19.51 20.88-20.72 18.43-20.72ZM27.79-11.67C27.79-14.09 26.57-15.29 24.12-15.29L23.71-15.29L23.71-5.24C23.71-1.92 21.76 0 18.43 0L8.67 0L8.67 0.19C8.67 2.60 9.90 3.82 12.35 3.82L24.12 3.82C26.57 3.82 27.79 2.61 27.79 0.19Z" />
              </svg>
            </div>
          {/if}
          <div class="overlay">
            <span class="overlay-title">{gallery.title}</span>
          </div>
        {/if}
        {#if selectMode}
          <div class="select-check">
            <SelectCheck checked={selectedUris.has(gallery.uri)} onMedia />
          </div>
        {/if}
      </a>
    {/each}
  </div>
  {#if hasMore}
    <div use:infiniteScroll={() => { if (!loadingMore) onLoadMore?.() }} class="sentinel">
      {#if loadingMore}<Spinner />{/if}
    </div>
  {/if}
{/if}

<style>
  .grid {
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
  .multi-icon {
    position: absolute;
    top: 6px;
    right: 6px;
    color: #fff;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
    z-index: 1;
  }
  .overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%);
    display: flex;
    align-items: flex-end;
    padding: 8px;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .cell:hover .overlay {
    opacity: 1;
  }
  .overlay-title {
    font-size: 12px;
    font-weight: 600;
    color: #fff;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    width: 100%;
  }
  .label-cover {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    height: 100%;
    color: var(--text-secondary);
    font-size: 11px;
    font-weight: 500;
  }
  .select-check {
    position: absolute;
    top: 6px;
    left: 6px;
    z-index: 2;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
  }
  .sentinel {
    display: flex;
    justify-content: center;
    padding: 20px;
  }
  .empty-state {
    padding: 48px;
    text-align: center;
    color: var(--text-secondary);
  }
</style>
