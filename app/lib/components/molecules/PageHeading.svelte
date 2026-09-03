<script lang="ts">
  import type { Snippet } from 'svelte'
  import { ArrowLeft } from 'lucide-svelte'
  import { goto } from '$app/navigation'

  // The heading treatment /explore, /camera and /hashtags share: an action row
  // that scrolls away with the page, then a large display title. Pages that own
  // their own place in the nav leave `back` off — there is nothing to go back to.
  let {
    title,
    back = false,
    actions,
    onback,
  }: { title: string; back?: boolean; actions?: Snippet; onback?: () => void } = $props()

  function goBack() {
    if (window.history.length > 1) history.back()
    else goto('/')
  }
</script>

<header class="head">
  {#if back || actions}
    <div class="head-actions">
      {#if back}
        <button class="icon-btn" type="button" onclick={onback ?? goBack} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
      {:else}
        <span></span>
      {/if}
      {#if actions}{@render actions()}{/if}
    </div>
  {/if}
  <h1>{title}</h1>
</header>

<style>
  /* Inset belongs to the text, not the page: whatever follows a heading —
     a grid, a list — runs edge to edge beneath it. */
  .head {
    padding: 18px 16px 0;
  }
  .head-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }
  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    margin-left: -6px;
    border: none;
    border-radius: 50%;
    background: none;
    color: var(--text-primary);
    cursor: pointer;
  }
  .icon-btn:hover { background: var(--bg-hover); }
  h1 {
    font-family: var(--font-display);
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.015em;
    line-height: 1.15;
    margin: 0;
    overflow-wrap: anywhere;
  }

  @media (max-width: 600px) {
    h1 { font-size: 22px; }
  }
</style>
