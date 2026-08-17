<script lang="ts">
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import Avatar from '$lib/components/atoms/Avatar.svelte'
  import { Check, ChevronRight, ExternalLink, Plus, X } from 'lucide-svelte'
  import { loginModalOpen, viewer } from '$lib/stores'
  import { logout } from '$lib/auth'
  import { resetPreferences } from '$lib/preferences'
  import {
    fetchServerAccounts,
    forgetAccount,
    listAccounts,
    switchAccount,
    type StoredAccount,
  } from '$lib/accounts'

  const did = $derived($viewer?.did ?? '')

  let accounts = $state<StoredAccount[]>([])
  let switchingTo = $state('')

  $effect(() => {
    // The layout writes the signed-in viewer into localStorage as its profile
    // resolves, so re-read whenever the viewer changes rather than once on mount.
    void $viewer
    const local = listAccounts()
    accounts = local

    // The server knows which accounts this browser may switch into; localStorage
    // only has the display detail. Prefer the server list where it exists, and
    // keep the local avatar and display name for each row.
    fetchServerAccounts().then((server) => {
      if (!server) return
      const byDid = new Map(local.map((a) => [a.did, a]))
      accounts = server.accounts.map((a) => ({
        did: a.did,
        handle: a.handle ?? byDid.get(a.did)?.handle ?? null,
        displayName: byDid.get(a.did)?.displayName ?? null,
        avatar: byDid.get(a.did)?.avatar ?? null,
      }))
    })
  })

  async function doSwitch(account: StoredAccount) {
    if (account.did === did || switchingTo) return
    switchingTo = account.did
    await switchAccount(account)
  }

  function doForget(account: StoredAccount) {
    forgetAccount(account.did)
    accounts = listAccounts()
  }

  // Signing out leaves the account in the switcher — getting back to it in one
  // click is the point. Use the remove button to forget it entirely.
  async function doLogout() {
    await logout()
    resetPreferences()
    window.location.href = '/'
  }
</script>

<DetailHeader label="Settings" />

<div class="settings-page">
  <div class="settings-group">
    {#each accounts as account (account.did)}
      {@const isActive = account.did === did}
      <div class="account-row">
        <button
          class="account-main"
          onclick={() => doSwitch(account)}
          disabled={isActive || !!switchingTo}
          aria-current={isActive ? 'true' : undefined}
        >
          <Avatar did={account.did} src={account.avatar} name={account.displayName ?? account.handle} size={34} />
          <span class="account-text">
            <span class="account-name">{account.displayName || account.handle || account.did}</span>
            {#if account.handle}
              <span class="account-handle">@{account.handle}</span>
            {/if}
          </span>
          {#if isActive}
            <Check size={16} class="account-check" />
          {:else if switchingTo === account.did}
            <span class="account-status">Switching…</span>
          {/if}
        </button>
        {#if !isActive}
          <button class="account-remove" onclick={() => doForget(account)} aria-label="Remove {account.handle || account.did}">
            <X size={14} />
          </button>
        {/if}
      </div>
    {/each}
    <button class="settings-row" onclick={() => ($loginModalOpen = true)}>
      <Plus size={16} class="chevron" />
      <span class="settings-label">Add another account</span>
    </button>
  </div>

  <div class="settings-group">
    <a href="/settings/account" class="settings-row">
      <span class="settings-label">Account</span>
      <ChevronRight size={16} class="chevron" />
    </a>
    <a href="/settings/profile" class="settings-row">
      <span class="settings-label">Edit Profile</span>
      <ChevronRight size={16} class="chevron" />
    </a>
    <a href="/settings/appearance" class="settings-row">
      <span class="settings-label">Appearance</span>
      <ChevronRight size={16} class="chevron" />
    </a>
    <a href="/settings/notifications" class="settings-row">
      <span class="settings-label">Notifications</span>
      <ChevronRight size={16} class="chevron" />
    </a>
    <a href="/settings/moderation" class="settings-row">
      <span class="settings-label">Moderation</span>
      <ChevronRight size={16} class="chevron" />
    </a>
<a href="/settings/upload-defaults" class="settings-row">
      <span class="settings-label">Privacy</span>
      <ChevronRight size={16} class="chevron" />
    </a>
  </div>

  <div class="settings-group">
    <a href="/settings/import" class="settings-row">
      <span class="settings-label">Import from Instagram <span class="beta-badge">Beta</span></span>
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
  .beta-badge {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    background: var(--bg-hover);
    color: var(--text-muted);
    padding: 2px 6px;
    border-radius: 4px;
    vertical-align: middle;
    margin-left: 6px;
  }
  .sign-out .settings-label {
    color: var(--danger);
  }
  .account-row {
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--border);
  }
  .account-main {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
    padding: 12px 16px;
    background: none;
    border: none;
    font-family: inherit;
    color: var(--text-primary);
    text-align: left;
    cursor: pointer;
    transition: background 0.12s;
  }
  .account-main:hover:not(:disabled) {
    background: var(--bg-hover);
  }
  .account-main:disabled {
    cursor: default;
  }
  .account-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
    flex: 1;
  }
  .account-name {
    font-size: 15px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .account-handle {
    font-size: 13px;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .account-status {
    font-size: 13px;
    color: var(--text-muted);
  }
  .account-row :global(.account-check) {
    color: var(--grain);
    flex-shrink: 0;
  }
  .account-remove {
    display: flex;
    align-items: center;
    padding: 12px 16px 12px 4px;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
  }
  .account-remove:hover {
    color: var(--text-primary);
  }
</style>
