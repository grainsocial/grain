<script lang="ts">
  import type { Snippet } from 'svelte'

  let {
    onRefresh,
    children,
  }: {
    onRefresh: () => Promise<void>
    children: Snippet
  } = $props()

  let refreshing = $state(false)
  let pullY = $state(0)
  let pulling = $state(false)
  let startY = 0

  function onTouchStart(e: TouchEvent) {
    const scroller = document.querySelector('main.col-center')
    if (scroller && scroller.scrollTop === 0) {
      startY = e.touches[0].clientY
      pulling = true
    }
  }

  function onTouchMove(e: TouchEvent) {
    if (!pulling) return
    const dy = e.touches[0].clientY - startY
    if (dy > 0) {
      pullY = Math.min(dy * 0.4, 80)
    } else {
      pullY = 0
    }
  }

  async function onTouchEnd() {
    if (!pulling) return
    pulling = false
    if (pullY >= 50) {
      refreshing = true
      pullY = 50
      await onRefresh()
      refreshing = false
    }
    pullY = 0
  }
</script>

{#if pullY > 0 || refreshing}
  <div class="pull-pill" style:transform="translateY({pullY - 36}px)" style:opacity={Math.min(pullY / 40, 1)}>
    <svg class="pull-spinner" class:spinning={refreshing} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  </div>
{/if}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  ontouchstart={onTouchStart}
  ontouchmove={onTouchMove}
  ontouchend={onTouchEnd}
>
  {@render children()}
</div>

<style>
  .pull-pill {
    position: fixed;
    top: 0;
    left: 50%;
    translate: -50% 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--bg-elevated);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    color: var(--text-secondary);
    pointer-events: none;
    transition: transform 0.2s ease, opacity 0.15s ease;
  }
  .pull-spinner.spinning {
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
