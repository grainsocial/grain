<script lang="ts">
  import type { Snippet } from 'svelte'
  import { ArrowLeft } from 'lucide-svelte'
  import { goto } from '$app/navigation'

  let { label, actions, onback }: { label: string; actions?: Snippet; onback?: () => void } =
    $props()

  function goBack() {
    if (window.history.length > 1) {
      history.back()
    } else {
      goto('/')
    }
  }
</script>

<div class="detail-header">
  <button class="detail-back" onclick={onback ?? goBack}
    ><ArrowLeft size={18} /></button
  >
  <span class="detail-label">{label}</span>
  {#if actions}
    <div class="detail-actions">
      {@render actions()}
    </div>
  {/if}
</div>

<style>
  .detail-header {
    display: flex; align-items: center; gap: 12px; padding: 10px 16px; height: 46px;
    position: sticky; top: 0; z-index: 50;
    background: rgba(8, 11, 18, 0.85); backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--border);
  }
  .detail-back {
    background: none; border: none; color: var(--text-primary); font-size: 20px;
    cursor: pointer; padding: 2px 4px; line-height: 1; display: flex; align-items: center;
  }
  .detail-back:hover { color: var(--grain); }
  .detail-label {
    font-family: var(--font-display); font-weight: 700; font-size: 17px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    flex: 1;
  }
  .detail-actions {
    display: flex;
    align-items: center;
  }
</style>
