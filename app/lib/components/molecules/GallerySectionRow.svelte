<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query'
  import { cameraFeedQuery, locationFeedQuery } from '$lib/queries'
  import type { GalleryView, PhotoView } from '$hatk/client'
  import Avatar from '../atoms/Avatar.svelte'
  import { ChevronRight } from 'lucide-svelte'

  type Props =
    | { kind: 'camera'; camera: string; href: string }
    | { kind: 'location'; h3: string; name: string; href: string }

  let props: Props = $props()

  let sectionEl: HTMLElement | undefined = $state()
  let visible = $state(false)

  $effect(() => {
    if (!sectionEl) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          visible = true
          io.disconnect()
        }
      },
      { rootMargin: '400px 0px' },
    )
    io.observe(sectionEl)
    return () => io.disconnect()
  })

  const feed = createQuery(() => {
    if (props.kind === 'camera') {
      return { ...cameraFeedQuery(props.camera, 8), enabled: visible }
    }
    return { ...locationFeedQuery(props.h3, props.name, 8), enabled: visible }
  })

  const galleries = $derived((feed.data?.items ?? []) as GalleryView[])

  function firstPhoto(g: GalleryView): PhotoView | undefined {
    return (g.items ?? [])[0] as PhotoView | undefined
  }
  function rkey(uri: string): string {
    return uri.split('/').pop() ?? ''
  }
</script>

<section class="section" bind:this={sectionEl}>
  <a class="section-head" href={props.href}>
    <h2 class="title">{props.kind === 'camera' ? props.camera : props.name}</h2>
    <ChevronRight size={18} />
  </a>

  <div class="rail">
    {#if !visible || feed.isPending}
      {#each Array(8) as _, i (i)}
        <div class="card skeleton"></div>
      {/each}
    {:else if galleries.length === 0}
      <div class="empty">No galleries yet</div>
    {:else}
      {#each galleries as g (g.uri)}
        {@const p = firstPhoto(g)}
        {@const author =
          g.creator?.displayName ||
          (g.creator?.handle ? `@${g.creator.handle}` : '')}
        {@const linkLabel =
          g.title || p?.alt || (author ? `Gallery by ${author}` : 'Gallery')}
        <div class="card">
          <a
            class="thumb-link"
            href="/profile/{g.creator?.did}/gallery/{rkey(g.uri)}"
            aria-label={linkLabel}
          >
            <div class="thumb">
              {#if p}
                <img src={p.thumb} alt="" loading="lazy" decoding="async" />
              {/if}
            </div>
          </a>
          <a class="author-row" href="/profile/{g.creator?.did}">
            <Avatar
              did={g.creator?.did ?? ''}
              src={g.creator?.avatar ?? null}
              name={g.creator?.displayName ?? g.creator?.handle ?? null}
              size={20}
            />
            <span class="author-name">{author}</span>
          </a>
        </div>
      {/each}
    {/if}
  </div>
</section>

<style>
  .section {
    padding: 18px 0;
    border-bottom: 1px solid var(--border);
  }
  .section-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 16px 18px;
    text-decoration: none;
    color: inherit;
  }
  .title {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: 17px;
    font-weight: 700;
    letter-spacing: -0.01em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .section-head :global(svg) {
    color: var(--text-muted);
    flex-shrink: 0;
  }
  .section-head:hover .title {
    text-decoration: underline;
  }

  .rail {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: x mandatory;
    scroll-padding-inline: 16px;
    scrollbar-width: none;
    -ms-overflow-style: none;
    -webkit-overflow-scrolling: touch;
  }
  .rail::-webkit-scrollbar {
    display: none;
  }
  .rail::before,
  .rail::after {
    content: '';
    flex: 0 0 16px;
  }

  .card {
    flex: 0 0 auto;
    width: 180px;
    scroll-snap-align: start;
  }
  .card.skeleton {
    pointer-events: none;
  }
  .card.skeleton .thumb {
    background: var(--bg-image);
    animation: pulse 1.2s ease-in-out infinite;
  }
  .card.skeleton::after {
    content: '';
    display: block;
    height: 28px;
    margin-top: 10px;
  }

  .thumb-link {
    display: block;
    text-decoration: none;
  }
  .thumb {
    position: relative;
    width: 100%;
    aspect-ratio: 3 / 4;
    overflow: hidden;
    background: var(--bg-image);
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .author-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
    min-width: 0;
    text-decoration: none;
    color: inherit;
  }
  .author-name {
    font-size: 13px;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .author-row:hover .author-name {
    text-decoration: underline;
  }

  .empty {
    padding: 40px 4px;
    color: var(--text-muted);
    font-size: 13px;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.55;
    }
  }
</style>
