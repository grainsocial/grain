<script lang="ts">
  import { X } from 'lucide-svelte'
  import type { Snippet } from 'svelte'
  import Button from './Button.svelte'

  let {
    open = $bindable(false),
    title,
    width = '380px',
    children,
  }: {
    open: boolean
    title: string
    width?: string
    children: Snippet
  } = $props()

  let dialogEl: HTMLDialogElement | undefined = $state()

  $effect(() => {
    if (!dialogEl) return
    if (open && !dialogEl.open) {
      dialogEl.showModal()
    } else if (!open && dialogEl.open) {
      dialogEl.close()
    }
  })

  function onClose() {
    open = false
  }

  function onBackdropClick(e: MouseEvent) {
    if (e.target === dialogEl) {
      open = false
    }
  }
</script>

<dialog
  bind:this={dialogEl}
  class="modal"
  style="width:{width}"
  onclose={onClose}
  onclick={onBackdropClick}
>
  <div class="modal-inner">
    <div class="modal-header">
      <h2>{title}</h2>
      <Button variant="icon" onclick={() => open = false}><X size={18} /></Button>
    </div>
    {@render children()}
  </div>
</dialog>

<style>
  .modal {
    background: var(--bg-surface);
    border: 1px solid var(--border-light);
    border-radius: 16px;
    padding: 0;
    max-height: 90vh;
    overflow: visible;
    color: var(--text-primary);
    animation: slideUp 0.2s;
    margin: auto;
    position: fixed;
    inset: 0;
    height: fit-content;
  }
  .modal::backdrop {
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    animation: fadeIn 0.15s;
  }
  .modal-inner {
    padding: 24px;
  }
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }
  .modal-header h2 {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 18px;
  }
</style>
