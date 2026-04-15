<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query'
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import SettingsGroup from '$lib/components/atoms/SettingsGroup.svelte'
  import SettingsToggleRow from '$lib/components/atoms/SettingsToggleRow.svelte'
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

<DetailHeader label="Privacy" />

<div class="settings-page">
  <SettingsGroup label="Defaults for new uploads">
    <SettingsToggleRow bind:checked={localIncludeLocation} label="Include location" description="Auto-detected from photo metadata" />
    <SettingsToggleRow bind:checked={localIncludeExif} label="Include camera data" description="Make, model, and exposure info" />
  </SettingsGroup>
</div>

<style>
  .settings-page {
    max-width: 600px;
    margin: 0 auto;
    padding: 16px;
  }
</style>
