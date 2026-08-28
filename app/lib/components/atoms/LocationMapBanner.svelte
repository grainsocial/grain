<script lang="ts">
  import { cellToLatLng, isValidCell } from 'h3-js'
  import { onMount } from 'svelte'
  import type { Map as MapLibreMap } from 'maplibre-gl'
  import { BASEMAP_URL, BASEMAP_ATTRIBUTION } from '$lib/basemap'

  let {
    h3Index,
    h3Cells,
    height = 120,
  }: { h3Index: string; h3Cells?: string[]; height?: number } = $props()

  // If multiple cells are provided, compute the center and a zoom level that
  // fits the bounding box of their centroids. Falls back to the single-cell
  // rendering when only h3Index is given.
  const cells = $derived(
    (h3Cells?.length ? h3Cells : [h3Index]).filter((c) => c && isValidCell(c)),
  )
  const valid = $derived(cells.length > 0)

  const points = $derived(cells.map((c) => cellToLatLng(c)))
  const lat = $derived(valid ? points.reduce((s, [la]) => s + la, 0) / points.length : 0)
  const lng = $derived(valid ? points.reduce((s, [, lo]) => s + lo, 0) / points.length : 0)

  // Pick a zoom that keeps the bbox within ~3 tiles wide.
  const zoom = $derived.by(() => {
    if (points.length < 2) return 11
    const lats = points.map((p) => p[0])
    const lngs = points.map((p) => p[1])
    const latSpan = Math.max(...lats) - Math.min(...lats)
    const lngSpan = Math.max(...lngs) - Math.min(...lngs)
    const maxSpan = Math.max(latSpan, lngSpan)
    // empirically: each zoom step halves the span shown in three tiles
    if (maxSpan > 8) return 5
    if (maxSpan > 4) return 6
    if (maxSpan > 2) return 7
    if (maxSpan > 1) return 8
    if (maxSpan > 0.5) return 9
    if (maxSpan > 0.2) return 10
    return 11
  })

  let container: HTMLDivElement | undefined = $state()
  let map: MapLibreMap | null = $state(null)

  // h3Cells arrives from an async query, so the centre and zoom change after
  // mount. Follow them rather than capturing whatever they happened to be when
  // the map finished loading.
  $effect(() => {
    if (!map || !valid) return
    map.jumpTo({ center: [lng, lat], zoom })
  })

  onMount(() => {
    if (!valid || !container) return

    let disposed = false

    // `data-theme` on <html> is the source of truth for the active theme (see
    // lib/theme.ts) — map layers cannot read CSS variables, so watch it.
    const resolveTheme = (): 'light' | 'dark' =>
      document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
    let theme = resolveTheme()

    const observer = new MutationObserver(() => {
      const next = resolveTheme()
      if (next === theme) return
      theme = next
      buildStyle().then((s) => map?.setStyle(s))
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })

    async function buildStyle() {
      const { layers, namedTheme } = await import('protomaps-themes-base')
      return {
        version: 8 as const,
        // `lang` is what produces the label layers at all — without it
        // `layers()` returns geometry only. No glyphs endpoint is needed:
        // this basemap carries its fonts in the tiles (verified by removing
        // it and watching labels still draw, with zero font requests).
        sources: {
          protomaps: {
            type: 'vector' as const,
            url: `pmtiles://${BASEMAP_URL}`,
            attribution: BASEMAP_ATTRIBUTION,
          },
        },
        layers: layers('protomaps', namedTheme(theme), { lang: 'en' }),
      }
    }

    // Loaded on demand: this is the only route with a map, and maplibre is far
    // too large to sit in the shared bundle for a decorative strip.
    ;(async () => {
      const [maplibre, { Protocol }, style] = await Promise.all([
        import('maplibre-gl'),
        import('pmtiles'),
        buildStyle(),
      ])
      if (disposed || !container) return

      const protocol = new Protocol()
      maplibre.addProtocol('pmtiles', protocol.tile)

      const instance = new maplibre.Map({
        container,
        style,
        center: [lng, lat],
        zoom,
        // Decorative: no panning, zooming, keyboard focus or controls.
        interactive: false,
        attributionControl: false,
      })
      map = instance
    })()

    return () => {
      disposed = true
      observer.disconnect()
      map?.remove()
      map = null
    }
  })
</script>

{#if valid}
  <div class="map-banner" style:height="{height}px">
    <div class="map-canvas" bind:this={container} aria-hidden="true"></div>
    <!-- ODbL requires attribution wherever the basemap is shown. Rendered
         outside the map so it survives the decorative aria-hidden. -->
    <a
      class="attribution"
      href="https://www.openstreetmap.org/copyright"
      target="_blank"
      rel="noreferrer">© OpenStreetMap</a
    >
  </div>
{/if}

<style>
  .map-banner {
    position: relative;
    overflow: hidden;
    background: var(--bg-surface);
  }
  .map-canvas {
    position: absolute;
    inset: 0;
  }
  .attribution {
    position: absolute;
    right: 6px;
    bottom: 4px;
    z-index: 1;
    font-size: 10px;
    line-height: 1;
    padding: 3px 6px;
    border-radius: 4px;
    color: var(--text-muted);
    background: var(--bg-blur);
    text-decoration: none;
  }
  .attribution:hover {
    color: var(--text-primary);
  }
</style>
