<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query'
  import GalleryGrid from '$lib/components/organisms/GalleryGrid.svelte'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'
  import { camerasQuery, locationsQuery, recentFeedQuery } from '$lib/queries'

  // How many chips before deferring to the full index pages.
  const CHIP_LIMIT = 10

  const cameras = createQuery(() => camerasQuery())
  const locations = createQuery(() => locationsQuery())
  const feed = createQuery(() => recentFeedQuery())

  const cameraChips = $derived((cameras.data ?? []).slice(0, CHIP_LIMIT))
  const locationChips = $derived((locations.data ?? []).slice(0, CHIP_LIMIT))
  const items = $derived(feed.data?.items ?? [])
</script>

<OGMeta title="Explore — grain" description="Browse grain by camera and place." />

<div class="explore">
  <h1 class="title">Explore</h1>

  <section class="chip-group">
    <h2 class="chip-label">Cameras</h2>
    <div class="chips">
      {#each cameraChips as c (c.camera)}
        <a class="chip" href="/camera/{encodeURIComponent(c.camera)}">{c.camera}</a>
      {/each}
      {#if (cameras.data ?? []).length > CHIP_LIMIT}
        <a class="chip see-all" href="/cameras">See all →</a>
      {/if}
    </div>
  </section>

  <section class="chip-group">
    <h2 class="chip-label">Locations</h2>
    <div class="chips">
      {#each locationChips as loc (loc.name)}
        <a
          class="chip"
          href="/location/{encodeURIComponent(loc.h3Index)}?name={encodeURIComponent(loc.name)}"
        >
          {loc.name}
        </a>
      {/each}
      {#if (locations.data ?? []).length > CHIP_LIMIT}
        <a class="chip see-all" href="/locations">See all →</a>
      {/if}
    </div>
  </section>

  <GalleryGrid {items} loading={feed.isLoading} emptyText="Nothing to explore yet." />
</div>

<style>
  /* No horizontal padding here: the grid runs edge to edge, so the inset
     belongs to the text above it rather than to the page. Matches /location. */
  .explore {
    padding: 8px 0 32px;
  }
  .title,
  .chip-group {
    padding-inline: 16px;
  }
  .title {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 26px;
    letter-spacing: -0.01em;
    margin: 18px 0 4px;
  }
  .chip-group {
    margin-top: 18px;
  }
  /* GalleryGrid owns its own markup, so reach in for the one bit of spacing
     that belongs to this page's rhythm rather than to the grid. */
  .explore :global(.grid) {
    margin-top: 24px;
  }
  .chip-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-faint);
    margin: 0 0 8px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 14px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    text-decoration: none;
    background: var(--bg-surface);
    transition: color 0.12s, background 0.12s;
  }
  .chip:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
  }
  .see-all {
    color: var(--grain);
    background: none;
  }
  .see-all:hover {
    color: var(--grain);
    background: var(--grain-glow);
  }
</style>
