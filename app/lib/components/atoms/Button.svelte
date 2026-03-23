<script lang="ts">
  import type { Snippet } from 'svelte'

  let {
    variant = 'primary',
    size = 'md',
    disabled = false,
    onclick,
    children,
  }: {
    variant?: 'primary' | 'secondary' | 'ghost' | 'icon'
    size?: 'sm' | 'md'
    disabled?: boolean
    onclick?: () => void
    children: Snippet
  } = $props()
</script>

<button class="btn {variant} {size}" {disabled} {onclick}>
  {@render children()}
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border-radius: 20px;
    font-family: var(--font-body);
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.12s;
  }
  .md { padding: 8px 20px; font-size: 14px; }
  .sm { padding: 6px 16px; font-size: 13px; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .primary { background: var(--grain-btn); color: #fff; }
  .primary:hover:not(:disabled) { background: var(--grain-btn-dim); }
  .secondary {
    background: var(--bg-elevated);
    color: var(--text-secondary);
    border: 1px solid var(--border);
  }
  .secondary:hover:not(:disabled) { background: var(--bg-hover); color: var(--text-primary); }
  .ghost { background: none; color: var(--text-muted); }
  .ghost:hover:not(:disabled) { color: var(--text-primary); background: var(--bg-hover); }
  .icon {
    background: none;
    border: none;
    color: var(--text-muted);
    padding: 6px;
  }
  .icon:hover:not(:disabled) { color: var(--text-primary); }
</style>
