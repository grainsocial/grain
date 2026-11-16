<script lang="ts">
  // One entry in a browse index — a camera, a place. The mosaic is a sample of
  // what is behind the link rather than a feed in its own right: the tile is
  // for choosing, and the page it opens is for looking.
  let {
    href,
    title,
    meta,
    thumbs = [],
  }: { href: string; title: string; meta?: string; thumbs?: string[] } = $props()

  // Four fills the 2x2; fewer rearrange rather than leaving holes (see CSS).
  const shown = $derived(thumbs.slice(0, 4))
</script>

<a class="tile" {href}>
  <div class="mosaic" data-count={shown.length}>
    {#each shown as src, i (src + i)}
      <img
        {src}
        alt=""
        decoding="async"
        loading="lazy"
        onload={(e) => (e.currentTarget as HTMLImageElement).classList.add('loaded')}
      />
    {/each}
  </div>
  <div class="label">
    <span class="name">{title}</span>
    {#if meta}<span class="meta">{meta}</span>{/if}
  </div>
</a>

<style>
  .tile {
    position: relative;
    display: block;
    aspect-ratio: 1 / 1;
    overflow: hidden;
    background: var(--bg-image);
    text-decoration: none;
    color: inherit;
  }

  .mosaic {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    /* No internal gutter. The grid between tiles uses 2px, and matching it
       here made two adjacent tiles read as one strip of four columns. */
    gap: 0;
    width: 100%;
    height: 100%;
  }
  .mosaic img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    background: var(--bg-image);
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  .mosaic img:global(.loaded) {
    opacity: 1;
  }

  /* A place with one gallery should not read as a broken 2x2. Under four
     photos the cells stretch to fill instead of leaving gaps. */
  .mosaic[data-count='1'] img {
    grid-column: span 2;
    grid-row: span 2;
  }
  /* Two splits across, not down: a pair of full-width bands still reads as
     one tile, where two tall slivers read as two. */
  .mosaic[data-count='2'] img {
    grid-column: span 2;
  }
  .mosaic[data-count='3'] img:first-child {
    grid-row: span 2;
  }

  /* The name has to survive whatever photo is behind it, so the scrim is part
     of the tile rather than a hover affordance like GalleryGrid's. */
  .label {
    position: absolute;
    inset: auto 0 0 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 34px 12px 11px;
    /* Deep and tall on purpose: a lot of what gets posted here is high-key
       film, and a shallow scrim left white-on-white labels unreadable. */
    background: linear-gradient(
      to top,
      rgba(0, 0, 0, 0.85) 0%,
      rgba(0, 0, 0, 0.55) 45%,
      rgba(0, 0, 0, 0) 100%
    );
    pointer-events: none;
  }
  .name {
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: #fff;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.72);
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  }

  .tile:hover .mosaic {
    opacity: 0.88;
    transition: opacity 0.15s;
  }
</style>
