<script lang="ts">
  let {
    message,
    visible = $bindable(false),
    duration = 2000,
  }: {
    message: string
    visible?: boolean
    duration?: number
  } = $props()

  $effect(() => {
    if (visible) {
      const t = setTimeout(() => (visible = false), duration)
      return () => clearTimeout(t)
    }
  })
</script>

{#if visible}
  <div class="toast">{message}</div>
{/if}

<style>
  .toast {
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--text-primary);
    color: var(--bg-root);
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 600;
    z-index: 100;
    animation: toast-in 0.2s ease;
  }
  @keyframes toast-in {
    from { opacity: 0; transform: translateX(-50%) translateY(8px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
</style>
