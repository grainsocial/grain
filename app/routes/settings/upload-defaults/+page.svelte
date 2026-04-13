<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query'
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import Checkbox from '$lib/components/atoms/Checkbox.svelte'
  import { setIncludeExif, setIncludeLocation } from '$lib/preferences'
  import { preferencesQuery } from '$lib/queries'

  const prefs = createQuery(() => preferencesQuery())

  let localIncludeLocation = $state(true)
  let localIncludeExif = $state(true)
  let loaded = $state(false)

  $effect(() => {
    if (loaded || prefs.isLoading || !prefs.data) return
    if (typeof prefs.data.includeLocation === 'boolean') {
      localIncludeLocation = prefs.data.includeLocation as boolean
    }
    if (typeof prefs.data.includeExif === 'boolean') {
      localIncludeExif = prefs.data.includeExif as boolean
    }
    loaded = true
  })

  $effect(() => {
    if (!loaded) return
    void setIncludeLocation(localIncludeLocation)
  })

  $effect(() => {
    if (!loaded) return
    void setIncludeExif(localIncludeExif)
  })
</script>

<DetailHeader label="Upload Defaults" />

<div class="settings-page">
  <div class="settings-group">
    <div class="toggle-row">
      <Checkbox bind:checked={localIncludeLocation} label="Include location" />
      <span class="toggle-desc">Auto-detected from photo metadata</span>
    </div>
    <div class="toggle-row">
      <Checkbox bind:checked={localIncludeExif} label="Include camera data" />
      <span class="toggle-desc">Make, model, and exposure info</span>
    </div>
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
  .toggle-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 14px 16px;
    color: var(--text-primary);
  }
  .toggle-row:not(:last-child) {
    border-bottom: 1px solid var(--border);
  }
  .toggle-desc {
    font-size: 12px;
    color: var(--text-muted);
    padding-left: 28px;
  }
</style>
