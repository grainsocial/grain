<script lang="ts">
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import SettingsGroup from '$lib/components/atoms/SettingsGroup.svelte'
  import { Check, Monitor, Moon, Sun } from 'lucide-svelte'
  import { themePreference, setTheme, type ThemePreference } from '$lib/theme'

  const options: { value: ThemePreference; label: string; description: string; icon: any }[] = [
    { value: 'system', label: 'System', description: 'Match your device appearance', icon: Monitor },
    { value: 'light', label: 'Light', description: '', icon: Sun },
    { value: 'dark', label: 'Dark', description: '', icon: Moon },
  ]
</script>

<DetailHeader label="Appearance" />

<div class="settings-page">
  <SettingsGroup label="Theme">
    {#each options as option (option.value)}
      {@const Icon = option.icon}
      <button
        class="theme-row"
        aria-pressed={$themePreference === option.value}
        onclick={() => setTheme(option.value)}
      >
        <Icon size={18} />
        <span class="theme-text">
          <span>{option.label}</span>
          {#if option.description}
            <span class="theme-desc">{option.description}</span>
          {/if}
        </span>
        {#if $themePreference === option.value}
          <Check size={18} />
        {/if}
      </button>
    {/each}
  </SettingsGroup>
</div>

<style>
  .settings-page {
    max-width: 600px;
    margin: 0 auto;
    padding: 16px;
  }
  .theme-row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 14px 16px;
    background: none;
    border: none;
    color: var(--text-primary);
    font-family: inherit;
    font-size: 15px;
    text-align: left;
    cursor: pointer;
    transition: background 0.12s;
  }
  .theme-row:not(:last-child) {
    border-bottom: 1px solid var(--border);
  }
  .theme-row:hover {
    background: var(--bg-hover);
  }
  .theme-row[aria-pressed='true'] {
    color: var(--grain);
  }
  .theme-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .theme-desc {
    font-size: 12px;
    color: var(--text-muted);
  }
</style>
