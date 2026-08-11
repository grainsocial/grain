<script lang="ts">
  import { createMutation, useQueryClient } from '@tanstack/svelte-query'
  import { callXrpc } from '$hatk/client'
  import { Heart } from 'lucide-svelte'
  import { requireAuth } from '$lib/stores'
  import { compactCount } from '$lib/utils'

  let {
    galleryUri,
    viewerFav = null,
    favCount = 0,
    countHref = undefined,
    favorite = $bindable(undefined),
  }: {
    galleryUri: string
    viewerFav?: string | null
    favCount?: number
    /** When set, the count links here instead of being part of the toggle. */
    countHref?: string
    favorite?: () => void
  } = $props()

  let favOverride: string | null | undefined = $state(undefined)
  const favUri = $derived(favOverride !== undefined ? favOverride : viewerFav)
  const isFaved = $derived(!!favUri)
  const originallyFaved = $derived(!!viewerFav)
  const countOffset = $derived(isFaved === originallyFaved ? 0 : isFaved ? 1 : -1)
  const displayCount = $derived(favCount + countOffset)

  const queryClient = useQueryClient()

  const createFavMut = createMutation(() => ({
    mutationFn: async () => {
      return await callXrpc('dev.hatk.createRecord', {
        collection: 'social.grain.favorite',
        record: { subject: galleryUri, createdAt: new Date().toISOString() },
      })
    },
    onMutate: () => {
      favOverride = 'pending'
    },
    onSuccess: (data: any) => {
      favOverride = data.uri ?? null
      queryClient.invalidateQueries({ queryKey: ['getFeed'], refetchType: 'none' })
    },
    onError: () => {
      favOverride = undefined
    },
  }))

  const deleteFavMut = createMutation<void, Error, string, { prev: string | null }>(() => ({
    mutationFn: async (uri) => {
      const rkey = uri.split('/').pop()!
      await callXrpc('dev.hatk.deleteRecord', {
        collection: 'social.grain.favorite',
        rkey,
      })
    },
    onMutate: () => {
      const prev = favOverride !== undefined ? favOverride : viewerFav
      favOverride = null
      return { prev }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['getFeed'], refetchType: 'none' })
    },
    onError: (_err, _vars, context) => {
      favOverride = context?.prev ?? undefined
    },
  }))

  function doFavorite() {
    if (isFaved || createFavMut.isPending || deleteFavMut.isPending) return
    if (!requireAuth()) return
    createFavMut.mutate()
  }

  $effect(() => { favorite = doFavorite })
</script>

<span class="fav-group" class:faved={isFaved}>
  {#if isFaved}
    <button
      type="button"
      class="stat faved"
      title="Unfavorite"
      aria-label="Unfavorite"
      onclick={() => requireAuth() && !createFavMut.isPending && !deleteFavMut.isPending && favUri && favUri !== 'pending' && deleteFavMut.mutate(favUri)}
    >
      <Heart size={22} fill="currentColor" />
    </button>
  {:else}
    <button
      type="button"
      class="stat"
      title="Favorite"
      aria-label="Favorite"
      onclick={() => requireAuth() && !createFavMut.isPending && !deleteFavMut.isPending && !isFaved && createFavMut.mutate()}
    >
      <Heart size={22} />
    </button>
  {/if}
  {#if displayCount > 0}
    {#if countHref}
      <a class="stat-count stat-count-link" href={countHref} title="See who favorited this">
        {compactCount(displayCount)}
      </a>
    {:else}
      <span class="stat-count">{compactCount(displayCount)}</span>
    {/if}
  {/if}
</span>

<style>
  .fav-group {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
  }
  .stat {
    display: flex;
    align-items: center;
    background: none;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
    padding: 0;
    font-family: inherit;
    font-size: 13px;
    transition: color 0.15s;
  }
  .stat:hover { opacity: 0.7; }
  .stat.faved { color: #f87171; }
  .stat-count { color: var(--text-secondary); }
  .fav-group.faved .stat-count { color: #f87171; }
  .stat-count-link {
    text-decoration: none;
  }
  .stat-count-link:hover { text-decoration: underline; }
</style>
