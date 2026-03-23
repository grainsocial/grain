<script lang="ts">
  import { page } from '$app/state'
</script>

<div class="error-page">
  <span class="error-code">{page.status}</span>
  <h1 class="error-title">{page.error?.message}</h1>
  <a href="/" class="error-link">Back to home</a>
</div>

<style>
  .error-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 24px;
    text-align: center;
    gap: 8px;
  }
  .error-code {
    font-family: var(--font-display);
    font-size: 72px;
    font-weight: 800;
    color: var(--grain);
    line-height: 1;
  }
  .error-title {
    font-family: var(--font-display);
    font-size: 24px;
    font-weight: 700;
    color: var(--text-primary);
  }
.error-link {
    margin-top: 16px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px 20px;
    background: var(--grain-btn);
    color: #fff;
    border-radius: 20px;
    font-weight: 600;
    font-size: 14px;
    font-family: var(--font-body);
    transition: all 0.12s;
  }
  .error-link:hover {
    background: var(--grain-btn-dim);
  }
</style>
