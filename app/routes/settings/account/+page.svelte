<script lang="ts">
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import { ExternalLink } from 'lucide-svelte'
  import { viewer } from '$lib/stores'

  const did = $derived($viewer?.did ?? '')
  const handle = $derived($viewer?.handle ?? '')
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
</style>
