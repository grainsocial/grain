<script lang="ts">
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import Skeleton from '$lib/components/atoms/Skeleton.svelte'
  import { createQuery } from '@tanstack/svelte-query'
  import { privateGalleryQuery } from '$lib/queries'
  import { Lock } from 'lucide-svelte'
  import { page } from '$app/state'

  const space = $derived(
    `at://${page.params.authority}/space/social.grain.gallery/${page.params.skey}`,
  )

  const gallery = createQuery(() => privateGalleryQuery(space))

  // Never the CDN: the space hands a blob only to a credential holder, so these
  // come back through grain itself and are cached nowhere in between.
  function blobSrc(did: string, cid: string): string {
    const params = new URLSearchParams({ space, did, cid })
    return `/xrpc/social.grain.unspecced.getPrivateBlob?${params}`
  }

  const notAuthorized = $derived(
    gallery.isError && /NotAuthorized|Not a member/i.test(String(gallery.error)),
  )
</script>

<DetailHeader label={gallery.data?.gallery?.title ?? 'Private gallery'} />

<div class="detail-page">
  {#if gallery.isLoading}
    <div class="head"><Skeleton width="90px" height="22px" /></div>
    <div class="photos">
      {#each { length: 3 } as _}
        <Skeleton height="260px" />
      {/each}
    </div>
  {:else if notAuthorized}
    <p class="empty">
      This gallery is private and you're not on its list. Nothing about it is public — even its
      existence is only visible to its members.
    </p>
  {:else if gallery.isError}
    <p class="empty">{String(gallery.error)}</p>
  {:else if gallery.data}
    <div class="head">
      <span class="badge"><Lock size={12} /> Private</span>
      {#if gallery.data.viewerIsAuthor}
        <span class="muted">Yours</span>
      {/if}
    </div>

    {#if gallery.data.gallery?.description}
      <p class="description">{gallery.data.gallery.description}</p>
    {/if}

    {#if gallery.data.items.length === 0}
      <p class="empty">No photos in this gallery yet.</p>
    {:else}
      <div class="photos">
        {#each gallery.data.items as item (item.uri)}
          <img
            src={blobSrc(item.did, item.cid)}
            alt={item.alt ?? ''}
            width={item.aspectRatio?.width}
            height={item.aspectRatio?.height}
            loading="lazy"
          />
        {/each}
      </div>
    {/if}

    <p class="footnote">
      Assembled from its author's repo at request time. Space records never reach the firehose, so
      none of this is indexed.
    </p>
  {/if}
</div>

<style>
  /* 600px, matching the public gallery detail page. */
  .detail-page {
    max-width: 600px;
    margin: 0 auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border: 1px solid var(--border);
    border-radius: 999px;
    font-size: 12px;
    color: var(--text-muted);
  }
  .muted,
  .footnote {
    font-size: 12px;
    color: var(--text-muted);
  }
  .footnote {
    margin: 4px 0 0;
    line-height: 1.45;
  }
  .description {
    margin: 0;
    font-size: 15px;
    line-height: 1.5;
    color: var(--text-primary);
  }
  /* One column, like a gallery detail page — not the multi-column grid the
     feed uses for whole galleries. */
  .photos {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .photos img {
    width: 100%;
    height: auto;
    border-radius: 10px;
    background: var(--bg-hover);
  }
  .empty {
    margin: 0;
    padding: 32px 0;
    font-size: 14px;
    line-height: 1.5;
    color: var(--text-muted);
    text-align: center;
  }
</style>
