<script lang="ts">
  import Skeleton from '../atoms/Skeleton.svelte'
</script>

<div class="skeleton-card">
  <div class="skeleton-header">
    <Skeleton circle height="32px" />
    <div class="skeleton-author">
      <Skeleton width="100px" height="14px" />
      <Skeleton width="70px" height="12px" />
    </div>
  </div>
  <div class="skeleton-image"><Skeleton width="100%" height="100%" radius="0" /></div>
  <div class="skeleton-engagement">
    <Skeleton circle height="18px" />
    <Skeleton width="20px" height="14px" />
    <Skeleton circle height="18px" />
  </div>
  <div class="skeleton-content">
    <Skeleton width="60%" height="14px" />
    <Skeleton width="90%" height="13px" />
    <Skeleton width="40px" height="11px" />
  </div>
</div>

<style>
  .skeleton-card {
    border-bottom: 1px solid var(--border);
  }
  .skeleton-header {
    display: flex; gap: 10px; align-items: center;
    padding: 12px 16px;
  }
  .skeleton-author {
    display: flex; flex-direction: column; gap: 4px;
  }
  .skeleton-image {
    width: 100%; aspect-ratio: 4/3;
  }
  .skeleton-engagement {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 16px;
  }
  .skeleton-content {
    display: flex; flex-direction: column; gap: 6px;
    padding: 0 16px 14px;
  }
</style>
