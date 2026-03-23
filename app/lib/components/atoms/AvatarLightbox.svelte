<script lang="ts">
  import { X } from 'lucide-svelte'

  let { src, onclose }: { src: string; onclose: () => void } = $props()
</script>

<div class="avatar-lightbox" onclick={onclose} onkeydown={(e) => { if (e.key === 'Escape') onclose() }} role="button" tabindex="-1">
  <button class="avatar-lightbox-close" onclick={(e) => { e.stopPropagation(); onclose() }}><X size={24} /></button>
  <img {src} alt="" />
</div>

<style>
  .avatar-lightbox {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.15s;
    cursor: pointer;
  }
  .avatar-lightbox img {
    width: 280px;
    height: 280px;
    border-radius: 50%;
    object-fit: cover;
    border: 3px solid var(--border-light);
  }
  .avatar-lightbox-close {
    position: absolute;
    top: 16px;
    right: 16px;
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 8px;
  }
  .avatar-lightbox-close:hover { color: var(--text-primary); }
  @keyframes fadeIn { from { opacity: 0; } }
</style>
