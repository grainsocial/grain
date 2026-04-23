<script lang="ts">
  import { goto } from '$app/navigation'
  import {
    Plus,
    Trash2,
    Image as ImageIcon,
    Type,
    LayoutGrid,
    LoaderCircle,
  } from 'lucide-svelte'
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import Button from '$lib/components/atoms/Button.svelte'
  import Input from '$lib/components/atoms/Input.svelte'
  import {
    saveZine,
    blankPage,
    newElementId,
    computeSpreads,
    applyPreset,
    LAYOUT_PRESETS,
    type Zine,
    type ZinePage,
    type ZineElement,
    type LayoutPreset,
  } from '$lib/zines'

  let { zine: initialZine }: { zine: Zine } = $props()

  let zine = $state<Zine>(JSON.parse(JSON.stringify(initialZine)))
  let activeSpreadIdx = $state(0)
  let activePageIdxInSpread = $state(0) // 0 = left, 1 = right
  let selectedElementId = $state<string | null>(null)
  let addMenuOpen = $state(false)
  let layoutMenuOpen = $state(false)

  const spreads = $derived(computeSpreads(zine.pages))
  const activeSpread = $derived(spreads[activeSpreadIdx] ?? spreads[0])
  const activePageIndex = $derived(
    activeSpread?.pageIndices[activePageIdxInSpread] ?? activeSpread?.pageIndices[0] ?? 0,
  )
  const activePage = $derived(zine.pages[activePageIndex])

  // ── Mock photo library ────────────────────────────────────────────
  const MOCK_PHOTOS = Array.from({ length: 24 }, (_, i) => ({
    id: `mock-${i}`,
    src: `https://picsum.photos/seed/grain-${i}/600/800`,
    gallery: i % 3 === 0 ? 'Travel' : i % 3 === 1 ? 'Portraits' : 'Street',
  }))
  let galleryFilter = $state<string>('all')
  const galleries = ['all', 'Travel', 'Portraits', 'Street']
  const filteredPhotos = $derived(
    galleryFilter === 'all'
      ? MOCK_PHOTOS
      : MOCK_PHOTOS.filter((p) => p.gallery === galleryFilter),
  )

  // ── Canvas interaction ────────────────────────────────────────────
  // We track a separate page element for each visible page, keyed by pageIndex.
  let pageEls = $state<Record<number, HTMLDivElement>>({})

  type DragState = {
    pageIndex: number
    elementId: string
    mode: 'move' | 'resize-br'
    startX: number
    startY: number
    origX: number
    origY: number
    origW: number
    origH: number
  }
  let drag = $state<DragState | null>(null)

  function pageRect(pageIndex: number) {
    return pageEls[pageIndex]?.getBoundingClientRect() ?? new DOMRect()
  }

  function startDrag(
    e: PointerEvent,
    pageIndex: number,
    el: ZineElement,
    mode: 'move' | 'resize-br',
  ) {
    e.stopPropagation()
    activePageIdxInSpread = activeSpread.pageIndices.indexOf(pageIndex)
    selectedElementId = el.id
    drag = {
      pageIndex,
      elementId: el.id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origX: el.x,
      origY: el.y,
      origW: el.w,
      origH: el.h,
    }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: PointerEvent) {
    if (!drag) return
    const r = pageRect(drag.pageIndex)
    if (!r.width) return
    const dxPct = ((e.clientX - drag.startX) / r.width) * 100
    const dyPct = ((e.clientY - drag.startY) / r.height) * 100
    const page = zine.pages[drag.pageIndex]
    const idx = page.elements.findIndex((el) => el.id === drag!.elementId)
    if (idx < 0) return
    const el = page.elements[idx]
    if (drag.mode === 'move') {
      el.x = Math.max(-el.w * 0.5, Math.min(100 - el.w * 0.5, drag.origX + dxPct))
      el.y = Math.max(-el.h * 0.5, Math.min(100 - el.h * 0.5, drag.origY + dyPct))
    } else {
      el.w = Math.max(8, Math.min(120 - el.x, drag.origW + dxPct))
      el.h = Math.max(5, Math.min(120 - el.y, drag.origH + dyPct))
    }
  }

  function onPointerUp() {
    drag = null
  }

  function clearSelection() {
    selectedElementId = null
  }

  // ── Adding / removing elements ────────────────────────────────────
  function addPhotoToActivePage(src: string) {
    if (!activePage) return
    // If a placeholder photo is selected, fill it instead of adding
    const selected = activePage.elements.find((e) => e.id === selectedElementId)
    if (selected && selected.type === 'photo' && !selected.src) {
      selected.src = src
      return
    }
    const el: ZineElement = {
      id: newElementId(),
      type: 'photo',
      src,
      x: 15,
      y: 15,
      w: 70,
      h: 50,
    }
    activePage.elements.push(el)
    selectedElementId = el.id
  }

  function addTextBox() {
    if (!activePage) return
    const el: ZineElement = {
      id: newElementId(),
      type: 'text',
      x: 15,
      y: 70,
      w: 70,
      h: 15,
      text: 'Tap to edit',
      fontSize: 18,
      align: 'left',
      weight: 'regular',
    }
    activePage.elements.push(el)
    selectedElementId = el.id
  }

  function deleteSelected() {
    if (!selectedElementId || !activePage) return
    activePage.elements = activePage.elements.filter((e) => e.id !== selectedElementId)
    selectedElementId = null
  }

  function onKeyDown(e: KeyboardEvent) {
    if ((e.key === 'Backspace' || e.key === 'Delete') && selectedElementId) {
      const target = e.target as HTMLElement
      if (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
        return
      e.preventDefault()
      deleteSelected()
    }
  }

  // ── Spread operations ─────────────────────────────────────────────
  function addSpread() {
    zine.pages.push(blankPage())
    zine.pages.push(blankPage())
    const newSpreads = computeSpreads(zine.pages)
    activeSpreadIdx = newSpreads.length - 1
    activePageIdxInSpread = 0
    selectedElementId = null
    addMenuOpen = false
  }

  function addCoverSpread() {
    // Cover lives at page 0. If cover is empty, fill it; otherwise ignore.
    zine.pages[0].elements = [
      {
        id: newElementId(),
        type: 'text',
        x: 10,
        y: 40,
        w: 80,
        h: 20,
        text: zine.title || 'Untitled',
        fontSize: 42,
        align: 'center',
        weight: 'bold',
      },
    ]
    activeSpreadIdx = 0
    activePageIdxInSpread = 0
    addMenuOpen = false
  }

  function deleteSpread() {
    if (activeSpreadIdx === 0) return // can't delete cover
    const s = spreads[activeSpreadIdx]
    if (!s) return
    const indices = [...s.pageIndices].sort((a, b) => b - a)
    for (const i of indices) zine.pages.splice(i, 1)
    activeSpreadIdx = Math.max(0, activeSpreadIdx - 1)
    activePageIdxInSpread = 0
    selectedElementId = null
  }

  function applyLayoutToSpread(preset: LayoutPreset) {
    const s = spreads[activeSpreadIdx]
    if (!s) return
    const { left, right } = applyPreset(preset)
    const leftPageIdx = s.pageIndices[0]
    zine.pages[leftPageIdx].elements = left
    if (s.pageIndices[1] !== undefined) {
      zine.pages[s.pageIndices[1]].elements = right
    } else if (right.length > 0) {
      // No right page yet — add one to complete the spread
      zine.pages.splice(leftPageIdx + 1, 0, { id: newElementId(), elements: right })
    }
    selectedElementId = null
    layoutMenuOpen = false
  }

  // ── Text editing ──────────────────────────────────────────────────
  function updateText(el: ZineElement, text: string) {
    if (el.type !== 'text') return
    el.text = text
  }

  // ── Save / publish ────────────────────────────────────────────────
  let saving = $state(false)

  function saveDraft() {
    saving = true
    zine = saveZine($state.snapshot(zine) as Zine)
    setTimeout(() => (saving = false), 300)
  }

  function publish() {
    zine.status = 'published'
    const saved = saveZine($state.snapshot(zine) as Zine)
    goto(`/zine/${saved.rkey}`)
  }

  function handleBack() {
    goto('/')
  }

  function selectSpread(idx: number, side: number = 0) {
    activeSpreadIdx = idx
    activePageIdxInSpread = Math.min(side, spreads[idx].pageIndices.length - 1)
    selectedElementId = null
  }
</script>

<svelte:window on:keydown={onKeyDown} />

<div class="editor" onpointermove={onPointerMove} onpointerup={onPointerUp} role="presentation">
  <DetailHeader label="Edit zine" onback={handleBack}>
    {#snippet actions()}
      <Button variant="ghost" size="sm" onclick={saveDraft}>
        {#if saving}<LoaderCircle size={14} class="spin" />{:else}Save draft{/if}
      </Button>
      <Button size="sm" onclick={publish}>Publish</Button>
    {/snippet}
  </DetailHeader>

  <div class="title-row">
    <Input placeholder="Zine title" bind:value={zine.title} />
  </div>

  <div class="stage">
    <!-- Left rail: spreads -->
    <aside class="rail left">
      <div class="rail-header">Spreads</div>
      <div class="spreads-list">
        {#each spreads as spread (spread.pages.map((p) => p.id).join('-'))}
          {@const isActive = spread.index === activeSpreadIdx}
          <div class="spread-row" class:active={isActive}>
            <button
              class="spread-label"
              onclick={() => selectSpread(spread.index, 0)}
              aria-label={`Spread ${spread.index + 1}`}
            >
              <span class="spread-num">
                {#if spread.index === 0}Cover{:else}Spread {spread.index}{/if}
              </span>
            </button>
            <div class="spread-thumbs">
              {#each spread.pages as page, sideIdx (page.id)}
                <button
                  class="page-thumb"
                  class:active={isActive && sideIdx === activePageIdxInSpread}
                  onclick={() => selectSpread(spread.index, sideIdx)}
                  aria-label={`Page ${spread.pageIndices[sideIdx] + 1}`}
                >
                  <div class="page-thumb-inner">
                    {#each page.elements as el (el.id)}
                      <div
                        class="thumb-el"
                        style="left:{el.x}%;top:{el.y}%;width:{el.w}%;height:{el.h}%"
                      >
                        {#if el.type === 'photo' && el.src}
                          <img src={el.src} alt="" />
                        {:else if el.type === 'photo'}
                          <div class="thumb-placeholder"></div>
                        {:else}
                          <span class="thumb-text">{el.text.slice(0, 20)}</span>
                        {/if}
                      </div>
                    {/each}
                  </div>
                </button>
              {/each}
              {#if spread.index > 0 && spread.pages.length === 1}
                <div class="page-thumb empty" aria-hidden="true"></div>
              {/if}
            </div>
            {#if spread.index > 0 && isActive}
              <button class="spread-del" onclick={deleteSpread} aria-label="Delete spread">
                <Trash2 size={12} />
              </button>
            {/if}
          </div>
        {/each}
        <div class="add-wrap">
          <button class="add-btn" onclick={() => (addMenuOpen = !addMenuOpen)}>
            <Plus size={14} /> Add
          </button>
          {#if addMenuOpen}
            <div class="add-menu">
              <button onclick={addCoverSpread}>Reset cover</button>
              <button onclick={addSpread}>+ Blank spread</button>
            </div>
          {/if}
        </div>
      </div>
    </aside>

    <!-- Center: canvas -->
    <div class="canvas-wrap" onclick={clearSelection} role="presentation">
      <div
        class="canvas-spread"
        class:single={activeSpread?.pages.length === 1}
      >
        {#if activeSpread}
          {#each activeSpread.pages as page, sideIdx (page.id)}
            {@const pageIndex = activeSpread.pageIndices[sideIdx]}
            <div
              class="page"
              class:active={sideIdx === activePageIdxInSpread}
              bind:this={pageEls[pageIndex]}
              onclick={(e) => { e.stopPropagation(); activePageIdxInSpread = sideIdx; selectedElementId = null }}
              role="presentation"
            >
              {#each page.elements as el (el.id)}
                {@const selected = el.id === selectedElementId}
                <div
                  class="el"
                  class:selected
                  class:photo={el.type === 'photo'}
                  class:text={el.type === 'text'}
                  style="left:{el.x}%;top:{el.y}%;width:{el.w}%;height:{el.h}%"
                  onpointerdown={(e) => startDrag(e, pageIndex, el, 'move')}
                  onclick={(e) => { e.stopPropagation(); activePageIdxInSpread = sideIdx; selectedElementId = el.id }}
                  role="button"
                  tabindex="0"
                >
                  {#if el.type === 'photo'}
                    {#if el.src}
                      <img src={el.src} alt={el.alt ?? ''} draggable="false" />
                    {:else}
                      <div class="photo-placeholder">
                        <ImageIcon size={20} />
                        <span>Tap a photo →</span>
                      </div>
                    {/if}
                  {:else}
                    <div
                      class="text-box"
                      style="font-size:{(el.fontSize ?? 18) * 0.9}px;text-align:{el.align ?? 'left'};font-weight:{el.weight === 'bold' ? 700 : 400}"
                      contenteditable="true"
                      onblur={(e) => updateText(el, (e.target as HTMLElement).innerText)}
                      onpointerdown={(e) => e.stopPropagation()}
                    >{el.text}</div>
                  {/if}
                  {#if selected}
                    <button
                      class="handle br"
                      onpointerdown={(e) => startDrag(e, pageIndex, el, 'resize-br')}
                      aria-label="Resize"
                    ></button>
                  {/if}
                </div>
              {/each}
              <!-- Gutter margin guide (subtle) -->
              {#if activeSpread.pages.length === 2}
                <div class="gutter-guide" class:left={sideIdx === 0} class:right={sideIdx === 1}></div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>

      <div class="canvas-tools">
        <div class="tool-group">
          <button onclick={addTextBox} class="tool">
            <Type size={14} /> Text
          </button>
          <div class="layout-wrap">
            <button class="tool" onclick={() => (layoutMenuOpen = !layoutMenuOpen)}>
              <LayoutGrid size={14} /> Layout
            </button>
            {#if layoutMenuOpen}
              <div class="layout-menu">
                <div class="layout-menu-header">Apply layout to spread</div>
                {#each LAYOUT_PRESETS as preset (preset.id)}
                  <button class="layout-item" onclick={() => applyLayoutToSpread(preset.id)}>
                    <span class="layout-name">{preset.name}</span>
                    <span class="layout-desc">{preset.desc}</span>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        </div>
        {#if selectedElementId}
          <button onclick={deleteSelected} class="tool danger">
            <Trash2 size={14} /> Delete
          </button>
        {/if}
      </div>
    </div>
  </div>

  <!-- Bottom photo picker -->
  <div class="photo-dock">
    <div class="dock-header">
      <span>Photos</span>
      <select bind:value={galleryFilter} class="filter">
        {#each galleries as g}
          <option value={g}>{g === 'all' ? 'All galleries' : g}</option>
        {/each}
      </select>
    </div>
    <div class="photo-strip">
      {#each filteredPhotos as photo (photo.id)}
        <button class="photo-tile" onclick={() => addPhotoToActivePage(photo.src)}>
          <img src={photo.src} alt="" loading="lazy" />
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .editor {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: var(--bg-root);
  }
  .title-row {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    max-width: 520px;
  }
  .stage {
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: 0;
    flex: 1;
    min-height: 0;
  }
  .rail {
    background: var(--bg-elevated, #151515);
    border-right: 1px solid var(--border);
    overflow-y: auto;
    padding: 12px;
  }
  .rail-header {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin-bottom: 12px;
  }

  /* Spreads rail */
  .spreads-list { display: flex; flex-direction: column; gap: 16px; }
  .spread-row {
    position: relative;
    padding: 6px;
    border-radius: 6px;
    border: 2px solid transparent;
  }
  .spread-row.active { border-color: var(--grain-btn, #a86c3b); }
  .spread-label {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 11px;
    font-family: inherit;
    padding: 0 0 6px;
    cursor: pointer;
    width: 100%;
    text-align: left;
  }
  .spread-row.active .spread-label { color: var(--text-primary); }
  .spread-thumbs {
    display: flex;
    gap: 2px;
  }
  .spread-thumbs .page-thumb {
    flex: 1;
  }
  .spread-thumbs .page-thumb.empty {
    background: transparent;
    border: 1px dashed var(--border);
    cursor: default;
  }
  .page-thumb {
    position: relative;
    background: #fff;
    border: 1px solid transparent;
    border-radius: 2px;
    padding: 0;
    aspect-ratio: 3 / 4;
    cursor: pointer;
    overflow: hidden;
  }
  .page-thumb.active { outline: 2px solid var(--grain-btn, #a86c3b); outline-offset: 1px; }
  .page-thumb-inner { position: absolute; inset: 0; }
  .thumb-el { position: absolute; overflow: hidden; }
  .thumb-el img { width: 100%; height: 100%; object-fit: cover; }
  .thumb-placeholder { width: 100%; height: 100%; background: #e5e5e5; }
  .thumb-text {
    font-size: 6px;
    color: #222;
    overflow: hidden;
    display: block;
    line-height: 1.2;
  }
  .spread-del {
    position: absolute;
    top: 4px;
    right: 4px;
    background: rgba(0,0,0,0.6);
    color: #fff;
    border: none;
    border-radius: 3px;
    padding: 3px;
    cursor: pointer;
  }
  .add-wrap { position: relative; }
  .add-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    padding: 10px;
    background: transparent;
    color: var(--text-primary);
    border: 1px dashed var(--border);
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
  }
  .add-btn:hover { border-color: var(--grain-btn); }
  .add-menu {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 4px;
    background: var(--bg-elevated, #1c1c1c);
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
    z-index: 10;
  }
  .add-menu button {
    display: block;
    width: 100%;
    padding: 8px 10px;
    border: none;
    background: transparent;
    color: var(--text-primary);
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
    text-align: left;
  }
  .add-menu button:hover { background: var(--bg-hover); }

  /* Canvas */
  .canvas-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 24px 16px;
    overflow: auto;
    min-height: 0;
  }
  .canvas-spread {
    display: flex;
    gap: 0;
    background: #fff;
    box-shadow: 0 12px 40px rgba(0,0,0,0.45);
    width: min(920px, 100%);
    aspect-ratio: 6 / 4; /* two 3:4 pages side-by-side */
    overflow: hidden; /* clip at spread boundary; elements can cross the gutter */
    position: relative;
  }
  .canvas-spread.single {
    width: min(460px, 50%);
    aspect-ratio: 3 / 4;
    justify-content: center;
  }
  .page {
    position: relative;
    flex: 1;
    background: transparent; /* bg on spread; lets elements span the gutter */
    user-select: none;
    cursor: default;
  }
  .page:not(:last-child) { border-right: 1px solid rgba(0,0,0,0.12); }
  .canvas-spread:not(.single) .page.active::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    box-shadow: inset 0 0 0 2px var(--grain-btn, #a86c3b);
  }
  .gutter-guide {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 6%;
    pointer-events: none;
    background: linear-gradient(90deg, rgba(0,0,0,0.06), rgba(0,0,0,0));
  }
  .gutter-guide.left { right: 0; }
  .gutter-guide.right {
    left: 0;
    background: linear-gradient(90deg, rgba(0,0,0,0), rgba(0,0,0,0.06));
  }
  .el {
    position: absolute;
    cursor: move;
    touch-action: none;
  }
  .el.selected { outline: 2px solid var(--grain-btn, #a86c3b); outline-offset: 1px; z-index: 2; }
  .el.photo img { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; }
  .el.text { color: #111; }
  .photo-placeholder {
    width: 100%; height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: #e9e9e9;
    color: #666;
    font-size: 11px;
  }
  .text-box {
    width: 100%;
    height: 100%;
    outline: none;
    cursor: text;
    white-space: pre-wrap;
    line-height: 1.25;
  }
  .handle {
    position: absolute;
    width: 14px;
    height: 14px;
    background: var(--grain-btn, #a86c3b);
    border: 2px solid #fff;
    border-radius: 50%;
    cursor: nwse-resize;
    padding: 0;
  }
  .handle.br { right: -7px; bottom: -7px; }

  .canvas-tools {
    display: flex;
    gap: 8px;
    margin-top: 16px;
    align-items: center;
  }
  .tool-group { display: flex; gap: 8px; }
  .tool {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--bg-hover);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: 18px;
    padding: 6px 12px;
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
  }
  .tool.danger { color: #f87171; border-color: #f87171; }
  .layout-wrap { position: relative; }
  .layout-menu {
    position: absolute;
    bottom: 100%;
    left: 0;
    margin-bottom: 6px;
    background: var(--bg-elevated, #1c1c1c);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    z-index: 10;
    min-width: 260px;
  }
  .layout-menu-header {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    padding: 10px 12px 6px;
  }
  .layout-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    padding: 8px 12px;
    border: none;
    background: transparent;
    color: var(--text-primary);
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    gap: 2px;
  }
  .layout-item:hover { background: var(--bg-hover); }
  .layout-name { font-size: 13px; font-weight: 600; }
  .layout-desc { font-size: 11px; color: var(--text-muted); }

  /* Photo dock (bottom) */
  .photo-dock {
    border-top: 1px solid var(--border);
    background: var(--bg-elevated, #151515);
    padding: 10px 12px 12px;
  }
  .dock-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin-bottom: 8px;
  }
  .filter {
    background: var(--bg-hover);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 3px 6px;
    font-size: 11px;
    font-family: inherit;
    text-transform: none;
    letter-spacing: 0;
  }
  .photo-strip {
    display: flex;
    gap: 8px;
    overflow-x: auto;
  }
  .photo-tile {
    padding: 0;
    background: var(--bg-hover);
    border: 1px solid transparent;
    border-radius: 4px;
    width: 72px;
    aspect-ratio: 3 / 4;
    overflow: hidden;
    cursor: pointer;
    flex-shrink: 0;
  }
  .photo-tile:hover { border-color: var(--grain-btn, #a86c3b); }
  .photo-tile img { width: 100%; height: 100%; object-fit: cover; display: block; }

  @media (max-width: 720px) {
    .stage { grid-template-columns: 160px 1fr; }
    .canvas-spread { width: 100%; }
  }
  @media (max-width: 520px) {
    .stage { grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
    .rail { max-height: 140px; }
    .spreads-list { flex-direction: row; }
    .spread-row { flex-shrink: 0; width: 140px; }
  }
</style>
