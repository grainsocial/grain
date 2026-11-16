<script lang="ts">
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import SettingsGroup from '$lib/components/atoms/SettingsGroup.svelte'
  import { ExternalLink } from 'lucide-svelte'
  import { viewer } from '$lib/stores'
  import type { DidString } from '@atproto/lex'
  import { call } from '$lib/xrpc'
  import type * as deleteAccount from '$lib/lexicons/social/grain/server/deleteAccount.ts'
  import { createQuery } from '@tanstack/svelte-query'
  import { spaceSupportQuery } from '$lib/queries'
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
  let deleted = $state(0)
  let deleteError = $state<string | null>(null)
  const deleteLabel = $derived(
    deleting ? `Deleting… ${deleted} ${deleted === 1 ? 'record' : 'records'}` : 'Delete Account',
  )

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
    deleted = 0
    deleteError = null
    try {
      // A part at a time, so the page shows how far it has got; the last
      // call logs the browser out of the account, as /oauth/logout does.
      for (;;) {
        const step = await call<typeof deleteAccount.main>('social.grain.server.deleteAccount', {
          did: did as DidString,
        })
        deleted += step.deleted
        if (step.done) break
      }
      goto('/', { invalidateAll: true })
    } catch (err) {
      deleteError = err instanceof Error ? err.message : String(err)
      deleting = false
    }
  }
</script>

<DetailHeader label="Identity & data" />

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
      <!-- Unlabelled, like the other groups on this page. -->
      <SettingsGroup>
        <div class="settings-row stacked">
          <span class="row-label">Permissioned spaces</span>
          {#if spacesPds}
            <span class="row-desc">{spacesPds} serves proposal 0016</span>
          {/if}
        </div>
      </SettingsGroup>
    {/if}

    <div class="settings-group">
      <button type="button" class="settings-row delete" disabled={deleting} onclick={handleDelete}>
        <span class="row-label">{deleteLabel}</span>
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
  /* Label and value sit on one line; a row that carries a description stacks
     them instead, the way SettingsToggleRow does. */
  .settings-row.stacked {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  .row-desc {
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
