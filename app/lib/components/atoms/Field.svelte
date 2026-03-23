<script lang="ts">
  import type { Snippet } from 'svelte'

  let {
    label = '',
    count = 0,
    max = 0,
    showCount = 'auto',
    children,
  }: {
    label?: string
    count?: number
    max?: number
    showCount?: 'auto' | 'always' | 'never'
    children: Snippet
  } = $props()

  const visible = $derived(
    showCount === 'always' || (showCount === 'auto' && max > 0 && count > 0)
  )
</script>

<div class="field">
  {#if label}
    <span class="label">{label}</span>
  {/if}
  {@render children()}
  {#if visible}
    <span class="char-count">{count}/{max}</span>
  {/if}
</div>

<style>
  .field {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
  }
  .char-count {
    position: absolute;
    bottom: 8px;
    right: 12px;
    font-size: 12px;
    color: var(--text-muted);
  }
</style>
