<script lang="ts">
  import { Search } from 'lucide-svelte'
  import { goto } from '$app/navigation'

  let { open = $bindable(false) }: { open: boolean } = $props()
  let query = $state('')
  let inputEl: HTMLInputElement | undefined = $state()

  $effect(() => {
    if (open && inputEl) {
      query = ''
      inputEl.focus()
    }
  })

  function doSearch() {
    const q = query.trim()
    if (q) {
      open = false
      goto(`/search?q=${encodeURIComponent(q)}`)
    }
  }
</script>

<div class="mobile-search-panel" class:open>
  <div class="mobile-search-top">
    <div class="search-wrapper">
      <span class="search-icon"><Search size={16} /></span>
      <input
        bind:this={inputEl}
        bind:value={query}
        class="search-input"
        type="text"
        placeholder="Search..."
        onkeydown={(e) => { if (e.key === 'Enter') doSearch() }}
      />
    </div>
    <button class="mobile-search-close" onclick={() => open = false}>Cancel</button>
  </div>
</div>

<style>
  .mobile-search-panel {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 150;
    background: var(--bg-root);
    padding: 12px 16px;
    overflow-y: auto;
  }
  .mobile-search-panel.open {
    display: block;
  }
  .mobile-search-top {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .search-wrapper {
    flex: 1;
    position: relative;
  }
  .search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-faint);
    pointer-events: none;
    display: flex;
    align-items: center;
  }
  .search-input {
    width: 100%;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 9px 16px 9px 36px;
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 16px;
    outline: none;
    transition: border-color 0.15s, background 0.15s;
  }
  .search-input::placeholder { color: var(--text-faint); }
  .search-input:focus { border-color: var(--grain); background: var(--bg-root); }
  .mobile-search-close {
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    padding: 8px;
    font-family: var(--font-body);
  }
</style>
