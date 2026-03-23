<script lang="ts">
  import type { GalleryView, PhotoView } from '$hatk/client'
  import Skeleton from '../atoms/Skeleton.svelte'

  let {
    items,
    loading = false,
  }: {
    items: GalleryView[]
    loading?: boolean
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
  <div class="empty-state">No galleries yet.</div>
{:else}
  <div class="grid">
    {#each items as gallery (gallery.uri)}
      <a class="cell" href="/profile/{gallery.creator?.did}/gallery/{rkey(gallery.uri)}">
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
      </a>
    {/each}
  </div>
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
  .empty-state {
    padding: 48px;
    text-align: center;
    color: var(--text-secondary);
  }
</style>
