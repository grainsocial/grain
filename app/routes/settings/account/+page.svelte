<script lang="ts">
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import { ExternalLink } from 'lucide-svelte'
  import { viewer } from '$lib/stores'
  import { callXrpc } from '$hatk/client'
  import { logout } from '$lib/auth'
  import { goto } from '$app/navigation'

  const did = $derived($viewer?.did ?? '')
  const handle = $derived($viewer?.handle ?? '')

  let deleting = $state(false)
  let deleteError = $state<string | null>(null)

  async function handleDelete() {
    const first = confirm(
      'Delete your Grain account?\n\n' +
        'This removes all your Grain galleries, stories, photos, favorites, comments, follows, blocks, and profile. ' +
        'Your atproto identity is separate and is not affected. This cannot be undone.',
    )
    if (!first) return
    const second = confirm('Are you sure? This cannot be undone.')
    if (!second) return

    deleting = true
    deleteError = null
    try {
      await callXrpc('social.grain.unspecced.deleteAccount')
      await logout()
      goto('/')
    } catch (err) {
      deleteError = err instanceof Error ? err.message : String(err)
      deleting = false
    }
  }
</script>

<DetailHeader label="Account" />

<div class="settings-page">
  <div class="settings-group">
    <div class="settings-row">
      <span class="row-label">Handle</span>
      <span class="row-value">@{handle}</span>
    </div>
    <div class="settings-row">
      <span class="row-label">DID</span>
      <span class="row-value did">{did}</span>
    </div>
  </div>

  {#if did}
    <div class="settings-group">
      <a href="https://pdsls.dev/at://{did}" target="_blank" rel="noopener noreferrer" class="settings-row link">
        <span class="row-label">Manage your data</span>
        <ExternalLink size={14} class="chevron" />
      </a>
    </div>

    <div class="settings-group">
      <button type="button" class="settings-row delete" disabled={deleting} onclick={handleDelete}>
        <span class="row-label">{deleting ? 'Deleting…' : 'Delete Account'}</span>
      </button>
    </div>
    {#if deleteError}
      <p class="error">{deleteError}</p>
    {/if}
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
  }
  .settings-row:not(:last-child) {
    border-bottom: 1px solid var(--border);
  }
  .settings-row.link {
    cursor: pointer;
    transition: background 0.12s;
  }
  .settings-row.link:hover {
    background: var(--bg-hover);
  }
  .row-label {
    font-size: 15px;
    color: var(--text-primary);
  }
  .row-value {
    flex: 1;
    text-align: right;
    font-size: 14px;
    color: var(--text-muted);
  }
  .row-value.did {
    font-size: 11px;
    word-break: break-all;
  }
  .settings-row :global(.chevron) {
    color: var(--text-muted);
  }
  button.settings-row {
    width: 100%;
    background: none;
    border: none;
    font-family: inherit;
    font-size: inherit;
    text-align: left;
    cursor: pointer;
  }
  button.settings-row:hover {
    background: var(--bg-hover);
  }
  button.settings-row:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .delete .row-label {
    color: #f87171;
  }
  .error {
    color: #f87171;
    font-size: 13px;
    padding: 0 4px;
  }
</style>
