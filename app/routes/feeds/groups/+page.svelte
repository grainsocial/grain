<script lang="ts">
  import { createQuery, useQueryClient } from '@tanstack/svelte-query'
  import GalleryCard from '$lib/components/molecules/GalleryCard.svelte'
  import GalleryCardSkeleton from '$lib/components/molecules/GalleryCardSkeleton.svelte'
  import CommentSheet from '$lib/components/organisms/CommentSheet.svelte'
  import FeedTabs from '$lib/components/molecules/FeedTabs.svelte'
  import PullToRefresh from '$lib/components/molecules/PullToRefresh.svelte'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'
  import { poolFeedQuery } from '$lib/queries'
  import { viewer } from '$lib/stores'
  import { Lock } from 'lucide-svelte'
  import type { GalleryView, GroupView } from '$hatk/client'

  // The pools you are in, in one column. Not a feed in grain's usual sense:
  // every other one is SQL over the index with a cursor, and none of this is
  // indexed — a pool is a permissioned space, so it is read live, per viewer,
  // with a credential each community's host issues. Which means no cursor, no
  // infinite scroll, and nothing here that could be served to anyone else.
  const queryClient = useQueryClient()
  const feed = createQuery(() => ({ ...poolFeedQuery(), enabled: !!$viewer }))

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['poolFeed'] })
  }

  const groups = $derived(new Map((feed.data?.groups ?? []).map((g: GroupView) => [g.did, g])))

  // Never the CDN: the space hands a blob only to a credential holder, so these
  // come back through grain itself and are cached nowhere in between.
  const blobSrc = (space: string, did: string, cid: string) =>
    `/xrpc/social.grain.unspecced.getPrivateBlob?${new URLSearchParams({ space, did, cid })}`

  // The sheet a card's comment button opens, carrying which pool to read the
  // thread from — it is not in any index to be looked up by subject alone.
  let thread = $state<{ uri: string; group: string } | null>(null)
  const openThread = (i: number) => {
    const g = feed.data?.galleries?.[i]
    if (g) thread = { uri: `at://${g.did}/social.grain.gallery/${g.rkey}`, group: g.group }
  }

  const cards = $derived(
    (feed.data?.galleries ?? []).map(
      (g) =>
        ({
          uri: `at://${g.did}/social.grain.gallery/${g.rkey}`,
          cid: '',
          title: g.title,
          description: g.description,
          createdAt: g.createdAt,
          creator: { did: g.did, handle: g.handle, displayName: g.displayName },
          // The card already knows how to say which pool a gallery is in — the
          // "in <group>" line under the author. No `item`: that is the accept
          // record a public pool has and this one does not, which is also what
          // keeps the card from offering to remove it.
          group: groups.get(g.group)
            ? {
                did: g.group,
                handle: groups.get(g.group)!.handle,
                displayName: groups.get(g.group)!.displayName,
              }
            : undefined,
          favCount: g.favCount ?? 0,
          commentCount: g.commentCount ?? 0,
          viewer: g.viewerFav ? { fav: g.viewerFav } : undefined,
          items: (g.items ?? []).map((item) => ({
            uri: item.uri,
            cid: item.cid,
            thumb: blobSrc(g.space, item.did, item.cid),
            fullsize: blobSrc(g.space, item.did, item.cid),
            alt: item.alt,
            aspectRatio: item.aspectRatio,
          })),
        }) as unknown as GalleryView,
    ),
  )
</script>

<OGMeta title="Groups — grain" />

<FeedTabs />

<PullToRefresh onRefresh={refresh}>
  {#if !$viewer}
    <div class="empty">
      <Lock size={15} />
      <p>These pools are their communities', not the network's. Sign in to see the ones you are in.</p>
    </div>
  {:else if feed.isLoading}
    <GalleryCardSkeleton />
    <GalleryCardSkeleton />
  {:else if feed.isError}
    <div class="empty">
      <Lock size={15} />
      <p>
        No pool would open. Your session may have expired — signing in again mints the credentials
        these reads need.
      </p>
    </div>
  {:else if cards.length === 0}
    <div class="empty">
      <Lock size={15} />
      <p>Nothing in your groups' pools yet. Join a group, or add the first gallery to one.</p>
    </div>
  {:else}
    {#each cards as card, i (card.uri)}
      <GalleryCard
        gallery={card}
        privateGallery
        pool={feed.data?.galleries?.[i]?.group}
        onCommentClick={() => openThread(i)}
      />
    {/each}
    {#if thread}
      <CommentSheet
        open={true}
        subjectUri={thread.uri}
        pool={thread.group}
        onClose={() => (thread = null)}
      />
    {/if}
  {/if}
</PullToRefresh>

<style>
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 56px 24px;
    color: var(--text-muted);
    text-align: center;
  }
  .empty p { margin: 0; font-size: 14px; line-height: 1.5; max-width: 34ch; }
</style>
