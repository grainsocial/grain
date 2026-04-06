<script lang="ts">
  import { MapPin, LoaderCircle } from 'lucide-svelte'
  import { searchLocations, formatLocationName, formatGeoContext, formatStreet, extractAddress, type NominatimResult } from '$lib/utils/nominatim'
  import { latLonToH3 } from '$lib/utils/h3'
  import type { Gallery } from '$hatk/client'

  export type AddressData = NonNullable<Gallery['address']>

  export interface LocationData {
    name: string
    h3Index: string
    address?: AddressData
  }

  let {
    value = $bindable<LocationData | null>(null),
    placeholder = 'Search for a location...',
  }: {
    value?: LocationData | null
    placeholder?: string
  } = $props()

  let inputValue = $state(value?.name ?? '')
  let suggestions = $state<NominatimResult[]>([])
  let loading = $state(false)
  let showDropdown = $state(false)
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let wrapper: HTMLDivElement = $state()!

  $effect(() => {
    if (value) inputValue = value.name
  })

  function handleInput(e: Event) {
    const val = (e.target as HTMLInputElement).value
    inputValue = val
    if (!val.trim()) {
      value = null
      suggestions = []
      showDropdown = false
      return
    }
    if (val.trim().length < 2) return
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(async () => {
      loading = true
      suggestions = await searchLocations(val)
      showDropdown = suggestions.length > 0
      loading = false
    }, 300)
  }

  function select(result: NominatimResult) {
    const lat = parseFloat(result.lat)
    const lon = parseFloat(result.lon)
    const name = formatLocationName(result)
    const h3Index = latLonToH3(lat, lon)
    const address = extractAddress(result) ?? undefined
    value = { name, h3Index, ...(address ? { address } : {}) }
    inputValue = name
    showDropdown = false
    suggestions = []
  }

  function handleClickOutside(e: MouseEvent) {
    if (wrapper && !wrapper.contains(e.target as Node)) {
      showDropdown = false
    }
  }

  function clear() {
    value = null
    inputValue = ''
    suggestions = []
    showDropdown = false
  }

</script>

<svelte:document onclick={handleClickOutside} />

<div class="location-input" bind:this={wrapper}>
  <div class="input-wrapper">
    <span class="input-icon"><MapPin size={14} /></span>
    <input
      type="text"
      value={inputValue}
      oninput={handleInput}
      {placeholder}
      class="input"
    />
    {#if loading}
      <span class="input-spinner"><LoaderCircle size={14} class="spin" /></span>
    {:else if value}
      <button class="input-clear" type="button" onclick={clear}>&times;</button>
    {/if}
  </div>
  {#if showDropdown && suggestions.length > 0}
    <div class="dropdown">
      {#each suggestions as result (result.place_id)}
        {@const context = formatGeoContext(result)}
        {@const street = formatStreet(result)}
        <button class="dropdown-item" type="button" onclick={() => select(result)}>
          <MapPin size={12} />
          <span>
            {formatLocationName(result)}
            {#if street || context}
              <span class="dropdown-context">{[street, context].filter(Boolean).join(' · ')}</span>
            {/if}
          </span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .location-input {
    position: relative;
  }
  .input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }
  .input-icon {
    position: absolute;
    left: 12px;
    color: var(--text-faint);
    display: flex;
    align-items: center;
    pointer-events: none;
  }
  .input {
    width: 100%;
    background: none;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 36px 10px 34px;
    color: var(--text-primary);
    font-family: inherit;
    font-size: 16px;
    outline: none;
    transition: border-color 0.15s;
  }
  .input::placeholder {
    color: var(--text-muted);
  }
  .input:focus {
    border-color: var(--grain);
  }
  .input-spinner {
    position: absolute;
    right: 12px;
    color: var(--text-faint);
    display: flex;
    align-items: center;
  }
  .input-clear {
    position: absolute;
    right: 10px;
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 18px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
  }
  .input-clear:hover {
    color: var(--text-primary);
  }
  .dropdown {
    position: absolute;
    z-index: 50;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 4px;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 10px 14px;
    background: none;
    border: none;
    border-bottom: 1px solid var(--border);
    color: var(--text-secondary);
    font-size: 13px;
    font-family: var(--font-body);
    cursor: pointer;
    text-align: left;
    transition: background 0.12s;
  }
  .dropdown-item:last-child {
    border-bottom: none;
  }
  .dropdown-item:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  .dropdown-context {
    display: block;
    font-size: 11px;
    color: var(--text-muted);
  }
</style>
