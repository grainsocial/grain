<script lang="ts">
  import BrowseTile from '$lib/components/molecules/BrowseTile.svelte'
  import LocationsMap from '$lib/components/molecules/LocationsMap.svelte'
  import Skeleton from '$lib/components/atoms/Skeleton.svelte'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'
  import { BASEMAP_ORIGIN } from '$lib/basemap'
  import { ArrowLeft } from 'lucide-svelte'
  import { createQuery } from '@tanstack/svelte-query'
  import { locationsQuery, locationPinsQuery } from '$lib/queries'
  import { goto } from '$app/navigation'

  const locations = createQuery(() => locationsQuery())
  // The map plots every place; the tiles below stay on the ranked top thirty,
  // which are the only ones that carry thumbnails.
  const pins = createQuery(() => locationPinsQuery())

  const fmt = new Intl.NumberFormat('en')
  const galleries = (n: number) => `${fmt.format(n)} ${n === 1 ? 'gallery' : 'galleries'}`

  function href(loc: { h3Index: string; name: string }): string {
    return `/location/${encodeURIComponent(loc.h3Index)}?name=${encodeURIComponent(loc.name)}`
  }

  const places = $derived(pins.data ?? [])

  function back() {
    if (window.history.length > 1) history.back()
    else goto('/')
  }
</script>

<OGMeta title="Locations - grain" />
<svelte:head>
  <!-- The tile host is a different origin; warm DNS and TLS while the map
       chunk is still downloading rather than after it asks for a tile. -->
  <link rel="preconnect" href={BASEMAP_ORIGIN} crossorigin="anonymous" />
</svelte:head>

<div class="places">
  <!-- Places are spatial; a stacked list of names is the wrong shape for them.
       The map is the index, and the tiles below are the same list for anyone
       who would rather read it. Framed like a single place's own hero. -->
  <header class="hero">
    <LocationsMap {places} height={260} />
    <!-- Fades the map into the page rather than ending it on a hard edge, and
         gives the title something to sit on in either theme. -->
    <div class="scrim"></div>

    <button class="hero-back" type="button" onclick={back} aria-label="Back">
      <ArrowLeft size={20} />
    </button>

    <div class="hero-foot">
      <h1>Locations</h1>
    </div>
  </header>

  <div class="grid">
    {#if locations.isLoading}
      {#each { length: 9 } as _, i (i)}
        <div class="cell"><Skeleton width="100%" height="100%" radius="0" /></div>
      {/each}
    {:else if !locations.data?.length}
      <div class="state">No locations yet.</div>
    {:else}
      <!-- Unkeyed on purpose — see getLocations: two rows can legitimately share
           an h3Index, and a keyed each on it threw each_key_duplicate. -->
      {#each locations.data as loc}
        <BrowseTile
          href={href(loc)}
          title={loc.name}
          meta={galleries(loc.galleryCount)}
          thumbs={loc.thumbs ?? []}
        />
      {/each}
    {/if}
  </div>
</div>

<style>
  .places {
    padding: 0 0 32px;
  }
  .hero {
    position: relative;
    isolation: isolate;
  }
  /* Unlike a single place's hero, this map is interactive — the scrim and the
     title must not swallow drags, or the pins under them stop working. */
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
  .hero-foot {
    position: absolute;
    left: 16px;
    right: 16px;
    bottom: 22px;
    pointer-events: none;
  }
  h1 {
    font-family: var(--font-display);
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.015em;
    line-height: 1.15;
    margin: 0;
    overflow-wrap: anywhere;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2px;
    margin-top: 14px;
    padding-bottom: 32px;
  }
  .cell {
    aspect-ratio: 1 / 1;
    background: var(--bg-image);
  }
  .state {
    grid-column: 1 / -1;
    padding: 48px 16px;
    text-align: center;
    color: var(--text-muted);
  }

  @media (max-width: 600px) {
    h1 {
      font-size: 22px;
    }
    .hero-foot {
      bottom: 30px;
    }
    /* Two up on a phone: a third column leaves no room for the name. */
    .grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
