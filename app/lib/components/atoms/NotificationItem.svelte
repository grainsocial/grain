<script lang="ts">
  import Avatar from './Avatar.svelte'
  import Facepile from './Facepile.svelte'
  import { relativeTime, profilePath, galleryPath, storyPath } from '$lib/utils'
  import { viewer } from '$lib/stores'
  import type { GroupedNotification } from '$lib/notifications'

  let { group }: { group: GroupedNotification } = $props()

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
  // The rows that only mean something once you can see what was said.
  const showsComment = $derived(
    ['gallery-comment', 'story-comment', 'reply', 'gallery-comment-mention'].includes(notif.reason),
  )

  const action = $derived(reasonText[notif.reason] ?? '')
  const timeStr = $derived(relativeTime(notif.createdAt || ''))
  const thumb = $derived(notif.galleryThumb ?? notif.storyThumb ?? null)

  type Person = { did: string; handle?: string; displayName?: string; avatar?: string | null }
  const nameOf = (p: Person) => p.displayName || p.handle || p.did.slice(0, 18)

  // One entry per account, the primary author first.
  const people = $derived.by(() => {
    const all: Person[] = [notif.author, ...group.additional.map((n: any) => n.author)].filter(Boolean)
    const seen = new Set<string>()
    return all.filter((p) => !seen.has(p.did) && seen.add(p.did))
  })
  const named = $derived(people.slice(0, 2))
  const othersCount = $derived(group.authorCount - named.length)

  // A notification names the gallery by URI and never its owner's handle. The
  // owner is the viewer for most reasons (someone favorited or commented on
  // your gallery) and the author for a mention, so both handles are to hand;
  // anyone else is linked by DID, which the route accepts.
  function ownerOf(uri: string) {
    const did = uri.split('/')[2]
    if (did === $viewer?.did) return $viewer
    if (did === notif.author?.did) return notif.author
    return { did }
  }
  const contentHref = $derived(
    notif.galleryUri
      ? galleryPath({ uri: notif.galleryUri, creator: ownerOf(notif.galleryUri) })
      : notif.storyUri
        ? storyPath({ uri: notif.storyUri, creator: ownerOf(notif.storyUri) })
        : profilePath(notif.author),
  )
</script>

<div class="notif" role="group">
  {#if isGrouped}
    <div class="faces"><Facepile {people} size={28} overlap={10} /></div>
  {:else}
    <a class="face" href={profilePath(notif.author)}>
      <Avatar did={notif.author.did} src={notif.author.avatar ?? null} name={nameOf(notif.author)} size={34} />
    </a>
  {/if}
  <a class="body" href={contentHref}>
    <span class="line">
      {#each named as person, i (person.did)}
        <span class="name">{nameOf(person)}</span>{#if i < named.length - 1},{' '}{/if}
      {/each}
      {#if othersCount > 0}
        {' '}and {othersCount} {othersCount === 1 ? 'other' : 'others'}
      {/if}
      {' '}{action}
      <span class="time">{timeStr}</span>
    </span>
    {#if showsComment && notif.commentText}
      <span class="comment">{notif.commentText}</span>
    {/if}
  </a>
  {#if thumb}
    <a href={contentHref} class="thumb-link">
      <img src={thumb} alt="" class="thumb" loading="lazy" />
    </a>
  {/if}
</div>

<style>
  .notif {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    transition: background 0.12s;
  }
  .notif:hover {
    background: var(--bg-hover);
  }
  .face,
  .faces {
    flex-shrink: 0;
    display: flex;
    text-decoration: none;
  }
  /* Room for three overlapped faces, so text lines up across grouped and single rows. */
  .faces {
    width: 64px;
  }
  .body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    text-decoration: none;
    color: var(--text-primary);
    font-size: 13px;
    line-height: 1.4;
  }
  .name {
    font-weight: 600;
  }
  .face:hover ~ .body .name {
    text-decoration: underline;
  }
  .time {
    color: var(--text-muted);
    font-size: 12px;
    margin-left: 4px;
  }
  .comment {
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .thumb-link {
    flex-shrink: 0;
  }
  .thumb {
    display: block;
    width: 44px;
    height: 44px;
    object-fit: cover;
    border-radius: 6px;
  }
</style>
