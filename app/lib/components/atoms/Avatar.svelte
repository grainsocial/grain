<script lang="ts">
  import { blobUrl } from '$lib/utils'

  let {
    did,
    blob = null,
    src = null,
    name = null,
    size = undefined,
    hasStory = false,
    storyViewed = false,
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
    /** Grey ring: the story is there but has been watched. */
    storyViewed?: boolean
    onclick?: (() => void) | undefined
  } = $props()

  const url = $derived(src || blobUrl(did, blob))
  let imgError = $state(false)
  $effect(() => {
    void url
    imgError = false
  })

  // Only pin the size when one was given; otherwise inherit.
  const sizeVar = $derived(size === undefined ? undefined : `--avatar-size:${size}px`)
</script>

{#snippet avatarContent()}
  <span class="ring-inner">
    {#if url && !imgError}
      <img
        src={url}
        alt=""
        class="avatar img"
        loading="lazy"
        onerror={() => (imgError = true)}
      />
    {:else}
      <!-- No photo: a grey silhouette, as on iOS. Plenty of accounts have no
           avatar, and a letter made every one of them look like a brand badge. -->
      <span class="avatar fallback" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="8" r="4.5" />
          <path d="M3.5 21.5c0-4.6 3.8-7.8 8.5-7.8s8.5 3.2 8.5 7.8z" />
        </svg>
      </span>
    {/if}
  </span>
{/snippet}

{#if onclick}
  <button type="button" class="avatar-btn" class:story-ring={hasStory} class:viewed={hasStory && storyViewed} style={sizeVar} {onclick}>
    {@render avatarContent()}
  </button>
{:else}
  <span class="avatar-wrap" class:story-ring={hasStory} class:viewed={hasStory && storyViewed} style={sizeVar}>
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

  /* The layers share one grid cell rather than stacking with absolute
     positioning: `inset: 0` resolves against the padding box, so a loaded photo
     painted over the story ring's gap and only the fallback ever showed one. */
  .ring-inner {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    display: grid;
    padding: 0;
    overflow: hidden;
  }
  .avatar {
    grid-area: 1 / 1;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }
  /* The image is never hidden behind client state: the server renders it
     visible, the browser paints nothing until it has decoded, and the quiet
     grey behind it shows through in the meantime. A cached photo is there on
     the first frame with no wait for hydration. */
  .avatar.img {
    background: color-mix(in srgb, var(--text-secondary) 14%, var(--bg-surface));
  }
  .fallback {
    background: color-mix(in srgb, var(--text-secondary) 24%, var(--bg-surface));
    color: color-mix(in srgb, var(--text-secondary) 70%, var(--bg-surface));
    display: flex;
    align-items: center;
    justify-content: center;
  }
  /* Tracks the avatar rather than a JS-computed inner size. */
  .fallback svg {
    width: calc(var(--avatar-size, 34px) * 0.5);
    height: calc(var(--avatar-size, 34px) * 0.5);
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
  /* Watched to the end: the ring stays so the story is still reachable, but
     it drops to grey, matching the phone apps. */
  .story-ring.viewed {
    background: var(--text-secondary);
    opacity: 0.55;
  }
</style>
