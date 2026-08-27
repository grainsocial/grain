<script lang="ts">
  import type { ExifView } from '$hatk/client'
  import { Camera, Aperture } from 'lucide-svelte'
  import { cleanCameraName } from '$lib/utils/cameraName'

  let { exif }: { exif: ExifView } = $props()

  const cameraName = $derived(
    cleanCameraName([exif.make, exif.model].filter(Boolean).join(' '))
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
        <!-- The raw make+model string. The camera feed normalizes whatever it
             is given (server/feeds/camera.ts), so this resolves to the same
             page as the cleaned name shown on /explore and /cameras. -->
        <a class="camera-link" href="/camera/{encodeURIComponent(cameraName)}">{cameraName}</a>
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
    padding: 10px 0;
    font-size: 13px;
    color: var(--text-muted);
  }
  .exif-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .camera-link {
    color: inherit;
    text-decoration: none;
    transition: color 0.12s;
  }
  .camera-link:hover {
    color: var(--grain);
  }
  .exif-settings {
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.01em;
  }
</style>
