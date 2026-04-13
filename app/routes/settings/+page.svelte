<script lang="ts">
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import { UserPen, Shield, Bell, ChevronRight, ExternalLink, User, Upload } from 'lucide-svelte'
  import { viewer } from '$lib/stores'
  import { logout } from '$lib/auth'
  import { resetPreferences } from '$lib/preferences'

  const did = $derived($viewer?.did ?? '')

  async function doLogout() {
    await logout()
    resetPreferences()
    window.location.href = '/'
  }
</script>

<DetailHeader label="Settings" />

<div class="settings-page">
  <div class="settings-group">
    <a href="/settings/account" class="settings-row">
      <User size={18} />
      <span class="settings-label">Account</span>
      <ChevronRight size={16} class="chevron" />
    </a>
    <a href="/settings/profile" class="settings-row">
      <UserPen size={18} />
      <span class="settings-label">Edit Profile</span>
      <ChevronRight size={16} class="chevron" />
    </a>
    <a href="/settings/notifications" class="settings-row">
      <Bell size={18} />
      <span class="settings-label">Notifications</span>
      <ChevronRight size={16} class="chevron" />
    </a>
    <a href="/settings/moderation" class="settings-row">
      <Shield size={18} />
      <span class="settings-label">Moderation</span>
      <ChevronRight size={16} class="chevron" />
    </a>
    <a href="/settings/upload-defaults" class="settings-row">
      <Upload size={18} />
      <span class="settings-label">Privacy</span>
      <ChevronRight size={16} class="chevron" />
    </a>
  </div>

  <div class="settings-group">
    <a href="/support/privacy" class="settings-row">
      <span class="settings-label">Privacy Policy</span>
      <ChevronRight size={16} class="chevron" />
    </a>
    <a href="/support/terms" class="settings-row">
      <span class="settings-label">Terms of Service</span>
      <ChevronRight size={16} class="chevron" />
    </a>
    <a href="/support/copyright" class="settings-row">
      <span class="settings-label">Copyright Policy</span>
      <ChevronRight size={16} class="chevron" />
    </a>
    <a href="/support/community-guidelines" class="settings-row">
      <span class="settings-label">Community Guidelines</span>
      <ChevronRight size={16} class="chevron" />
    </a>
    <a href="https://atproto.com" target="_blank" rel="noopener" class="settings-row">
      <span class="settings-label">AT Protocol</span>
      <ExternalLink size={14} class="chevron" />
    </a>
  </div>

  {#if did}
    <div class="settings-group">
      <button class="settings-row sign-out" onclick={doLogout}>
        <span class="settings-label">Sign Out</span>
      </button>
    </div>
  {/if}
</div>

<style>
  .settings-page {
    max-width: 600px;
    margin: 0 auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .settings-group {
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
  }
  .settings-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    color: var(--text-primary);
    text-decoration: none;
    transition: background 0.12s;
    background: none;
    border: none;
    width: 100%;
    font-family: inherit;
    font-size: inherit;
    cursor: pointer;
    text-align: left;
  }
  .settings-row:not(:last-child) {
    border-bottom: 1px solid var(--border);
  }
  .settings-row:hover {
    background: var(--bg-hover);
  }
  .settings-label {
    flex: 1;
    font-size: 15px;
  }
  .settings-row :global(.chevron) {
    color: var(--text-muted);
  }
  .sign-out .settings-label {
    color: #f87171;
  }
</style>
