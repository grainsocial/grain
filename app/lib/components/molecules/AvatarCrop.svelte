<script lang="ts">
  import Button from '$lib/components/atoms/Button.svelte'

  let {
    src,
    onCrop,
    onCancel,
  }: {
    src: string
    onCrop: (dataUrl: string) => void
    onCancel: () => void
  } = $props()

  const FRAME = 280
  const OUTPUT = 1000

  let img: HTMLImageElement | null = $state(null)
  let naturalW = $state(0)
  let naturalH = $state(0)

  // scale = pixels-per-natural-pixel so that the image fills the frame
  let scale = $state(1)
  let minScale = $state(1)

  // tx, ty = offset of image center from frame center, in screen pixels
  let tx = $state(0)
  let ty = $state(0)

  let dragging = $state(false)
  let dragStart = $state({ x: 0, y: 0, tx: 0, ty: 0 })

  function onImageLoad(e: Event) {
    const el = e.target as HTMLImageElement
    img = el
    naturalW = el.naturalWidth
    naturalH = el.naturalHeight

    // Scale so the shorter side fills the frame
    const fit = FRAME / Math.min(naturalW, naturalH)
    minScale = fit
    scale = fit
    tx = 0
    ty = 0
  }

  // Rendered dimensions
  const renderW = $derived(naturalW * scale)
  const renderH = $derived(naturalH * scale)

  function clamp() {
    // How far the image center can move from the frame center
    // while still covering the entire frame
    const maxTx = Math.max(0, (renderW - FRAME) / 2)
    const maxTy = Math.max(0, (renderH - FRAME) / 2)
    tx = Math.max(-maxTx, Math.min(maxTx, tx))
    ty = Math.max(-maxTy, Math.min(maxTy, ty))
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault()
    scale = Math.max(minScale, Math.min(minScale * 4, scale - e.deltaY * 0.002))
    clamp()
  }

  function onSliderInput() {
    clamp()
  }

  function onPointerDown(e: PointerEvent) {
    dragging = true
    dragStart = { x: e.clientX, y: e.clientY, tx, ty }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return
    tx = dragStart.tx + (e.clientX - dragStart.x)
    ty = dragStart.ty + (e.clientY - dragStart.y)
    clamp()
  }

  function onPointerUp() {
    dragging = false
  }

  // The image top-left position relative to the frame top-left
  const imgLeft = $derived(FRAME / 2 - renderW / 2 + tx)
  const imgTop = $derived(FRAME / 2 - renderH / 2 + ty)

  function doCrop() {
    if (!img) return
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT
    canvas.height = OUTPUT

    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, OUTPUT, OUTPUT)

    // Map frame-space coordinates to output-space
    const outScale = OUTPUT / FRAME
    ctx.drawImage(
      img,
      imgLeft * outScale,
      imgTop * outScale,
      renderW * outScale,
      renderH * outScale,
    )

    onCrop(canvas.toDataURL('image/jpeg', 0.9))
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') onCancel()
    if (e.key === 'Enter') doCrop()
  }
</script>

<svelte:window on:keydown={onKeyDown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="crop-overlay" onclick={onCancel}>
  <div class="crop-modal" onclick={(e) => e.stopPropagation()}>
    <div
      class="crop-frame"
      style="width:{FRAME}px;height:{FRAME}px"
      onwheel={onWheel}
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
    >
      <img
        {src}
        alt="Crop preview"
        class="crop-img"
        style="width:{renderW}px;height:{renderH}px;left:{imgLeft}px;top:{imgTop}px"
        onload={onImageLoad}
        draggable="false"
      />
      <div class="crop-ring"></div>
    </div>

    <input
      type="range"
      class="zoom-slider"
      min={minScale}
      max={minScale * 4}
      step={0.001}
      bind:value={scale}
      oninput={onSliderInput}
    />

    <div class="crop-actions">
      <Button variant="secondary" onclick={onCancel}>Cancel</Button>
      <Button onclick={doCrop}>Apply</Button>
    </div>
  </div>
</div>

<style>
  .crop-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    z-index: 300;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .crop-modal {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }
  .crop-frame {
    position: relative;
    overflow: hidden;
    border-radius: 50%;
    cursor: grab;
    touch-action: none;
    background: #000;
  }
  .crop-frame:active { cursor: grabbing; }
  .crop-img {
    position: absolute;
    pointer-events: none;
    user-select: none;
  }
  .crop-ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.5);
    pointer-events: none;
  }
  .zoom-slider {
    width: 200px;
    accent-color: var(--grain);
  }
  .crop-actions {
    display: flex;
    gap: 12px;
  }
</style>
