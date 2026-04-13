<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query'
  import type { GrainActorDefsProfileViewDetailed, GetKnownFollowersFollowerItem } from '$hatk/client'
  import { actorProfileQuery, knownFollowersQuery } from '$lib/queries'
  import { viewer } from '$lib/stores'
  import Avatar from '../atoms/Avatar.svelte'
  import FollowButton from './FollowButton.svelte'

  let {
    did,
    children,
  }: {
    did: string
    children: import('svelte').Snippet
  } = $props()

  let hovering = $state(false)
  let hoverTimer: ReturnType<typeof setTimeout> | null = null
  let leaveTimer: ReturnType<typeof setTimeout> | null = null
  let shouldFetch = $state(false)

  const isOwnProfile = $derived($viewer?.did === did)

  const profile = createQuery(() => ({
    ...actorProfileQuery(did, $viewer?.did),
    enabled: shouldFetch,
  }))

  const knownFollowers = createQuery(() => ({
    ...knownFollowersQuery(did, $viewer?.did ?? ''),
    enabled: shouldFetch && !!$viewer?.did && !isOwnProfile,
  }))

  const p = $derived(profile.data as GrainActorDefsProfileViewDetailed | undefined)
  const knownList = $derived(
    ((knownFollowers.data as { items?: GetKnownFollowersFollowerItem[] } | undefined)?.items) ?? []
  )
  const followedBy = $derived(p?.viewer?.followedBy)
  const viewerFollow = $derived(p?.viewer?.following ?? null)

  function handleEnter() {
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null }
    hoverTimer = setTimeout(() => {
      shouldFetch = true
      hovering = true
    }, 300)
  }

  function handleLeave() {
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null }
    leaveTimer = setTimeout(() => {
      hovering = false
    }, 200)
  }

  function formatCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return String(n)
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<span
  class="popover-trigger"
  onmouseenter={handleEnter}
  onmouseleave={handleLeave}
  onfocusin={handleEnter}
  onfocusout={handleLeave}
>
  {@render children()}
  {#if hovering && p}
    <div class="popover" onmouseenter={handleEnter} onmouseleave={handleLeave}>
      <div class="popover-header">
        <a href="/profile/{p.did}" class="popover-avatar-link">
          <Avatar did={p.did} src={p.avatar ?? null} size={48} />
        </a>
        {#if !isOwnProfile && $viewer}
          <FollowButton did={p.did} {viewerFollow} />
        {/if}
      </div>

      <a href="/profile/{p.did}" class="popover-name-link">
        <span class="popover-name">{p.displayName || p.handle || p.did}</span>
      </a>

      <div class="popover-meta">
        {#if p.handle}
          <span class="popover-handle">@{p.handle}</span>
        {/if}
        {#if followedBy}
          <span class="follows-you">Follows you</span>
        {/if}
      </div>

      {#if p.description}
        <p class="popover-bio">{p.description}</p>
      {/if}

      <div class="popover-stats">
        <a href="/profile/{p.did}/followers" class="stat-link">
          <strong>{formatCount(p.followersCount ?? 0)}</strong> <span>followers</span>
        </a>
        <a href="/profile/{p.did}/following" class="stat-link">
          <strong>{formatCount(p.followsCount ?? 0)}</strong> <span>following</span>
        </a>
        {#if (p.galleryCount ?? 0) > 0}
          <a href="/profile/{p.did}" class="stat-link">
            <strong>{formatCount(p.galleryCount ?? 0)}</strong> <span>galleries</span>
          </a>
        {/if}
      </div>

      {#if knownList.length > 0}
        <div class="known-followers">
          <div class="known-avatars">
            {#each knownList.slice(0, 3) as kf}
              <Avatar did={kf.did} src={kf.avatar ?? null} size={18} />
            {/each}
          </div>
          <span class="known-text">
            Followed by {knownList.slice(0, 2).map((kf) => kf.displayName || kf.handle).join(', ')}
            {#if knownList.length > 2}
              and {knownList.length - 2} other{knownList.length - 2 === 1 ? '' : 's'} you follow
            {/if}
          </span>
        </div>
      {/if}
    </div>
  {/if}
</span>

<style>
  .popover-trigger {
    position: relative;
    display: inline-flex;
    min-width: 0;
  }

  .popover {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 100;
    margin-top: 8px;
    width: 300px;
    background: var(--bg-root);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
    cursor: default;
  }
  @media (max-width: 600px) {
    .popover { display: none; }
  }

  .popover-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .popover-avatar-link {
    text-decoration: none;
    color: inherit;
  }

  .popover-name-link {
    text-decoration: none;
    color: inherit;
  }
  .popover-name-link:hover .popover-name {
    text-decoration: underline;
  }

  .popover-name {
    font-weight: 700;
    font-size: 15px;
    color: var(--text-primary);
  }

  .popover-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 1px;
  }

  .popover-handle {
    font-size: 13px;
    color: var(--text-muted);
  }

  .follows-you {
    font-size: 11px;
    color: var(--text-muted);
    background: var(--bg-elevated);
    padding: 1px 6px;
    border-radius: 4px;
  }

  .popover-bio {
    margin: 8px 0 0;
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .popover-stats {
    display: flex;
    gap: 12px;
    margin-top: 10px;
    font-size: 13px;
  }

  .stat-link {
    text-decoration: none;
    color: var(--text-secondary);
  }
  .stat-link:hover {
    text-decoration: underline;
  }
  .stat-link strong {
    color: var(--text-primary);
    font-weight: 700;
  }

  .known-followers {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--border);
  }

  .known-avatars {
    display: flex;
    flex-shrink: 0;
  }
  .known-avatars :global(> *:not(:first-child)) {
    margin-left: -4px;
  }

  .known-text {
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.3;
  }
</style>
