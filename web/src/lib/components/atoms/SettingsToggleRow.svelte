<script lang="ts">
  import Checkbox from './Checkbox.svelte'

  let {
    checked = $bindable(false),
    label,
    description,
  }: {
    checked: boolean
    label: string
    description?: string
  } = $props()
</script>

<div class="toggle-row">
  <Checkbox bind:checked {label} />
  {#if description}
    <span class="toggle-desc">{description}</span>
  {/if}
</div>

<style>
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
