<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query'
  import { storyQuery } from '$lib/queries'
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import CommentSheet from '$lib/components/organisms/CommentSheet.svelte'
  import FavoriteButton from '$lib/components/molecules/FavoriteButton.svelte'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'
  import { MapPin, MessageCircle, Send } from 'lucide-svelte'
  import { share } from '$lib/utils/share'
  import { requireAuth } from '$lib/stores'
  import Toast from '$lib/components/atoms/Toast.svelte'
  import type { StoryView } from '$hatk/client'

  let { data } = $props()

  const storyUri = $derived(data.storyUri)
  const storyQ = createQuery(() => storyQuery(storyUri))
  const story = $derived((storyQ.data as StoryView) ?? null)
  const bskyUrl = $derived((story as any)?.crossPost?.url ?? null)
  const commentCount = $derived(story?.commentCount ?? 0)

  let commentSheetOpen = $state(false)
  let showToast = $state(false)

  async function handleShare() {
    const url = `${window.location.origin}/profile/${data.did}/story/${data.rkey}`
    const result = await share(url)
    if (result.success && result.method === 'clipboard') {
      showToast = true
    }
  }
</script>

<OGMeta
  title={story ? `Story by @${story.creator.handle} — Grain` : 'Story — Grain'}
  description="Photo story on Grain"
  image="/og/profile/{data.did}/story/{data.rkey}"
/>
<DetailHeader label="Story">
  {#snippet actions()}
    {#if bskyUrl}
      <a class="bsky-link" href={bskyUrl} target="_blank" rel="noopener noreferrer" title="View on Bluesky">
        <svg width="18" height="18" viewBox="0 0 568 501" fill="currentColor"><path d="M123.121 33.664C188.241 82.553 258.281 181.68 284 234.873c25.719-53.192 95.759-152.32 160.879-201.21C491.866-1.611 568-28.906 568 57.947c0 17.346-9.945 145.713-15.778 166.555-20.275 72.453-94.155 90.933-159.875 79.748C507.222 323.8 536.444 388.56 473.333 453.32c-119.86 122.992-172.272-30.859-185.702-70.281-2.462-7.227-3.614-10.608-3.631-7.733-.017-2.875-1.169.506-3.631 7.733-13.43 39.422-65.842 193.273-185.702 70.281-63.111-64.76-33.889-129.52 80.986-149.071-65.72 11.185-139.6-7.295-159.875-79.748C10.945 203.659 1 75.291 1 57.946 1-28.906 76.135-1.612 123.121 33.664Z"/></svg>
      </a>
    {/if}
  {/snippet}
</DetailHeader>
<div class="detail-page">
  {#if storyQ.isLoading}
    <p class="status">Loading...</p>
  {:else if !story}
    <p class="status">Story not found</p>
  {:else}
    <div class="story-card">
      <a class="creator" href="/profile/{story.creator.did}">
        {#if story.creator.avatar}
          <img class="avatar" src={story.creator.avatar} alt="" />
        {/if}
        <span class="name">{story.creator.displayName ?? story.creator.handle}</span>
        {#if story.creator.handle}
          <span class="handle">@{story.creator.handle}</span>
        {/if}
      </a>
      <div class="image-wrapper">
        <img
          src={story.fullsize}
          alt=""
          style="aspect-ratio: {story.aspectRatio.width}/{story.aspectRatio.height}"
        />
      </div>
      {#if story.location}
        <div class="location">
          <MapPin size={14} />
          <span>{story.locationDisplay ?? story.location.name ?? ''}</span>
        </div>
      {/if}
      {#if !story.expired}
        <div class="engagement">
          <FavoriteButton galleryUri={story.uri} viewerFav={story.viewer?.fav ?? null} favCount={0} />
          <button class="stat" type="button" onclick={() => requireAuth() && (commentSheetOpen = true)}>
            <MessageCircle size={20} />
            {#if commentCount > 0}<span class="stat-count">{commentCount}</span>{/if}
          </button>
          <button class="stat" type="button" onclick={handleShare} aria-label="Share">
            <Send size={20} />
          </button>
        </div>
      {/if}
      <time class="time">{new Date(story.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>
    </div>

    <CommentSheet
      open={commentSheetOpen}
      subjectUri={story.uri}
      onClose={() => { commentSheetOpen = false }}
    />

    <Toast message="Link copied" bind:visible={showToast} />
  {/if}
</div>

<style>
  .detail-page {
    max-width: 600px;
    margin: 0 auto;
  }
  .status {
    text-align: center;
    color: var(--text-muted);
    padding: 48px 16px;
    font-size: 14px;
  }
  .story-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
  }
  .creator {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    color: var(--text-primary);
  }
  .avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
  }
  .name {
    font-weight: 600;
    font-size: 15px;
  }
  .handle {
    color: var(--text-muted);
    font-size: 13px;
  }
  .image-wrapper img {
    width: 100%;
    object-fit: contain;
    background: var(--bg-hover);
  }
  .location {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--text-secondary);
    font-size: 13px;
  }
  .engagement {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .stat {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
    padding: 0;
    font-family: inherit;
    font-size: 13px;
    transition: opacity 0.15s;
  }
  .stat:hover { opacity: 0.7; }
  .stat-count { color: var(--text-secondary); }
  .time {
    color: var(--text-muted);
    font-size: 13px;
  }
  .bsky-link {
    color: var(--text-muted);
    display: flex;
    align-items: center;
    padding: 4px;
    transition: color 0.15s;
  }
  .bsky-link:hover {
    color: #0085ff;
  }
</style>
