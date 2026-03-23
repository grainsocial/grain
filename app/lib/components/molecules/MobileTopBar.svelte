<script lang="ts">
  import { Menu, Search } from 'lucide-svelte'

  let { onHamburger, onSearch }: { onHamburger: () => void; onSearch: () => void } = $props()
</script>

<div class="mobile-top">
  <button class="mobile-hamburger" onclick={onHamburger}>
    <Menu size={20} />
  </button>
  <span class="mobile-logo">grain</span>
  <button class="mobile-search-btn" onclick={onSearch}>
    <Search size={20} />
  </button>
</div>

<style>
  .mobile-top {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 60;
    background: var(--bg-root);
    border-bottom: 1px solid var(--border);
    padding: 10px 16px;
    height: 47px;
    align-items: center;
    justify-content: space-between;
  }
  .mobile-hamburger,
  .mobile-search-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 22px;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .mobile-logo {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 20px;
    color: #fff;
  }

  @media (max-width: 600px) {
    .mobile-top {
      display: flex;
      touch-action: manipulation;
    }
  }
</style>
