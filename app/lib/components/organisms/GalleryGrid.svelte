<script lang="ts">
  import type { GalleryView, PhotoView } from '$hatk/client'
  import Skeleton from '../atoms/Skeleton.svelte'
  import { resolveLabels, labelDefsQuery } from '$lib/labels'
  import { createQuery } from '@tanstack/svelte-query'
  import { Info } from 'lucide-svelte'

  const labelDefs = createQuery(() => labelDefsQuery())

  let {
    items,
    loading = false,
    emptyText = 'No galleries yet.',
    hasMore = false,
    loadingMore = false,
    onLoadMore,
  }: {
    items: GalleryView[]
    loading?: boolean
    emptyText?: string
    hasMore?: boolean
    loadingMore?: boolean
    onLoadMore?: () => void
  } = $props()

  function thumb(gallery: GalleryView): string | undefined {
    const photos = (gallery.items ?? []) as PhotoView[]
    return photos[0]?.thumb
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
      <a class="cell" href="/profile/{gallery.creator?.did}/gallery/{rkey(gallery.uri)}">
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
          <div class="overlay">
            <span class="overlay-title">{gallery.title}</span>
          </div>
        {/if}
      </a>
    {/each}
  </div>
  {#if hasMore}
    <div class="load-more">
      <button class="load-more-btn" onclick={() => onLoadMore?.()} disabled={loadingMore}>
        {loadingMore ? 'Loading\u2026' : 'Load more'}
      </button>
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
  .load-more { padding: 16px; text-align: center; }
  .load-more-btn {
    padding: 10px 24px;
    border-radius: 20px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    color: var(--text-secondary);
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.12s;
  }
  .load-more-btn:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  .load-more-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .empty-state {
    padding: 48px;
    text-align: center;
    color: var(--text-secondary);
  }
</style>
