<script lang="ts">
  import { cellToLatLng, isValidCell } from 'h3-js'
  import { onMount } from 'svelte'
  import type { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl'
  import { goto } from '$app/navigation'
  import { BASEMAP_URL, BASEMAP_ATTRIBUTION } from '$lib/basemap'
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

  const features = $derived(
    places
      .filter((p) => p.h3Index && isValidCell(p.h3Index))
      .map((p) => {
        const [lat, lng] = cellToLatLng(p.h3Index)
        return {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [lng, lat] },
          properties: { name: p.name, h3: p.h3Index, count: p.galleryCount },
        }
      }),
  )

  const collection = $derived({ type: 'FeatureCollection' as const, features })

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

  // setData rather than a fresh source: the query can resolve after the map is
  // up, and re-adding a source drops the cluster index and repaints everything.
  $effect(() => {
    const data = collection
    const m = map
    if (!m) return
    const source = m.getSource(SOURCE) as GeoJSONSource | undefined
    if (!source) return
    source.setData(data)
    if (!fitted && data.features.length) {
      fitted = true
      fitTo(m, data.features)
    }
  })

  async function fitTo(m: MapLibreMap, feats: typeof features) {
    const { LngLatBounds } = await import('maplibre-gl')
    const bounds = new LngLatBounds()
    for (const f of feats) bounds.extend(f.geometry.coordinates as [number, number])
    m.fitBounds(bounds, { padding: 40, maxZoom: 5, animate: false })
  }

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

      const m = new maplibre.Map({
        container,
        style,
        center: [0, 20],
        zoom: 1,
        attributionControl: false,
        // One earth. Repeated copies triple the pins drawn and let a place
        // appear three times on the same screen.
        renderWorldCopies: false,
        // Drag and zoom, but no rotation — a tilted world map helps nobody.
        dragRotate: false,
        pitchWithRotate: false,
      })
      m.touchZoomRotate?.disableRotation()

      m.on('load', () => {
        install(m)
        if (!fitted && collection.features.length) {
          fitted = true
          fitTo(m, collection.features)
        }
      })

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
