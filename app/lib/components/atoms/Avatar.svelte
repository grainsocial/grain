<script lang="ts">
  import { blobUrl, initials } from '$lib/utils'

  let {
    did,
    blob = null,
    src = null,
    name = null,
    size = 34,
    hasStory = false,
    onclick = undefined,
  }: {
    did: string
    blob?: unknown
    src?: string | null
    name?: string | null
    size?: number
    hasStory?: boolean
    onclick?: (() => void) | undefined
  } = $props()

  const url = $derived(src || blobUrl(did, blob))
  const fallback = $derived(name?.[0]?.toUpperCase() || initials(did))
  let imgError = $state(false)
  $effect(() => { void url; imgError = false })
  const innerSize = $derived(hasStory ? size - 6 : size)
  const fontSize = $derived(Math.round(innerSize * 0.35))
</script>

{#snippet avatarContent()}
  {#if url && !imgError}
    <img src={url} alt="" class="avatar" style="width:{innerSize}px;height:{innerSize}px;" loading="lazy" onerror={() => (imgError = true)} />
  {:else}
    <div class="avatar fallback" style="width:{innerSize}px;height:{innerSize}px;font-size:{fontSize}px;">{fallback}</div>
  {/if}
{/snippet}

{#if onclick}
  <button type="button" class="avatar-btn" class:story-ring={hasStory} style="width:{size}px;height:{size}px;" onclick={onclick}>
    {@render avatarContent()}
  </button>
{:else}
  <span class="avatar-wrap" class:story-ring={hasStory} style="width:{size}px;height:{size}px;">
    {@render avatarContent()}
  </span>
{/if}

<style>
  .avatar {
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }
  .fallback {
    background: linear-gradient(135deg, var(--grain), var(--grain-dim));
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-display);
    font-weight: 700;
    color: #000;
  }
  .avatar-btn {
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    border-radius: 50%;
    line-height: 0;
  }
  .avatar-btn:hover { transform: scale(1.08); }
  .avatar-wrap {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    line-height: 0;
  }
  .story-ring {
    background: linear-gradient(135deg, #c97cf8, var(--grain), #5bf0d6);
    padding: 2px;
  }
</style>
