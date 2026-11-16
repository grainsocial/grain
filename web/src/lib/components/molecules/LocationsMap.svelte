<script lang="ts">
  import { cellToLatLng, isValidCell } from 'h3-js'
  import { onMount } from 'svelte'
  import type { Map as MapLibreMap, GeoJSONSource, LngLatBoundsLike } from 'maplibre-gl'
  import { goto } from '$app/navigation'
  import { BASEMAP_SOURCE } from '$lib/basemap'
  // maplibre sets `touch-action: none` on the canvas container from this
  // stylesheet. Without it a touch drag scrolls the page instead of panning.
  import 'maplibre-gl/dist/maplibre-gl.css'

  // Every place at once, rather than LocationMapBanner's single place. Drawn as
  // a clustered GeoJSON source rather than Marker elements: there are ~700
  // places, and a DOM marker each means 700 nodes maplibre re-transforms on
  // every pan and zoom frame. Circles live on the GPU and cost nothing to move.
  type Place = { name: string; h3Index: string; galleryCount: number }

  let { places, height = 260 }: { places: Place[]; height?: number } = $props()

  const SOURCE = 'places'
  const CLUSTERS = 'place-clusters'
  const POINTS = 'place-points'
  const FIT = { padding: 40, maxZoom: 5 }

  const features = $derived(
    places
      .filter((p) => p.h3Index && isValidCell(p.h3Index))
      .map((p) => {
        const [lat, lng] = cellToLatLng(p.h3Index)
        return {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [lng, lat] as [number, number] },
          properties: { name: p.name, h3: p.h3Index, count: p.galleryCount },
        }
      }),
  )

  const collection = $derived({ type: 'FeatureCollection' as const, features })

  // Computed without maplibre so it is known before the library has loaded.
  // On a full page load the pins are already here — SvelteKit inlines the
  // prefetch — so the map is constructed at its final camera and the clusters
  // form exactly once. Anything else is the flash of pins splaying out at a
  // placeholder camera and then snapping into clusters a frame later.
  const bounds = $derived.by((): LngLatBoundsLike | null => {
    if (!features.length) return null
    let w = Infinity
    let s = Infinity
    let e = -Infinity
    let n = -Infinity
    for (const f of features) {
      const [lng, lat] = f.geometry.coordinates
      if (lng < w) w = lng
      if (lng > e) e = lng
      if (lat < s) s = lat
      if (lat > n) n = lat
    }
    return [
      [w, s],
      [e, n],
    ]
  })

  let container: HTMLDivElement | undefined = $state()
  let map: MapLibreMap | null = $state(null)
  let fitted = false

  function accent(): string {
    if (typeof document === 'undefined') return '#85a1ff'
    return (
      getComputedStyle(document.documentElement).getPropertyValue('--grain').trim() || '#85a1ff'
    )
  }

  /** Idempotent: also used to restore the layers a setStyle() tears down. */
  function install(m: MapLibreMap) {
    if (m.getSource(SOURCE)) return
    const color = accent()

    m.addSource(SOURCE, {
      type: 'geojson',
      data: collection,
      cluster: true,
      // Tuned against the real distribution (~700 places, concentrated in North
      // America and Europe): tight enough that a continent is several clusters
      // rather than one dot, wide enough that they do not overlap at world zoom.
      clusterRadius: 45,
      // Past this zoom the places have separated enough to stand alone.
      clusterMaxZoom: 11,
      clusterProperties: { total: ['+', ['get', 'count']] },
    })

    // No text layer anywhere here: the basemap ships without a glyphs endpoint
    // (5360554 — the tiles carry their own fonts), so a symbol layer would have
    // nothing to render with. Magnitude is carried by radius instead.
    m.addLayer({
      id: CLUSTERS,
      type: 'circle',
      source: SOURCE,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': color,
        'circle-opacity': 0.85,
        // Radius scales with zoom as well as size: a circle that reads well
        // over one city is a blot when the whole world is on screen.
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0,
          ['step', ['get', 'point_count'], 5, 5, 7, 20, 9, 60, 12],
          6,
          ['step', ['get', 'point_count'], 10, 5, 14, 20, 18, 60, 24],
        ],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#fff',
        'circle-stroke-opacity': 0.85,
      },
    })

    m.addLayer({
      id: POINTS,
      type: 'circle',
      source: SOURCE,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': color,
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0,
          ['step', ['get', 'count'], 3, 5, 4, 25, 5, 100, 6],
          6,
          ['step', ['get', 'count'], 6, 5, 8, 25, 10, 100, 12],
        ],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#fff',
        'circle-stroke-opacity': 0.85,
      },
    })
  }

  function href(name: string, h3: string): string {
    return `/location/${encodeURIComponent(h3)}?name=${encodeURIComponent(name)}`
  }

  // For pins that arrive after the map is up — a client-side navigation before
  // the query settles. Order matters: move the camera, then set the data, so
  // the cluster index is built once, at the zoom it will be shown at. setData
  // rather than a fresh source, because re-adding drops that index.
  $effect(() => {
    const data = collection
    const b = bounds
    const m = map
    if (!m) return
    const source = m.getSource(SOURCE) as GeoJSONSource | undefined
    if (!source) return
    if (!fitted && b) {
      fitted = true
      const camera = m.cameraForBounds(b, FIT)
      if (camera) m.jumpTo(camera)
    }
    source.setData(data)
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
        sources: { protomaps: BASEMAP_SOURCE },
        layers: layers('protomaps', namedTheme(theme), { lang: 'en' }),
      }
    }

    // Same reasoning as LocationMapBanner: maplibre is far too large to sit in
    // the shared bundle for the handful of routes that draw a map. No pmtiles
    // import any more: the Worker on tiles.grain.social does the directory
    // walk, so the client neither loads that library nor spends two range
    // requests on directories before the first tile.
    ;(async () => {
      const [maplibre, style] = await Promise.all([import('maplibre-gl'), buildStyle()])
      if (disposed || !container) return

      const initial = bounds
      if (initial) fitted = true

      const m = new maplibre.Map({
        container,
        style,
        // Start where the data is, when the data is already here.
        ...(initial
          ? { bounds: initial, fitBoundsOptions: FIT }
          : { center: [0, 20] as [number, number], zoom: 1 }),
        // Tiles are immutable and edge-cached: paint them the moment they land
        // rather than fading them in, and never re-request an expired one.
        fadeDuration: 0,
        refreshExpiredTiles: false,
        attributionControl: false,
        // One earth. Repeated copies triple the pins drawn and let a place
        // appear three times on the same screen.
        renderWorldCopies: false,
        // Drag and zoom, but no rotation — a tilted world map helps nobody.
        dragRotate: false,
        pitchWithRotate: false,
      })
      m.touchZoomRotate?.disableRotation()

      m.on('load', () => install(m))
      // setStyle drops everything not in the new style, so put it back.
      m.on('styledata', () => install(m))

      m.on('click', CLUSTERS, async (e) => {
        const feature = e.features?.[0]
        if (!feature) return
        const source = m.getSource(SOURCE) as GeoJSONSource
        const zoom = await source.getClusterExpansionZoom(feature.properties.cluster_id)
        m.easeTo({ center: (feature.geometry as any).coordinates, zoom })
      })

      m.on('click', POINTS, (e) => {
        const p = e.features?.[0]?.properties
        if (p) goto(href(p.name as string, p.h3 as string))
      })

      for (const layer of [CLUSTERS, POINTS]) {
        m.on('mouseenter', layer, () => (m.getCanvas().style.cursor = 'pointer'))
        m.on('mouseleave', layer, () => (m.getCanvas().style.cursor = ''))
      }

      map = m
    })()

    return () => {
      disposed = true
      observer.disconnect()
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
</style>
