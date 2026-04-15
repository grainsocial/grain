<script lang="ts">
  import type { Snippet } from 'svelte'

  let { label, children }: { label?: string; children: Snippet } = $props()
</script>

{#if label}
  <h3 class="section-label">{label}</h3>
{/if}
<div class="settings-group">
  {@render children()}
</div>

<style>
  .section-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  .settings-group {
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
  }
</style>
