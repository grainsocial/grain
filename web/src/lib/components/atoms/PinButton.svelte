<script lang="ts">
  import { Pin, PinOff } from 'lucide-svelte'
  import { pinnedFeeds, pinFeed, unpinFeed, type PinnedFeed } from '$lib/preferences'

  let { feed, stopPropagation = false }: { feed: PinnedFeed; stopPropagation?: boolean } = $props()

  const pinned = $derived($pinnedFeeds.some((f) => f.id === feed.id))
</script>

<button
  class="pin-btn"
  class:pinned
  title={pinned ? 'Unpin feed' : 'Pin feed'}
  onclick={(e) => { if (stopPropagation) { e.preventDefault(); e.stopPropagation() } pinned ? unpinFeed(feed.id) : pinFeed(feed) }}
>
  {#if pinned}<PinOff size={16} />{:else}<Pin size={16} />{/if}
</button>

<style>
  .pin-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    background: none;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s;
  }
  .pin-btn.pinned { color: var(--grain); }
  .pin-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
</style>
