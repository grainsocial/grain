<script lang="ts">
  import type { HTMLTextareaAttributes } from 'svelte/elements'

  let {
    value = $bindable(''),
    ref = $bindable(null),
    ...rest
  }: HTMLTextareaAttributes & {
    value?: string
    ref?: HTMLTextAreaElement | null
  } = $props()
</script>

<textarea bind:value bind:this={ref} {...rest} class="textarea {rest.class ?? ''}"></textarea>

<style>
  .textarea {
    width: 100%;
    background: none;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 12px;
    color: var(--text-primary);
    font-family: inherit;
    font-size: 16px;
    resize: vertical;
    transition: border-color 0.15s;
  }
  .textarea:focus {
    outline: none;
    border-color: var(--grain);
  }
  .textarea::placeholder {
    color: var(--text-muted);
  }
  .textarea:disabled {
    opacity: 0.5;
  }
</style>
