<script lang="ts">
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import { ChevronRight, ExternalLink } from 'lucide-svelte'
  import { viewer } from '$lib/stores'
  import { callXrpc } from '$hatk/client'
  import { createQuery } from '@tanstack/svelte-query'
  import { spaceSupportQuery } from '$lib/queries'
  import { logout } from '$lib/auth'
  import { goto } from '$app/navigation'

  const did = $derived($viewer?.did ?? '')
  const handle = $derived($viewer?.handle ?? '')

  const spaces = createQuery(() => spaceSupportQuery())
  const spacesPds = $derived.by(() => {
    const pds = spaces.data?.pds
    if (!pds) return ''
    try {
      return new URL(pds).host
    } catch {
      return pds
    }
  })

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

    <!-- Shown only where it means something. Almost no PDS serves permissioned
         spaces, and telling everyone else that theirs does not is a line about
         a feature they have no way to reach. -->
    {#if spaces.data?.supported}
      <div class="settings-group">
        <div class="settings-row">
          <span class="row-label">Permissioned spaces</span>
          <span class="row-value">Supported</span>
        </div>
        <a href="/private/create" class="settings-row link">
          <span class="row-label">New private gallery</span>
          <ChevronRight size={14} class="chevron" />
        </a>
        {#if spacesPds}
          <p class="row-hint">
            {spacesPds} serves proposal 0016, so private galleries can live on it.
          </p>
        {/if}
      </div>
    {/if}

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
  .row-hint {
    margin: 0;
    padding: 0 16px 14px;
    font-size: 12px;
    line-height: 1.4;
    color: var(--text-muted);
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
    color: var(--danger);
  }
  .error {
    color: var(--danger);
    font-size: 13px;
    padding: 0 4px;
  }
</style>
