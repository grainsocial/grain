<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query'
  import { Plus } from 'lucide-svelte'
  import Avatar from '../atoms/Avatar.svelte'
  import { storyAuthorsQuery } from '$lib/queries'
  import { isCaughtUp } from '$lib/stories'
  import { isAuthenticated, viewer } from '$lib/stores'

  let {
    onCreateStory,
    onViewStory,
  }: {
    onCreateStory: () => void
    onViewStory: (did: string) => void
  } = $props()

  const authors = createQuery(() => storyAuthorsQuery())

  const viewerDid = $derived($viewer?.did)
  const viewerAvatar = $derived($viewer?.avatar)
  const ownAuthor = $derived(authors.data?.find((a) => a.profile.did === viewerDid))
  // Unwatched authors first, each group in the server's newest-first order,
  // so what is left to watch sits at the front of the strip.
  const otherAuthors = $derived.by(() => {
    const others = authors.data?.filter((a) => a.profile.did !== viewerDid) ?? []
    return [...others.filter((a) => !isCaughtUp(a)), ...others.filter((a) => isCaughtUp(a))]
  })

  let menuOpen = $state(false)
  let menuAnchor = $state<HTMLButtonElement | undefined>()
  let menuX = $state(0)
  let menuY = $state(0)

  function handleOwnTap() {
    if (ownAuthor) {
      if (menuAnchor) {
        const rect = menuAnchor.getBoundingClientRect()
        menuX = rect.left
        menuY = rect.bottom + 4
      }
      menuOpen = !menuOpen
    } else {
      onCreateStory()
    }
  }

  function handleMenuCreate() {
    menuOpen = false
    onCreateStory()
  }

  function handleMenuView() {
    menuOpen = false
    if (viewerDid) onViewStory(viewerDid)
  }
</script>

<svelte:window onclick={() => { if (menuOpen) menuOpen = false }} />

{#if $isAuthenticated || otherAuthors.length > 0}
  <div class="story-strip">
    {#if $isAuthenticated}
      <div class="own-story-wrapper">
        <button class="story-circle" bind:this={menuAnchor} onclick={(e) => { e.stopPropagation(); handleOwnTap() }}>
          <span class="avatar-slot">
            <Avatar
              did={viewerDid ?? ''}
              src={viewerAvatar}
              name={$viewer?.displayName || $viewer?.handle}
              size={68}
              hasStory={!!ownAuthor}
            />
            <span class="plus-badge"><Plus size={12} strokeWidth={3} /></span>
          </span>
          <span class="label">Your story</span>
        </button>
      </div>
    {/if}
    {#each otherAuthors as author (author.profile.did)}
      <button class="story-circle" onclick={() => onViewStory(author.profile.did)}>
        <Avatar
          did={author.profile.did}
          src={author.profile.avatar ?? null}
          name={author.profile.displayName ?? author.profile.handle}
          size={68}
          hasStory
          storyViewed={isCaughtUp(author)}
        />
        <span class="label">{author.profile.displayName ?? author.profile.handle}</span>
      </button>
    {/each}
  </div>
{/if}

{#if menuOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="own-menu" role="menu" tabindex="-1" style="left: {menuX}px; top: {menuY}px;" onclick={(e) => e.stopPropagation()}>
    <button class="menu-item" onclick={handleMenuCreate}>Create story</button>
    <button class="menu-item" onclick={handleMenuView}>View your story</button>
  </div>
{/if}

<style>
  .story-strip {
    display: flex;
    gap: 12px;
    padding: 12px 0;
    overflow-x: auto;
    margin-bottom: 8px;
    scrollbar-width: none;
  }
  .story-strip::-webkit-scrollbar { display: none; }
  .story-circle {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
  }
  .avatar-slot {
    position: relative;
    display: inline-flex;
  }
  .plus-badge {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--grain-btn);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid var(--bg-root);
  }
  .own-story-wrapper {
    position: relative;
    flex-shrink: 0;
  }
  .own-menu {
    position: fixed;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    z-index: 10;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    min-width: 150px;
  }
  .menu-item {
    display: block;
    width: 100%;
    padding: 10px 14px;
    font-size: 14px;
    font-family: var(--font-body);
    color: var(--text-primary);
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
  }
  .menu-item:not(:last-child) {
    border-bottom: 1px solid var(--border);
  }
  .menu-item:hover {
    background: var(--bg-hover);
  }
  .label {
    font-size: 12px;
    color: var(--text-secondary);
    max-width: 76px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font-body);
  }

  @media (max-width: 600px) {
    .story-strip { padding-left: 12px; padding-right: 12px; }
  }
</style>
