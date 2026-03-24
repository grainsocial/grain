<script lang="ts">
  import { createMutation, useQueryClient } from '@tanstack/svelte-query'
  import { callXrpc } from '$hatk/client'
  import type { CreateRecord } from '$hatk'
  import { requireAuth } from '$lib/stores'

  let {
    did,
    viewerFollow = null,
    onCountChange,
  }: {
    did: string
    viewerFollow?: string | null
    onCountChange?: (delta: number) => void
  } = $props()

  let followOverride: string | null | undefined = $state(undefined)
  const followUri = $derived(followOverride !== undefined ? followOverride : viewerFollow)
  const isFollowing = $derived(!!followUri)

  const queryClient = useQueryClient()

  const followMut = createMutation<CreateRecord['output'], Error>(() => ({
    mutationFn: async () => {
      return await callXrpc('dev.hatk.createRecord', {
        collection: 'social.grain.graph.follow',
        record: { subject: did, createdAt: new Date().toISOString() },
      })
    },
    onMutate: () => {
      followOverride = 'pending'
      onCountChange?.(1)
    },
    onSuccess: (data) => {
      if (!data?.uri) {
        followOverride = null
        onCountChange?.(-1)
        return
      }
      followOverride = data.uri
      queryClient.invalidateQueries({ queryKey: ['actorProfile', did] })
    },
    onError: () => {
      followOverride = null
      onCountChange?.(-1)
    },
  }))

  const unfollowMut = createMutation<void, Error, string, { prev: string | null }>(() => ({
    mutationFn: async (uri) => {
      const rkey = uri.split('/').pop()!
      await callXrpc('dev.hatk.deleteRecord', {
        collection: 'social.grain.graph.follow',
        rkey,
      })
    },
    onMutate: () => {
      const prev = followOverride ?? null
      followOverride = null
      onCountChange?.(-1)
      return { prev }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actorProfile', did] })
    },
    onError: (_err, _vars, context) => {
      followOverride = context?.prev ?? null
      onCountChange?.(1)
    },
  }))

  function handleClick() {
    if (!requireAuth()) return
    if (isFollowing && followUri && followUri !== 'pending') {
      unfollowMut.mutate(followUri)
    } else if (!isFollowing && !followMut.isPending) {
      followMut.mutate()
    }
  }
</script>

<button
  type="button"
  class="follow-btn"
  class:following={isFollowing}
  onclick={handleClick}
  disabled={followOverride === 'pending'}
>
  {isFollowing ? 'Following' : 'Follow'}
</button>

<style>
  .follow-btn {
    padding: 6px 20px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s;
    background: var(--grain-btn);
    color: #fff;
    border: 1px solid var(--grain-btn);
  }
  .follow-btn:hover {
    background: var(--grain-btn-dim);
    border-color: var(--grain-btn-dim);
  }
  .follow-btn.following {
    background: transparent;
    color: var(--text-secondary);
    border-color: var(--border);
  }
  .follow-btn.following:hover {
    color: var(--danger);
    border-color: var(--danger);
  }
  .follow-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
