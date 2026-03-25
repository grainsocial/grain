<script lang="ts">
  let { checked = $bindable(false), label }: { checked: boolean; label: string } = $props()
</script>

<label class="checkbox">
  <input type="checkbox" bind:checked />
  <span class="checkbox-label">{label}</span>
</label>

<style>
  .checkbox {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    font-size: 14px;
    color: var(--text-secondary);
  }
  .checkbox input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: var(--grain-btn);
    cursor: pointer;
  }
</style>
