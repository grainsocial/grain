<script lang="ts">
  import { LogIn, LogOut } from 'lucide-svelte'
  import LoginModal from './LoginModal.svelte'
  import { viewer, isAuthenticated } from '$lib/stores'
  import { logout } from '$lib/auth'
  import { resetPreferences } from '$lib/preferences'

  let loginOpen = $state(false)

  async function doLogout() {
    await logout()
    resetPreferences()
    $viewer = null
    window.location.href = '/'
  }
</script>

<LoginModal bind:open={loginOpen} />

<div class="auth-bar">
  {#if $isAuthenticated && $viewer}
    <button class="nav-item" title="Sign out" onclick={doLogout}>
      <LogOut size={20} />
    </button>
  {:else}
    <button class="nav-item" title="Sign in" onclick={() => (loginOpen = true)}>
      <LogIn size={20} />
    </button>
  {/if}
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
