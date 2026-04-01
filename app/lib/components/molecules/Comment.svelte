<script lang="ts">
  import type { CommentView } from '$hatk/client'
  import Avatar from '../atoms/Avatar.svelte'
  import RichText from '../atoms/RichText.svelte'
  import { relativeTime } from '$lib/utils'
  import { viewer } from '$lib/stores'

  let {
    comment,
    onReply,
    onDelete,
  }: {
    comment: CommentView
    onReply?: (uri: string, handle: string) => void
    onDelete?: (uri: string) => void
  } = $props()

  const isOwner = $derived($viewer?.did === comment.author?.did)
  const timeStr = $derived(relativeTime(comment.createdAt || ''))
  const isReply = $derived(!!comment.replyTo)
</script>

<div class="comment" class:reply={isReply}>
  <Avatar did={comment.author?.did ?? ''} src={comment.author?.avatar ?? null} size={28} />
  <div class="content">
    <div class="text-line">
      <a href="/profile/{comment.author?.did}" class="handle">{comment.author?.handle ?? comment.author?.did}</a>
      <span class="text"><RichText text={comment.text} /></span>
    </div>
    <div class="meta">
      <span class="time">{timeStr}</span>
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
</div>

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
</style>
