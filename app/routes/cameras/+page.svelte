<script lang="ts">
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'
  import { createQuery } from '@tanstack/svelte-query'
  import { camerasQuery } from '$lib/queries'

  const cameras = createQuery(() => camerasQuery())
</script>

<OGMeta title="Cameras - grain" />
<DetailHeader label="Cameras" />

<div class="index-page">
  {#if cameras.isLoading}
    <div class="state">Loading…</div>
  {:else if !cameras.data?.length}
    <div class="state">No cameras yet.</div>
  {:else}
    {#each cameras.data as c (c.camera)}
      <a class="row" href="/camera/{encodeURIComponent(c.camera)}">
        <span class="name">{c.camera}</span>
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
