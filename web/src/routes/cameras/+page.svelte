<script lang="ts">
  import PageHeading from '$lib/components/molecules/PageHeading.svelte'
  import BrowseTile from '$lib/components/molecules/BrowseTile.svelte'
  import Skeleton from '$lib/components/atoms/Skeleton.svelte'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'
  import { createQuery } from '@tanstack/svelte-query'
  import { camerasQuery } from '$lib/queries'

  const cameras = createQuery(() => camerasQuery())

  const fmt = new Intl.NumberFormat('en')
  const photos = (n: number) => `${fmt.format(n)} ${n === 1 ? 'photo' : 'photos'}`
</script>

<OGMeta title="Cameras - grain" />

<PageHeading title="Cameras" back />

<div class="grid">
  {#if cameras.isLoading}
    {#each { length: 9 } as _, i (i)}
      <div class="cell"><Skeleton width="100%" height="100%" radius="0" /></div>
    {/each}
  {:else if !cameras.data?.length}
    <div class="state">No cameras yet.</div>
  {:else}
    {#each cameras.data as c (c.camera)}
      <BrowseTile
        href="/camera/{encodeURIComponent(c.camera)}"
        title={c.camera}
        meta={photos(c.photoCount)}
        thumbs={c.thumbs ?? []}
      />
    {/each}
  {/if}
</div>

<style>
  /* Three up, edge to edge, matching GalleryGrid's columns and 2px gutter. The
     index is for picking a camera, so a screen holds nine of them, not one. */
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2px;
    margin-top: 18px;
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

  /* Two up on a phone: a third column leaves no room for the name. */
  @media (max-width: 600px) {
    .grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
