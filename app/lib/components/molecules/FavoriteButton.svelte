<script lang="ts">
  import { createMutation, useQueryClient } from '@tanstack/svelte-query'
  import { callXrpc } from '$hatk/client'
  import { Heart } from 'lucide-svelte'
  import { requireAuth } from '$lib/stores'

  let {
    galleryUri,
    viewerFav = null,
    favCount = 0,
  }: {
    galleryUri: string
    viewerFav?: string | null
    favCount?: number
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
</script>

{#if isFaved}
  <button
    type="button"
    class="stat faved"
    title="Unfavorite"
    onclick={() => requireAuth() && !createFavMut.isPending && !deleteFavMut.isPending && favUri && favUri !== 'pending' && deleteFavMut.mutate(favUri)}
  >
    <Heart size={22} fill="currentColor" />
    {#if displayCount > 0}<span class="stat-count">{displayCount}</span>{/if}
  </button>
{:else}
  <button
    type="button"
    class="stat"
    title="Favorite"
    onclick={() => requireAuth() && !createFavMut.isPending && !deleteFavMut.isPending && !isFaved && createFavMut.mutate()}
  >
    <Heart size={22} />
    {#if displayCount > 0}<span class="stat-count">{displayCount}</span>{/if}
  </button>
{/if}

<style>
  .stat {
    display: flex;
    align-items: center;
    gap: 6px;
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
  .stat.faved .stat-count { color: #f87171; }
</style>
