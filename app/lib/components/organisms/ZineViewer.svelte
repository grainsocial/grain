<script lang="ts">
  import { ChevronLeft, ChevronRight } from 'lucide-svelte'
  import type { Zine } from '$lib/zines'

  let { zine }: { zine: Zine } = $props()

  let pageIdx = $state(0)
  const total = $derived(zine.pages.length)
  const canPrev = $derived(pageIdx > 0)
  const canNext = $derived(pageIdx < total - 1)

  function prev() { if (canPrev) pageIdx -= 1 }
  function next() { if (canNext) pageIdx += 1 }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') prev()
    if (e.key === 'ArrowRight') next()
  }

  // Swipe handling
  let touchStartX = 0
  let touchStartY = 0
  function onTouchStart(e: TouchEvent) {
    touchStartX = e.touches[0].clientX
    touchStartY = e.touches[0].clientY
  }
  function onTouchEnd(e: TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX
    const dy = e.changedTouches[0].clientY - touchStartY
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) next()
      else prev()
    }
  }

  const page = $derived(zine.pages[pageIdx])
</script>

<svelte:window on:keydown={onKey} />

<div
  class="viewer"
  ontouchstart={onTouchStart}
  ontouchend={onTouchEnd}
  role="presentation"
>
  <div class="header">
    <span class="title">{zine.title || 'Untitled zine'}</span>
    <span class="counter">{pageIdx + 1} / {total}</span>
  </div>

  <div class="stage">
    <button class="nav left" onclick={prev} disabled={!canPrev} aria-label="Previous page">
      <ChevronLeft size={28} />
    </button>

    <div class="page-frame">
      {#if page}
        {#key page.id}
          <div class="page">
            {#each page.elements as el (el.id)}
              <div
                class="el"
                style="left:{el.x}%;top:{el.y}%;width:{el.w}%;height:{el.h}%"
              >
                {#if el.type === 'photo'}
                  <img src={el.src} alt={el.alt ?? ''} />
                {:else}
                  <div
                    class="text"
                    style="font-size:{(el.fontSize ?? 18) * 0.9}px;text-align:{el.align ?? 'left'};font-weight:{el.weight === 'bold' ? 700 : 400}"
                  >{el.text}</div>
                {/if}
              </div>
            {/each}
          </div>
        {/key}
      {/if}
    </div>

    <button class="nav right" onclick={next} disabled={!canNext} aria-label="Next page">
      <ChevronRight size={28} />
    </button>
  </div>

  <div class="dots">
    {#each zine.pages as p, i (p.id)}
      <button
        class="dot"
        class:active={i === pageIdx}
        onclick={() => (pageIdx = i)}
        aria-label={`Go to page ${i + 1}`}
      ></button>
    {/each}
  </div>
</div>

<style>
  .viewer {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: #0a0a0a;
    color: #f0f0f0;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 20px;
    font-size: 14px;
    color: var(--text-muted, #888);
  }
  .title { font-weight: 600; color: #f0f0f0; }
  .counter { font-variant-numeric: tabular-nums; }

  .stage {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 0 16px 16px;
    min-height: 0;
  }
  .page-frame {
    position: relative;
    width: min(520px, 100%);
    aspect-ratio: 3 / 4;
    max-height: calc(100vh - 140px);
  }
  .page {
    position: absolute;
    inset: 0;
    background: #fff;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    overflow: hidden;
    color: #111;
    animation: fade 0.2s ease;
  }
  @keyframes fade {
    from { opacity: 0.4; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .el { position: absolute; }
  .el img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .text { width: 100%; height: 100%; line-height: 1.3; white-space: pre-wrap; }

  .nav {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(255,255,255,0.08);
    color: #fff;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }
  .nav:hover:not(:disabled) { background: rgba(255,255,255,0.16); }
  .nav:disabled { opacity: 0.3; cursor: default; }

  .dots {
    display: flex;
    justify-content: center;
    gap: 6px;
    padding: 12px 0 24px;
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: rgba(255,255,255,0.2);
    border: none;
    padding: 0;
    cursor: pointer;
    transition: background 0.15s, transform 0.15s;
  }
  .dot.active { background: #fff; transform: scale(1.3); }

  @media (max-width: 640px) {
    .nav { display: none; }
    .stage { padding: 0 8px 8px; }
  }
</style>
