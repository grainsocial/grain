<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query'
  import { labelDefsQuery } from '$lib/labels'
  import { ChevronDown } from 'lucide-svelte'

  let { selected = $bindable<string[]>([]) }: { selected: string[] } = $props()

  const selfLabelValues = ['nudity', 'sexual', 'gore']
  const labelDefs = createQuery(() => labelDefsQuery())

  let expanded = $state(false)

  const options = $derived(
    selfLabelValues.map((val) => {
      const def = (labelDefs.data ?? []).find((d) => d.identifier === val)
      return { value: val, label: def?.locales?.[0]?.name ?? val.charAt(0).toUpperCase() + val.slice(1) }
    })
  )

  function toggle(val: string) {
    if (selected.includes(val)) {
      selected = selected.filter((v) => v !== val)
    } else {
      selected = [...selected, val]
    }
  }
</script>

<div class="cw-picker">
  <button class="cw-header" onclick={() => (expanded = !expanded)} type="button">
    <span>Content Warning</span>
    <ChevronDown size={16} class={expanded ? 'rotated' : ''} />
  </button>
  {#if expanded}
    <div class="cw-options">
      {#each options as opt}
        <label class="cw-option">
          <input type="checkbox" checked={selected.includes(opt.value)} onchange={() => toggle(opt.value)} />
          <span>{opt.label}</span>
        </label>
      {/each}
    </div>
  {/if}
</div>

<style>
  .cw-picker {
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }
  .cw-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 10px 14px;
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 14px;
    font-family: var(--font-body);
    cursor: pointer;
  }
  .cw-header:hover {
    color: var(--text-primary);
  }
  .cw-header :global(.rotated) {
    transform: rotate(180deg);
  }
  .cw-options {
    border-top: 1px solid var(--border);
    padding: 8px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .cw-option {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    font-size: 14px;
    color: var(--text-primary);
  }
  .cw-option input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: var(--grain-btn);
    cursor: pointer;
  }
</style>
