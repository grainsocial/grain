<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query'
  import { Plus } from 'lucide-svelte'
  import { storyAuthorsQuery } from '$lib/queries'
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
  const otherAuthors = $derived(authors.data?.filter((a) => a.profile.did !== viewerDid) ?? [])

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
          <div class="avatar-wrapper" class:ring={!!ownAuthor}>
            {#if viewerAvatar}
              <img src={viewerAvatar} alt="Your story" />
            {:else}
              <div class="avatar-placeholder"></div>
            {/if}
            <div class="plus-badge"><Plus size={12} strokeWidth={3} /></div>
          </div>
          <span class="label">Your story</span>
        </button>
      </div>
    {/if}
    {#each otherAuthors as author (author.profile.did)}
      <button class="story-circle" onclick={() => onViewStory(author.profile.did)}>
        <div class="avatar-wrapper ring">
          {#if author.profile.avatar}
            <img src={author.profile.avatar} alt={author.profile.displayName ?? author.profile.handle} />
          {:else}
            <div class="avatar-placeholder"></div>
          {/if}
        </div>
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
    padding: 12px 16px;
    overflow-x: auto;
    border-bottom: 1px solid var(--border);
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
  .avatar-wrapper {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    overflow: visible;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-elevated);
    position: relative;
  }
  .avatar-wrapper.ring {
    background: linear-gradient(135deg, #c97cf8, var(--grain), #5bf0d6);
    padding: 2px;
  }
  .avatar-wrapper img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
  }
  .avatar-placeholder {
    width: 100%;
    height: 100%;
    background: var(--bg-hover);
    border-radius: 50%;
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
    border: 2px solid var(--bg);
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
    font-size: 11px;
    color: var(--text-secondary);
    max-width: 64px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font-body);
  }
</style>
