<script lang="ts">
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
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
    {#each locations.data as loc (loc.h3Index)}
      <a
        class="row"
        href="/location/{encodeURIComponent(loc.h3Index)}?name={encodeURIComponent(loc.name)}"
      >
        <span class="name">{loc.name}</span>
      </a>
    {/each}
  {/if}
</div>

<style>
  .index-page {
    display: flex;
    flex-direction: column;
  }
  .row {
    display: block;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
    text-decoration: none;
    color: var(--text-primary);
    transition: background 0.12s;
  }
  .row:hover {
    background: var(--bg-hover);
  }
  .name {
    font-size: 15px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .state {
    padding: 32px 16px;
    text-align: center;
    color: var(--text-muted);
  }
</style>
