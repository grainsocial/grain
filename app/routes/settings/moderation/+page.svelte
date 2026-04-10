<script lang="ts">
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import { Ban, VolumeX, ChevronRight } from 'lucide-svelte'
</script>

<DetailHeader label="Moderation" />

<div class="settings-page">
  <div class="settings-group">
    <a href="/settings/moderation/blocked" class="settings-row">
      <Ban size={18} />
      <span class="settings-label">Blocked Users</span>
      <ChevronRight size={16} class="chevron" />
    </a>
    <a href="/settings/moderation/muted" class="settings-row">
      <VolumeX size={18} />
      <span class="settings-label">Muted Users</span>
      <ChevronRight size={16} class="chevron" />
    </a>
  </div>
</div>

<style>
  .settings-page {
    max-width: 600px;
    margin: 0 auto;
    padding: 16px;
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
</style>
