<script lang="ts">
  import type { ExifView } from '$hatk/client'
  import { Camera, Aperture } from 'lucide-svelte'

  let { exif }: { exif: ExifView } = $props()

  const cameraName = $derived(
    [exif.make, exif.model].filter(Boolean).join(' ')
  )
  const lensName = $derived(
    exif.lensModel || [exif.lensMake, exif.lensModel].filter(Boolean).join(' ')
  )
  const settings = $derived(
    [exif.focalLengthIn35mmFormat, exif.fNumber, exif.exposureTime, exif.iSO ? `ISO ${exif.iSO}` : '']
      .filter(Boolean)
      .join('  ·  ')
  )
</script>

{#if cameraName || lensName || settings}
  <div class="exif-info">
    {#if cameraName}
      <div class="exif-row">
        <Camera size={14} />
        <span>{cameraName}</span>
      </div>
    {/if}
    {#if lensName}
      <div class="exif-row">
        <Aperture size={14} />
        <span>{lensName}</span>
      </div>
    {/if}
    {#if settings}
      <div class="exif-settings">{settings}</div>
    {/if}
  </div>
{/if}

<style>
  .exif-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 16px;
    font-size: 12px;
    color: var(--text-muted);
  }
  .exif-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .exif-settings {
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.01em;
  }
</style>
