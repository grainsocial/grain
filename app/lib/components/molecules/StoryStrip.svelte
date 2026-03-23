<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query'
  import { Plus } from 'lucide-svelte'
  import { storyAuthorsQuery } from '$lib/queries'
  import { isAuthenticated } from '$lib/stores'

  let {
    onCreateStory,
    onViewStory,
  }: {
    onCreateStory: () => void
    onViewStory: (did: string) => void
  } = $props()

  const authors = createQuery(() => storyAuthorsQuery())
</script>

{#if $isAuthenticated || (authors.data && authors.data.length > 0)}
  <div class="story-strip">
    {#if $isAuthenticated}
      <button class="story-circle create" onclick={onCreateStory}>
        <div class="avatar-wrapper">
          <div class="plus-icon"><Plus size={20} /></div>
        </div>
        <span class="label">Your story</span>
      </button>
    {/if}
    {#if authors.data}
      {#each authors.data as author (author.profile.did)}
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
    {/if}
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
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-elevated);
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
  .plus-icon {
    color: var(--grain);
  }
  .create .avatar-wrapper {
    border: 2px dashed var(--border);
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
