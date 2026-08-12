<script lang="ts">
  import { LoaderCircle, ImagePlus } from 'lucide-svelte'

  let {
    onfiles,
    onreject,
    enabled = true,
    processing = false,
    overlay = true,
    accept = 'image/',
    label = 'Drop to add photos',
    hint = '',
    processingLabel = 'Processing photos...',
    active = $bindable(false),
  }: {
    /** Called with the dropped files that match `accept` */
    onfiles: (files: File[]) => void
    /** Called when a drop carried nothing usable */
    onreject?: (message: string) => void
    /** Whether drops are accepted right now */
    enabled?: boolean
    /** Show the overlay in a busy state (the parent owns the actual work) */
    processing?: boolean
    /** Render the full-screen overlay. Turn off to style your own drop target via `bind:active` */
    overlay?: boolean
    /** MIME prefix files must match */
    accept?: string
    label?: string
    hint?: string
    processingLabel?: string
    /** True while a file drag is over the page and drops are enabled */
    active?: boolean
  } = $props()

  // dragenter/dragleave fire per element, so count them to know when the
  // drag has actually left the page
  let depth = 0

  // Drops can stop being accepted mid-drag (e.g. the parent hit its limit)
  $effect(() => {
    if (!enabled) active = false
  })

  function isFileDrag(e: DragEvent) {
    return Array.from(e.dataTransfer?.types ?? []).includes('Files')
  }

  function onDragEnter(e: DragEvent) {
    if (!isFileDrag(e)) return
    depth++
    if (enabled) active = true
  }

  function onDragOver(e: DragEvent) {
    if (!isFileDrag(e)) return
    // Required for the drop event to fire — also stops the browser from
    // navigating to the dropped file
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = enabled ? 'copy' : 'none'
  }

  function onDragLeave(e: DragEvent) {
    if (!isFileDrag(e)) return
    depth = Math.max(0, depth - 1)
    if (depth === 0) active = false
  }

  function onDrop(e: DragEvent) {
    if (!isFileDrag(e)) return
    e.preventDefault()
    depth = 0
    active = false
    if (!enabled) return

    const files = Array.from(e.dataTransfer?.files ?? [])
    if (files.length === 0) return
    const matching = files.filter((f) => f.type.startsWith(accept))
    if (matching.length === 0) {
      onreject?.('Only image files can be added')
      return
    }
    onfiles(matching)
  }
</script>

<svelte:window
  ondragenter={onDragEnter}
  ondragover={onDragOver}
  ondragleave={onDragLeave}
  ondrop={onDrop}
/>

{#if overlay && (active || processing)}
  <div class="drop-overlay">
    <div class="drop-card">
      {#if processing}
        <LoaderCircle size={24} class="spin" />
        <span>{processingLabel}</span>
      {:else}
        <ImagePlus size={24} />
        <span>{label}</span>
        {#if hint}
          <span class="hint">{hint}</span>
        {/if}
      {/if}
    </div>
  </div>
{/if}

<style>
  .drop-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    /* Never intercept drag events — the window handlers own them */
    pointer-events: none;
  }
  .drop-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    background: var(--bg-hover);
    border: 2px dashed var(--grain);
    border-radius: 16px;
    padding: 32px 40px;
    color: var(--text-primary);
    font-size: 16px;
    font-weight: 600;
    text-align: center;
  }
  .hint {
    font-size: 13px;
    font-weight: 400;
    color: var(--text-muted);
  }
  :global(.spin) {
    animation: spin 1s linear infinite;
  }
</style>
