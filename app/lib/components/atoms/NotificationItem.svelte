<script lang="ts">
  import Avatar from './Avatar.svelte'
  import { Heart, UserPlus, MessageSquare, AtSign, CornerDownRight, ChevronDown, ChevronUp } from 'lucide-svelte'
  import { relativeTime } from '$lib/utils'
  import type { GroupedNotification } from '$lib/notifications'

  let { group }: { group: GroupedNotification } = $props()
  let expanded = $state(false)

  const notif = $derived(group.notification)
  const isGrouped = $derived(group.authorCount > 1)

  const reasonText: Record<string, string> = {
    'gallery-favorite': 'favorited your gallery',
    'gallery-comment': 'commented on your gallery',
    'gallery-comment-mention': 'mentioned you in a comment',
    'gallery-mention': 'mentioned you in a gallery',
    'comment-favorite': 'favorited your comment',
    'story-favorite': 'favorited your story',
    'story-comment': 'commented on your story',
    'reply': 'replied to your comment',
    'follow': 'followed you',
  }

  const isFavorite = $derived(notif.reason === 'gallery-favorite' || notif.reason === 'story-favorite' || notif.reason === 'comment-favorite')
  const isFollow = $derived(notif.reason === 'follow')
  const isComment = $derived(notif.reason === 'gallery-comment' || notif.reason === 'story-comment')
  const isReply = $derived(notif.reason === 'reply')
  const isMention = $derived(notif.reason === 'gallery-comment-mention' || notif.reason === 'gallery-mention')

  const action = $derived(reasonText[notif.reason] ?? '')
  const timeStr = $derived(relativeTime(notif.createdAt || ''))
  const authorDid = $derived(notif.author?.did ?? '')
  const authorName = $derived(notif.author?.displayName || notif.author?.handle || authorDid.slice(0, 18))
  const authorHandle = $derived(notif.author?.handle ?? authorDid.slice(0, 18))
  const authorAvatar = $derived(notif.author?.avatar ?? null)
  const thumb = $derived(notif.galleryThumb ?? notif.storyThumb ?? null)
  const contentHref = $derived(
    notif.galleryUri
      ? `/profile/${notif.galleryUri.split('/')[2]}/gallery/${notif.galleryUri.split('/').pop()}`
      : notif.storyUri
        ? `/profile/${notif.storyUri.split('/')[2]}/story/${notif.storyUri.split('/').pop()}`
        : `/profile/${authorDid}`
  )
  const profileHref = $derived(`/profile/${authorDid}`)


  // All unique authors for grouped display
  const allAuthors = $derived.by(() => {
    if (!isGrouped) return []
    const authors = [
      { did: notif.author?.did, avatar: notif.author?.avatar, name: authorName, handle: notif.author?.handle },
      ...group.additional.map((n: any) => ({
        did: n.author?.did,
        avatar: n.author?.avatar,
        name: n.author?.displayName || n.author?.handle || n.author?.did?.slice(0, 18),
        handle: n.author?.handle,
      })),
    ]
    const seen = new Set<string>()
    return authors.filter((a) => {
      if (seen.has(a.did)) return false
      seen.add(a.did)
      return true
    })
  })

  const groupActionText = $derived.by(() => {
    if (!isGrouped) return ''
    const othersCount = group.authorCount - 1
    const others = othersCount === 1 ? '1 other' : `${othersCount} others`
    return `${authorName} and ${others} ${action}`
  })
</script>

{#if isGrouped}
  <!-- Grouped notification -->
  <div class="notif grouped" role="group">
    <div class="notif-icon icon-grain">
      {#if isFavorite}<Heart size={18} fill="currentColor" />
      {:else if isFollow}<UserPlus size={18} fill="currentColor" />
      {:else if isComment}<MessageSquare size={16} fill="currentColor" />
      {:else if isReply}<CornerDownRight size={18} />
      {:else if isMention}<AtSign size={18} />
      {/if}
    </div>
    <div class="notif-body">
      {#if expanded}
        <button class="expand-toggle" onclick={() => expanded = false}>
          <ChevronUp size={14} />
          <span>Hide</span>
        </button>
        <div class="expanded-authors">
          {#each allAuthors as author (author.did)}
            <a href="/profile/{author.did}" class="expanded-author-row">
              <Avatar did={author.did} src={author.avatar} name={author.name} size={34} />
              <div class="expanded-author-info">
                <span class="expanded-author-name">{author.name}</span>
                <span class="expanded-author-handle">@{author.handle ?? author.did.slice(0, 18)}</span>
              </div>
            </a>
          {/each}
        </div>
      {:else}
        <div class="grouped-avatars">
          {#each allAuthors.slice(0, 5) as author (author.did)}
            <a href="/profile/{author.did}" class="grouped-avatar-link" onclick={(e) => e.stopPropagation()}>
              <Avatar did={author.did} src={author.avatar} name={author.name} size={34} />
            </a>
          {/each}
          {#if group.authorCount > 5}
            <span class="more-count">+{group.authorCount - 5}</span>
          {/if}
          <button class="expand-toggle-chevron" onclick={() => expanded = true}>
            <ChevronDown size={14} />
          </button>
        </div>
      {/if}
      <a href={contentHref} class="notif-link">
        <div class="notif-action-line">
          <span class="notif-text">{groupActionText}</span>
          <span class="notif-time">{timeStr}</span>
        </div>
        {#if notif.galleryTitle}
          <div class="notif-gallery-title">{notif.galleryTitle}</div>
        {/if}
      </a>
    </div>
    {#if thumb}
      <a href={contentHref} class="notif-thumb-link">
        <img src={thumb} alt="" class="notif-thumb" loading="lazy" />
      </a>
    {/if}
  </div>
{:else}
  <!-- Single notification -->
  <div class="notif" role="group">
    <div class="notif-icon icon-grain">
      {#if isFavorite}<Heart size={18} fill="currentColor" />
      {:else if isFollow}<UserPlus size={18} fill="currentColor" />
      {:else if isComment}<MessageSquare size={16} fill="currentColor" />
      {:else if isReply}<CornerDownRight size={18} />
      {:else if isMention}<AtSign size={18} />
      {/if}
    </div>
    <div class="notif-content">
      <a class="notif-avatar" href={profileHref}>
        <Avatar did={authorDid} src={authorAvatar} name={authorName} size={34} />
      </a>
      <a class="notif-body" href={contentHref}>
        <div class="notif-action-line">
          <span><span class="notif-author">{authorName}</span> {action}</span>
          <span class="notif-time">{timeStr}</span>
        </div>
        {#if notif.commentText}
          <div class="notif-comment">{notif.commentText}</div>
        {/if}
        {#if notif.reason === 'reply' && notif.replyToText}
          <div class="notif-quote">{notif.replyToText}</div>
        {/if}
        {#if notif.galleryTitle && notif.reason !== 'follow'}
          <div class="notif-gallery-title">{notif.galleryTitle}</div>
        {/if}
      </a>
    </div>
    {#if thumb}
      <a href={contentHref} class="notif-thumb-link">
        <img src={thumb} alt="" class="notif-thumb" loading="lazy" />
      </a>
    {/if}
  </div>
{/if}

<style>
  .notif {
    display: flex;
    gap: 10px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
    color: inherit;
    transition: background 0.12s;
    align-items: flex-start;
  }
  .notif:hover {
    background: var(--bg-hover);
  }
  .notif-icon {
    flex-shrink: 0;
    width: 20px;
    display: flex;
    justify-content: center;
    height: 34px;
    align-items: center;
  }
  .grouped .notif-icon {
    height: 34px;
  }
  .icon-grain {
    color: var(--grain);
  }
  .notif-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
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
  .notif-action-line {
    font-size: 13px;
    line-height: 1.4;
    color: var(--text-primary);
  }
  .notif-author {
    font-weight: 600;
  }
  .notif-avatar:hover ~ .notif-body .notif-author {
    text-decoration: underline;
  }
  .notif-time {
    color: var(--text-muted);
    font-size: 12px;
    margin-left: 4px;
  }
  .notif-comment {
    font-size: 13px;
    color: var(--text-secondary);
    margin-top: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
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
  .notif-gallery-title {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 2px;
  }
  .notif-thumb-link {
    flex-shrink: 0;
    align-self: center;
  }
  .notif-thumb {
    width: 44px;
    height: 44px;
    object-fit: cover;
    border-radius: 6px;
  }
  /* Grouped notification styles */
  .grouped-avatars {
    display: flex;
    align-items: center;
    gap: 0;
    margin-bottom: 6px;
  }
  .grouped-avatar-link {
    margin-right: -8px;
    text-decoration: none;
    position: relative;
  }
  .grouped-avatar-link :global(img),
  .grouped-avatar-link :global(.avatar) {
    box-shadow: 0 0 0 2px var(--bg-root);
    transition: box-shadow 0.12s;
  }
  .notif:hover .grouped-avatar-link :global(img),
  .notif:hover .grouped-avatar-link :global(.avatar) {
    box-shadow: 0 0 0 2px var(--bg-hover);
  }
  .grouped-avatar-link:hover {
    z-index: 1;
  }
  .more-count {
    font-size: 12px;
    color: var(--text-muted);
    margin-left: 12px;
  }
  .notif-text {
    color: var(--text-primary);
    font-size: 13px;
    line-height: 1.4;
  }
  .notif-link {
    text-decoration: none;
    color: inherit;
  }
  .expand-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 13px;
    cursor: pointer;
    padding: 4px 0;
  }
  .expand-toggle:hover {
    color: var(--text-secondary);
  }
  .expand-toggle-chevron {
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px 8px;
    margin-left: 12px;
  }
  .expand-toggle-chevron:hover {
    color: var(--text-secondary);
  }
  .expanded-authors {
    display: flex;
    flex-direction: column;
    padding: 4px 0;
  }
  .expanded-author-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 5px 0;
    text-decoration: none;
    color: inherit;
    border-radius: 6px;
  }
  .expanded-author-row:hover {
    background: var(--bg-hover);
  }
  .expanded-author-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .expanded-author-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }
  .expanded-author-handle {
    font-size: 12px;
    color: var(--text-muted);
  }
</style>
