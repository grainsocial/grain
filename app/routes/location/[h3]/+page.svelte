<script lang="ts">
  import GalleryGrid from '$lib/components/organisms/GalleryGrid.svelte'
  import PinButton from '$lib/components/atoms/PinButton.svelte'
  import LocationMapBanner from '$lib/components/atoms/LocationMapBanner.svelte'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'
  import { BASEMAP_ORIGIN } from '$lib/basemap'
  import { ArrowLeft } from 'lucide-svelte'
  import { createInfiniteQuery, createQuery } from '@tanstack/svelte-query'
  import { locationFeedInfiniteQuery, locationsQuery } from '$lib/queries'
  import { isAuthenticated } from '$lib/stores'
  import { goto } from '$app/navigation'

  let { data } = $props()

  const h3Index = $derived(data.h3Index)
  const name = $derived(data.name)
  const nameParam = $derived(data.nameParam)

  const feed = createInfiniteQuery(() => locationFeedInfiniteQuery(h3Index, nameParam ?? undefined))
  const items = $derived(feed.data?.pages.flatMap((p) => p.items ?? []) ?? [])

  const locations = createQuery(() => locationsQuery())
  const h3Cells = $derived(
    nameParam
      ? locations.data?.find((l) => l.name === nameParam)?.h3Cells
      : undefined,
  )

  function back() {
    if (window.history.length > 1) history.back()
    else goto('/')
  }
</script>

<OGMeta title="{name} - grain" />
<svelte:head>
  <!-- The tile host is a different origin; warm DNS and TLS while the map
       chunk is still downloading rather than after it asks for a tile. -->
  <link rel="preconnect" href={BASEMAP_ORIGIN} crossorigin="anonymous" />
</svelte:head>

<div class="place">
  <header class="hero">
    <LocationMapBanner {h3Index} {h3Cells} height={260} />
    <!-- Fades the map into the page rather than ending it on a hard edge, and
         gives the title something to sit on in either theme. -->
    <div class="scrim"></div>

    <button class="hero-back" type="button" onclick={back} aria-label="Back">
      <ArrowLeft size={20} />
    </button>

    {#if $isAuthenticated}
      <div class="hero-pin">
        <PinButton
          feed={{
            id: `location:${h3Index}`,
            label: name,
            type: 'location',
            path: `/location/${encodeURIComponent(h3Index)}?name=${encodeURIComponent(name)}`,
          }}
        />
      </div>
    {/if}

    <div class="hero-foot">
      <h1>{name}</h1>
    </div>
  </header>

  <GalleryGrid
    {items}
    loading={feed.isLoading}
    emptyText="No galleries here yet."
    hasMore={feed.hasNextPage}
    loadingMore={feed.isFetchingNextPage}
    onLoadMore={() => feed.fetchNextPage()}
  />
</div>

<style>
  .place {
    padding: 0 0 32px;
  }
  /* Breathing room between the hero and the first row of photos. */
  .place :global(.grid) {
    margin-top: 14px;
  }
  .hero {
    position: relative;
    isolation: isolate;
  }
  .scrim {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0.25) 0%,
      transparent 35%,
      var(--bg-root) 100%
    );
  }
  .hero-back {
    position: absolute;
    top: 12px;
    left: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border: none;
    border-radius: 50%;
    background: var(--bg-blur);
    backdrop-filter: blur(8px);
    color: var(--text-primary);
    cursor: pointer;
  }
  .hero-pin {
    position: absolute;
    top: 12px;
    right: 12px;
  }
  .hero-foot {
    position: absolute;
    left: 16px;
    right: 130px;
    bottom: 22px;
  }
  h1 {
    font-family: var(--font-display);
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.015em;
    line-height: 1.15;
    margin: 0;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  @media (max-width: 600px) {
    h1 { font-size: 22px; }
    .hero-foot { right: 16px; bottom: 30px; }
  }
</style>
