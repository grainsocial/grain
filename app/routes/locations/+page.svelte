<script lang="ts">
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import GallerySectionRow from '$lib/components/molecules/GallerySectionRow.svelte'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'
  import { createQuery } from '@tanstack/svelte-query'
  import { locationsQuery } from '$lib/queries'

  const locations = createQuery(() => locationsQuery())
</script>

<OGMeta title="Locations - grain" />
<DetailHeader label="Locations" />

<div class="index-page">
  {#if locations.isLoading}
    <div class="state">Loading…</div>
  {:else if !locations.data?.length}
    <div class="state">No locations yet.</div>
  {:else}
    <!-- Unkeyed on purpose. h3Index does not identify a row: getLocations
         groups by address (locality/region/country) and then picks each
         group's densest cell independently, so a state-level group and a
         city-level group inside it can land on the same cell — in prod,
         "Washington, US" and "Vancouver, Washington, US" both resolve to
         8a28f00d8227fff. Both rows are legitimate and must both render, since
         the location feed keys off `name`, not the cell. A keyed each on
         h3Index threw each_key_duplicate and blanked the page. Matches
         MobileDrawer, which renders this list unkeyed. -->
    {#each locations.data as loc}
      <GallerySectionRow
        kind="location"
        h3={loc.h3Index}
        name={loc.name}
        href="/location/{encodeURIComponent(loc.h3Index)}?name={encodeURIComponent(loc.name)}"
      />
    {/each}
  {/if}
</div>

<style>
  .index-page {
    display: flex;
    flex-direction: column;
  }
  .state {
    padding: 32px 16px;
    text-align: center;
    color: var(--text-muted);
  }
</style>
