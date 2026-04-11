<script lang="ts">
  import Avatar from './Avatar.svelte'
  import { relativeTime } from '$lib/utils'

  let { notif }: { notif: any } = $props()

  const reasonText: Record<string, string> = {
    'gallery-favorite': 'favorited your gallery',
    'gallery-comment': 'commented on your gallery',
    'gallery-comment-mention': 'mentioned you in a comment',
    'gallery-mention': 'mentioned you in a gallery',
    'story-favorite': 'favorited your story',
    'story-comment': 'commented on your story',
    'reply': 'replied to your comment',
    'follow': 'followed you',
  }

  const action = $derived(reasonText[notif.reason] ?? '')
  const timeStr = $derived(relativeTime(notif.createdAt || ''))
  const authorDid = $derived(notif.author?.did ?? '')
  const authorName = $derived(notif.author?.displayName || notif.author?.handle || authorDid.slice(0, 18))
  const authorAvatar = $derived(notif.author?.avatar ?? null)
  const contentHref = $derived(
    notif.galleryUri
      ? `/profile/${notif.galleryUri.split('/')[2]}/gallery/${notif.galleryUri.split('/').pop()}`
      : notif.storyUri
        ? `/profile/${notif.storyUri.split('/')[2]}/story/${notif.storyUri.split('/').pop()}`
        : `/profile/${authorDid}`
  )
  const profileHref = $derived(`/profile/${authorDid}`)
</script>

<div class="notif" role="group">
  <a class="notif-avatar" href={profileHref}>
    <Avatar did={authorDid} src={authorAvatar} name={authorName} size={38} />
  </a>
  <a class="notif-body" href={contentHref}>
    <div class="notif-header">
      <span class="notif-author">{authorName}</span>
      <span class="notif-action">{action}</span>
      <span class="notif-time">{timeStr}</span>
    </div>
    {#if notif.reason === 'reply' && notif.replyToText}
      <div class="notif-quote">{notif.replyToText}</div>
    {/if}
    {#if notif.commentText}
      <div class="notif-comment">{notif.commentText}</div>
    {/if}
    {#if notif.galleryTitle && notif.reason !== 'follow'}
      <div class="notif-gallery-title">{notif.galleryTitle}</div>
    {/if}
  </a>
  {#if notif.galleryThumb || notif.storyThumb}
    <a href={contentHref}><img src={notif.galleryThumb ?? notif.storyThumb} alt="" class="notif-thumb" loading="lazy" /></a>
  {/if}
</div>

<style>
  .notif {
    display: flex;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    color: inherit;
    transition: background 0.12s;
    align-items: flex-start;
  }
  .notif:hover {
    background: var(--bg-hover);
  }
  .notif-avatar {
    flex-shrink: 0;
    text-decoration: none;
  }
  .notif-body {
    flex: 1;
    min-width: 0;
    text-decoration: none;
    color: inherit;
  }
  .notif-header {
    font-size: 13px;
    line-height: 1.4;
  }
  .notif-author {
    font-weight: 600;
    color: var(--text-primary);
  }
  .notif-avatar:hover + .notif-body .notif-author {
    text-decoration: underline;
  }
  .notif-action {
    color: var(--text-secondary);
    margin-left: 4px;
  }
  .notif-time {
    color: var(--text-muted);
    margin-left: 4px;
    font-size: 12px;
  }
  .notif-quote {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 4px;
    padding: 4px 8px;
    border-left: 2px solid var(--border);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .notif-comment {
    font-size: 13px;
    color: var(--text-secondary);
    margin-top: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .notif-gallery-title {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 2px;
  }
  .notif-thumb {
    width: 48px;
    height: 48px;
    border-radius: 6px;
    object-fit: cover;
    flex-shrink: 0;
  }
</style>
