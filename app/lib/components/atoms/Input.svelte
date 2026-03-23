<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements'

  let {
    value = $bindable(''),
    ref = $bindable(null),
    ...rest
  }: HTMLInputAttributes & {
    value?: string
    ref?: HTMLInputElement | null
  } = $props()
</script>

<input bind:value bind:this={ref} {...rest} class="input {rest.class ?? ''}" />

<style>
  .input {
    width: 100%;
    background: none;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 12px;
    color: var(--text-primary);
    font-family: inherit;
    font-size: 16px;
    transition: border-color 0.15s;
  }
  .input:focus {
    outline: none;
    border-color: var(--grain);
  }
  .input::placeholder {
    color: var(--text-muted);
  }
  .input:disabled {
    opacity: 0.5;
  }
</style>
