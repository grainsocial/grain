<script lang="ts">
  import type { CommentView } from '$hatk/client'
  import { callXrpc } from '$hatk/client'
  import { createMutation, useQueryClient } from '@tanstack/svelte-query'
  import Avatar from '../atoms/Avatar.svelte'
  import RichText from '../atoms/RichText.svelte'
  import { relativeTime, compactCount } from '$lib/utils'
  import { viewer, requireAuth } from '$lib/stores'
  import { VolumeX, Heart } from 'lucide-svelte'

  let {
    comment,
    onReply,
    onDelete,
  }: {
    comment: CommentView
    onReply?: (uri: string, handle: string) => void
    onDelete?: (uri: string) => void
  } = $props()

  let expanded = $state(false)

  const isOwner = $derived($viewer?.did === comment.author?.did)
  const timeStr = $derived(relativeTime(comment.createdAt || ''))
  const isReply = $derived(!!comment.replyTo)
  const isMuted = $derived(!!comment.muted && !expanded)

  // Comment favorite state
  let favOverride: string | null | undefined = $state(undefined)
  const viewerFav = $derived(comment.viewer?.fav ?? null)
  const favUri = $derived(favOverride !== undefined ? favOverride : viewerFav)
  const isFaved = $derived(!!favUri)
  const originallyFaved = $derived(!!viewerFav)
  const serverFavCount = $derived(comment.favCount ?? 0)
  const countOffset = $derived(isFaved === originallyFaved ? 0 : isFaved ? 1 : -1)
  const displayFavCount = $derived(serverFavCount + countOffset)

  const queryClient = useQueryClient()

  const createFavMut = createMutation(() => ({
    mutationFn: async () => {
      return await callXrpc('dev.hatk.createRecord', {
        collection: 'social.grain.favorite',
        record: { subject: comment.uri, createdAt: new Date().toISOString() },
      })
    },
    onMutate: () => { favOverride = 'pending' },
    onSuccess: (data: any) => { favOverride = data.uri ?? null },
    onError: () => { favOverride = undefined },
  }))

  const deleteFavMut = createMutation<void, Error, string>(() => ({
    mutationFn: async (uri) => {
      const rkey = uri.split('/').pop()!
      await callXrpc('dev.hatk.deleteRecord', { collection: 'social.grain.favorite', rkey })
    },
    onMutate: () => {
      const prev = favOverride !== undefined ? favOverride : viewerFav
      favOverride = null
      return { prev }
    },
    onSuccess: () => {},
    onError: (_err: any, _vars: any, context: any) => { favOverride = context?.prev ?? undefined },
  }))

  function toggleFav() {
    if (createFavMut.isPending || deleteFavMut.isPending) return
    if (!requireAuth()) return
    if (isFaved && favUri && favUri !== 'pending') {
      deleteFavMut.mutate(favUri)
    } else if (!isFaved) {
      createFavMut.mutate()
    }
  }
</script>

{#if comment.muted && !expanded}
  <div class="comment muted-comment" class:reply={isReply}>
    <button class="muted-toggle" onclick={() => (expanded = true)}>
      <VolumeX size={14} />
      <span>Muted comment</span>
    </button>
  </div>
{:else}
  <div class="comment" class:reply={isReply}>
    <Avatar did={comment.author?.did ?? ''} src={comment.author?.avatar ?? null} size={28} />
    <div class="content">
      <div class="text-line">
        <a href="/profile/{comment.author?.did}" class="handle">{comment.author?.handle ?? comment.author?.did}</a>
        <span class="text"><RichText text={comment.text} /></span>
      </div>
      <div class="meta">
        <span class="time">{timeStr}</span>
        {#if displayFavCount > 0}
          <span class="fav-count">{compactCount(displayFavCount)} {displayFavCount === 1 ? 'fav' : 'favs'}</span>
        {/if}
        {#if onReply}
          <button class="meta-btn" onclick={() => onReply?.(comment.replyTo ?? comment.uri, comment.author?.handle ?? '')}>Reply</button>
        {/if}
        {#if isOwner && onDelete}
          <button class="meta-btn delete" onclick={() => onDelete?.(comment.uri)}>Delete</button>
        {/if}
      </div>
    </div>
    {#if comment.focus?.thumb}
      <img class="focus-thumb" src={comment.focus.thumb} alt={comment.focus?.alt ?? ''} />
    {/if}
    <button class="fav-btn" class:faved={isFaved} onclick={toggleFav} title={isFaved ? 'Unfavorite' : 'Favorite'}>
      <Heart size={16} fill={isFaved ? 'currentColor' : 'none'} />
    </button>
  </div>
{/if}

<style>
  .comment {
    display: flex;
    gap: 10px;
    padding: 8px 0;
  }
  .comment.reply {
    padding-left: 38px;
  }
  .content {
    flex: 1;
    min-width: 0;
  }
  .text-line {
    font-size: 14px;
    color: var(--text-primary);
    line-height: 1.4;
    word-break: break-word;
  }
  .handle {
    font-weight: 600;
    text-decoration: none;
    color: inherit;
    margin-right: 6px;
  }
  .handle:hover { text-decoration: underline; }
  .meta {
    display: flex;
    gap: 12px;
    margin-top: 4px;
  }
  .time {
    font-size: 12px;
    color: var(--text-muted);
  }
  .meta-btn {
    font-size: 12px;
    color: var(--text-muted);
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-weight: 600;
    font-family: inherit;
  }
  .meta-btn:hover { color: var(--text-primary); }
  .meta-btn.delete:hover { color: #f87171; }
  .focus-thumb {
    width: 40px;
    height: 40px;
    border-radius: 4px;
    object-fit: cover;
    flex-shrink: 0;
  }
  .muted-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 13px;
    cursor: pointer;
    padding: 0;
    font-family: inherit;
  }
  .muted-toggle:hover { color: var(--text-secondary); }
  .fav-btn {
    display: flex;
    align-items: flex-start;
    padding: 10px 0 0 0;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    flex-shrink: 0;
    transition: color 0.15s;
  }
  .fav-btn:hover { color: var(--text-secondary); }
  .fav-btn.faved { color: #f87171; }
  .fav-count {
    font-size: 12px;
    color: var(--text-muted);
    font-weight: 600;
  }
</style>
