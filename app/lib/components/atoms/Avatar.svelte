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
  const fallback = $derived(name?.[0]?.toUpperCase() || (did ? initials(did) : ''))
  let loaded = $state(false)
  let imgError = $state(false)
  let imgEl: HTMLImageElement | undefined = $state(undefined)
  $effect(() => {
    void url
    loaded = false
    imgError = false
    // A cached image may have finished loading before hydration attached the
    // onload handler; if so, reveal it immediately instead of staying hidden.
    if (imgEl?.complete && imgEl.naturalWidth > 0) loaded = true
  })

  // Only pin the size when one was given; otherwise inherit.
  const sizeVar = $derived(size === undefined ? undefined : `--avatar-size:${size}px`)
</script>

{#snippet avatarContent()}
  <span class="ring-inner">
    <span class="avatar bg"></span>
    {#if url && !imgError}
      <img
        bind:this={imgEl}
        src={url}
        alt=""
        class="avatar img"
        class:loaded={loaded}
        loading="lazy"
        onload={() => (loaded = true)}
        onerror={() => (imgError = true)}
      />
    {:else}
      {#if fallback}
        <span class="avatar fallback">{fallback}</span>
      {/if}
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
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    display: flex;
    padding: 0;
    overflow: hidden;
  }
  .avatar {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    flex: none;
  }
  /* Neutral placeholder behind the image so first paint has no text or empty
     hole: the photo fades in over it once loaded. */
  .avatar.bg {
    background: linear-gradient(135deg, var(--grain), var(--grain-dim));
  }
  .avatar.img {
    position: absolute;
    inset: 0;
    opacity: 0;
    transition: opacity 0.15s ease;
  }
  .avatar.img.loaded {
    opacity: 1;
  }
  .fallback {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-display);
    font-weight: 700;
    color: var(--on-grain);
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
