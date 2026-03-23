<script lang="ts">
  import { cellToLatLng, isValidCell } from 'h3-js'

  let { h3Index }: { h3Index: string } = $props()

  const valid = $derived(isValidCell(h3Index))
  const [lat, lng] = $derived(valid ? cellToLatLng(h3Index) : [0, 0])
  const zoom = 11
  const maxTile = Math.pow(2, zoom)
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
