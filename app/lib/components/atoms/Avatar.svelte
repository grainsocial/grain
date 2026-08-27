<script lang="ts">
  import { blobUrl, initials } from '$lib/utils'

  let {
    did,
    blob = null,
    src = null,
    name = null,
    size = undefined,
    hasStory = false,
    onclick = undefined,
  }: {
    did: string
    blob?: unknown
    src?: string | null
    name?: string | null
    /** Fixed pixel size. Omit to inherit `--avatar-size` from an ancestor,
        which is how a caller makes the avatar responsive without JS. */
    size?: number | undefined
    hasStory?: boolean
    onclick?: (() => void) | undefined
  } = $props()

  const url = $derived(src || blobUrl(did, blob))
  const fallback = $derived(name?.[0]?.toUpperCase() || initials(did))
  let imgError = $state(false)
  $effect(() => { void url; imgError = false })

  // Only pin the size when one was given; otherwise inherit.
  const sizeVar = $derived(size === undefined ? undefined : `--avatar-size:${size}px`)
</script>

{#snippet avatarContent()}
  <span class="ring-inner">
    {#if url && !imgError}
      <img src={url} alt="" class="avatar" loading="lazy" onerror={() => (imgError = true)} />
    {:else}
      <span class="avatar fallback">{fallback}</span>
    {/if}
  </span>
{/snippet}

{#if onclick}
  <button type="button" class="avatar-btn" class:story-ring={hasStory} style={sizeVar} {onclick}>
    {@render avatarContent()}
  </button>
{:else}
  <span class="avatar-wrap" class:story-ring={hasStory} style={sizeVar}>
    {@render avatarContent()}
  </span>
{/if}

<style>
  /* Size comes from CSS, not JS. A caller that needs a responsive avatar sets
     --avatar-size in a media query on an ancestor; nothing has to wait for the
     client to measure the viewport, so the server renders the right size. */
  .avatar-btn,
  .avatar-wrap {
    width: var(--avatar-size, 34px);
    height: var(--avatar-size, 34px);
    border-radius: 50%;
    line-height: 0;
    display: inline-flex;
    flex: none;
    padding: 0;
    border: none;
    background: none;
  }
  .avatar-btn { cursor: pointer; }
  .avatar-btn:hover { opacity: 0.85; }

  .ring-inner {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    display: flex;
    padding: 0;
  }
  .avatar {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    flex: none;
  }
  .fallback {
    background: linear-gradient(135deg, var(--grain), var(--grain-dim));
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-display);
    font-weight: 700;
    color: #000;
    /* Tracks the avatar rather than a JS-computed inner size. */
    font-size: calc(var(--avatar-size, 34px) * 0.32);
  }

  /* Band ~3% of the diameter, gap ~3.7%, leaving the photo around 87%.
     Derived from --avatar-size with calc(): percentage padding would resolve
     against the containing block, not the avatar, and blow up inside a wide
     parent. The 2px floors keep small avatars from losing the ring entirely. */
  .story-ring {
    background: linear-gradient(135deg, #c97cf8, var(--grain), #5bf0d6);
    padding: max(2px, calc(var(--avatar-size, 34px) * 0.03));
  }
  .story-ring .ring-inner {
    background: var(--bg-root);
    padding: max(2px, calc(var(--avatar-size, 34px) * 0.037));
  }
</style>
