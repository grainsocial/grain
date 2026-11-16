<script lang="ts">
  import { Check } from 'lucide-svelte'

  let { checked = false, onMedia = false }: { checked?: boolean; onMedia?: boolean } = $props()
</script>

{#if checked}
  <div class="check-on"><Check size={14} /></div>
{:else}
  <div class="check-off" class:on-media={onMedia}></div>
{/if}

<style>
  .check-on {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--grain);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .check-off {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid var(--border);
  }
  .check-off.on-media {
    border-color: #fff;
    background: rgba(0, 0, 0, 0.3);
  }
</style>
