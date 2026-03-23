<script lang="ts">
  let {
    width = '100%',
    height = '16px',
    radius = '4px',
    circle = false,
  }: {
    width?: string
    height?: string
    radius?: string
    circle?: boolean
  } = $props()

  const style = $derived(
    circle
      ? `width:${height};height:${height};border-radius:50%`
      : `width:${width};height:${height};border-radius:${radius}`
  )
</script>

<div class="skeleton" {style}></div>

<style>
  .skeleton {
    background: linear-gradient(
      90deg,
      var(--bg-elevated) 0%,
      var(--border) 40%,
      var(--bg-elevated) 80%
    );
    background-size: 300% 100%;
    animation: shimmer 1.8s ease-in-out infinite;
  }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -100% 0; }
  }
</style>
