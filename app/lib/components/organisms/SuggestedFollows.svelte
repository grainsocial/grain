<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query'
  import { callXrpc } from '$hatk/client'
  import { viewer } from '$lib/stores'
  import Avatar from '../atoms/Avatar.svelte'
  import FollowButton from '../molecules/FollowButton.svelte'
  import { X } from 'lucide-svelte'

  type SuggestedProfile = {
    did: string
    handle: string
    displayName?: string
    description?: string
    avatar?: string
    followersCount?: number
  }

  let dismissedDids = $state<Set<string>>(new Set())
  let followedDids = $state<Set<string>>(new Set())

  const suggestions = createQuery(() => ({
    queryKey: ['suggestedFollows', $viewer?.did],
    queryFn: () => callXrpc('social.grain.unspecced.getSuggestedFollows', { actor: $viewer!.did, limit: 10 }),
    enabled: !!$viewer?.did,
    staleTime: 5 * 60_000,
  }))

  const visibleItems = $derived(
    ((suggestions.data as any)?.items as SuggestedProfile[] ?? [])
      .filter((p) => !dismissedDids.has(p.did) && !followedDids.has(p.did))
  )

  function dismiss(did: string) {
    dismissedDids = new Set([...dismissedDids, did])
  }

  function onFollowed(did: string) {
    followedDids = new Set([...followedDids, did])
  }
</script>

{#if visibleItems.length > 0}
  <div class="suggested-strip">
    <div class="strip-header">
      <span class="strip-title">Suggested for you</span>
    </div>
    <div class="strip-scroll">
      {#each visibleItems as profile (profile.did)}
        <div class="suggestion-card">
          <button class="dismiss-btn" onclick={() => dismiss(profile.did)} aria-label="Dismiss">
            <X size={14} />
          </button>
          <a href="/profile/{profile.did}" class="card-link">
            <Avatar did={profile.did} src={profile.avatar ?? null} name={profile.displayName} size={64} />
            <span class="card-name">{profile.displayName || profile.handle}</span>
            {#if profile.description}
              <span class="card-desc">{profile.description}</span>
            {/if}
          </a>
          <FollowButton did={profile.did} onCountChange={(d) => { if (d > 0) onFollowed(profile.did) }} />
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .suggested-strip {
    border-bottom: 1px solid var(--border);
    padding: 16px 0;
  }
  .strip-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px 12px;
  }
  .strip-title {
    font-weight: 600;
    font-size: 15px;
  }
  .strip-scroll {
    display: flex;
    gap: 12px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scroll-padding-inline: 16px;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .strip-scroll::-webkit-scrollbar { display: none; }
  .strip-scroll::before,
  .strip-scroll::after {
    content: '';
    flex: 0 0 16px;
  }
  .suggestion-card {
    flex: 0 0 170px;
    scroll-snap-align: start;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 16px 12px 12px;
    border: 1px solid var(--border);
    border-radius: 12px;
    position: relative;
    text-align: center;
  }
  .dismiss-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: color 0.15s, background 0.15s;
  }
  .dismiss-btn:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
  }
  .card-link {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    color: inherit;
    width: 100%;
  }
  .card-name {
    font-weight: 600;
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
  .card-desc {
    font-size: 12px;
    color: var(--text-secondary);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.3;
    min-height: 31px;
  }
</style>
