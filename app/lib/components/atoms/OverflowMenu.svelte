<script lang="ts">
  import type { Snippet } from 'svelte'
  import { EllipsisVertical } from 'lucide-svelte'

  let { children }: { children: Snippet } = $props()

  let open = $state(false)
</script>

<div class="overflow-menu">
  <button class="overflow-btn" type="button" onclick={(e) => { e.stopPropagation(); open = !open }} aria-label="More options">
    <EllipsisVertical size={18} />
  </button>
  {#if open}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="overflow-backdrop" onclick={() => (open = false)}></div>
    <div class="overflow-dropdown">
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .overflow-menu {
    position: relative;
    flex-shrink: 0;
  }
  .overflow-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    border-radius: 50%;
    transition: background 0.15s, color 0.15s;
  }
  .overflow-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  .overflow-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99;
  }
  .overflow-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    z-index: 100;
    min-width: 160px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    padding: 4px;
    margin-top: 4px;
  }
</style>
