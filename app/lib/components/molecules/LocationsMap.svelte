<script lang="ts">
  import { cellToLatLng, isValidCell } from 'h3-js'
  import { onMount } from 'svelte'
  import type { Map as MapLibreMap } from 'maplibre-gl'
  import { goto } from '$app/navigation'
  import { BASEMAP_URL, BASEMAP_ATTRIBUTION } from '$lib/basemap'
  // Nothing else in the app loads this: LocationMapBanner draws a canvas with
  // no markers and no interaction, which needs no stylesheet. Markers do —
  // without it they are position: static and `overflow: hidden` eats them.
  import 'maplibre-gl/dist/maplibre-gl.css'

  // The index map: every place at once, rather than LocationMapBanner's single
  // place. Interactive, because picking a place off a map is the whole point —
  // where the banner on a place's own page is decorative.
  type Place = { name: string; h3Index: string; href: string }

  let { places, height = 260 }: { places: Place[]; height?: number } = $props()

  const pins = $derived(
    places
      .filter((p) => p.h3Index && isValidCell(p.h3Index))
      .map((p) => ({ ...p, latLng: cellToLatLng(p.h3Index) })),
  )

  let container: HTMLDivElement | undefined = $state()
  let map: MapLibreMap | null = $state(null)
  let markers: { remove: () => void }[] = []

  // Places arrive from an async query and the list can change under us, so
  // markers are rebuilt from scratch rather than diffed — thirty of them.
  $effect(() => {
    const current = pins
    const instance = map
    if (!instance) return

    for (const m of markers) m.remove()
    markers = []

    if (current.length === 0) return

    import('maplibre-gl').then((maplibre) => {
      if (map !== instance) return
      for (const p of current) {
        const el = document.createElement('button')
        el.className = 'pin'
        el.type = 'button'
        el.title = p.name
        el.setAttribute('aria-label', p.name)
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          goto(p.href)
        })
        markers.push(
          new maplibre.Marker({ element: el })
            .setLngLat([p.latLng[1], p.latLng[0]])
            .addTo(instance),
        )
      }

      const bounds = new maplibre.LngLatBounds()
      for (const p of current) bounds.extend([p.latLng[1], p.latLng[0]])
      instance.fitBounds(bounds, { padding: 48, maxZoom: 9, animate: false })
    })
  })

  onMount(() => {
    if (!container) return
    let disposed = false

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

    // Same reasoning as LocationMapBanner: maplibre is far too large to sit in
    // the shared bundle for the handful of routes that draw a map.
    ;(async () => {
      const [maplibre, { Protocol }, style] = await Promise.all([
        import('maplibre-gl'),
        import('pmtiles'),
        buildStyle(),
      ])
      if (disposed || !container) return

      const protocol = new Protocol()
      maplibre.addProtocol('pmtiles', protocol.tile)

      map = new maplibre.Map({
        container,
        style,
        center: [0, 20],
        zoom: 1,
        attributionControl: false,
        // Drag and zoom, but no rotation — a tilted world map helps nobody.
        dragRotate: false,
        pitchWithRotate: false,
        touchZoomRotate: true,
      })
      map.touchZoomRotate?.disableRotation()
    })()

    return () => {
      disposed = true
      observer.disconnect()
      for (const m of markers) m.remove()
      markers = []
      map?.remove()
      map = null
    }
  })
</script>

<div class="map" style:height="{height}px">
  <div class="canvas" bind:this={container}></div>
  <!-- ODbL requires attribution wherever the basemap is shown. -->
  <a
    class="attribution"
    href="https://www.openstreetmap.org/copyright"
    target="_blank"
    rel="noreferrer">© OpenStreetMap</a
  >
</div>

<style>
  .map {
    position: relative;
    overflow: hidden;
    background: var(--bg-surface);
  }
  .canvas {
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

  /* Markers are created imperatively by maplibre, outside this component's
     scoped CSS, so the pin style has to be global. */
  :global(.pin) {
    width: 14px;
    height: 14px;
    padding: 0;
    border: 2px solid #fff;
    border-radius: 50%;
    background: var(--grain);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
    cursor: pointer;
    /* Hover must not touch `transform`: maplibre positions the marker with an
       inline transform, so animating it here would fling the pin to 0,0. */
    transition: box-shadow 0.12s, background-color 0.12s;
  }
  :global(.pin:hover),
  :global(.pin:focus-visible) {
    background: #fff;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45), 0 0 0 5px var(--grain-glow);
    outline: none;
  }
</style>
