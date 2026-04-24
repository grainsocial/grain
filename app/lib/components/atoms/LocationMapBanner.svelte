<script lang="ts">
  import { cellToLatLng, isValidCell } from 'h3-js'

  let { h3Index, h3Cells }: { h3Index: string; h3Cells?: string[] } = $props()

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

  const maxTile = $derived(Math.pow(2, zoom))
  const tileX = $derived(Math.floor(((lng + 180) / 360) * maxTile))
  const tileY = $derived(
    Math.floor(
      ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
        maxTile,
    ),
  )

  function wrapTile(x: number): number {
    return ((x % maxTile) + maxTile) % maxTile
  }

  function tileUrl(x: number, y: number): string {
    return `https://a.basemaps.cartocdn.com/dark_all/${zoom}/${wrapTile(x)}/${y}@2x.png`
  }
</script>

{#if valid}
  <div class="map-banner" aria-hidden="true">
    <div class="tile-grid">
      <img src={tileUrl(tileX - 1, tileY)} alt="" loading="lazy" />
      <img src={tileUrl(tileX, tileY)} alt="" loading="lazy" />
      <img src={tileUrl(tileX + 1, tileY)} alt="" loading="lazy" />
    </div>
    <div class="fade"></div>
  </div>
{/if}

<style>
  .map-banner {
    position: relative;
    height: 120px;
    overflow: hidden;
    border-bottom: 1px solid var(--border);
  }
  .tile-grid {
    display: flex;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    filter: saturate(1.8) brightness(1.2);
  }
  .tile-grid img {
    width: 256px;
    height: 256px;
    display: block;
  }
  .fade {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 32px;
    background: linear-gradient(transparent, var(--bg-root));
  }
</style>
