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

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  ontouchstart={onTouchStart}
  ontouchmove={onTouchMove}
  ontouchend={onTouchEnd}
>

{#if pullY > 0 || refreshing}
  <div class="pull-indicator" style:height="{pullY}px">
    <svg class="pull-spinner" class:spinning={refreshing} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  </div>
{/if}

{@render children()}

</div>

<style>
  .pull-indicator {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 8px;
    color: var(--text-muted);
    overflow: hidden;
    transition: height 0.2s ease;
  }
  .pull-spinner {
    transition: transform 0.2s;
  }
  .pull-spinner.spinning {
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
