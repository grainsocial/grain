<script lang="ts">
  import { LogOut } from 'lucide-svelte'
  import { viewer } from '$lib/stores'
  import { logout } from '$lib/auth'
  import { resetPreferences } from '$lib/preferences'

  async function doLogout() {
    await logout()
    resetPreferences()
    $viewer = null
    window.location.href = '/'
  }
</script>

<div class="auth-bar">
  <button class="nav-item" title="Sign out" onclick={doLogout}>
    <LogOut size={20} />
  </button>
</div>

<style>
  .auth-bar {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
  }
  .nav-item {
    width: 42px;
    height: 42px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    cursor: pointer;
    background: none;
    border: none;
    transition: all 0.15s;
  }
  .nav-item:hover { background: var(--bg-hover); color: var(--text-primary); }
</style>
