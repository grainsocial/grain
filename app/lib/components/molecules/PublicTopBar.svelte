<script lang="ts">
  // Top bar for signed-out, full-bleed pages, where there is no left nav to
  // carry the wordmark or a way to sign in.
  import Button from '../atoms/Button.svelte'
  import { loginModalOpen } from '$lib/stores'

  // Matches the content column so the wordmark lines up with the page below it.
  let { maxWidth = '600px' }: { maxWidth?: string } = $props()
</script>

<header class="public-top">
  <div class="public-top-inner" style:max-width={maxWidth}>
    <a href="/" class="public-logo">grain</a>
    <Button size="sm" onclick={() => ($loginModalOpen = true)}>Sign in</Button>
  </div>
</header>

<style>
  .public-top {
    position: sticky;
    top: 0;
    z-index: 102;
    background: var(--bg-blur);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }
  .public-top-inner {
    margin: 0 auto;
    height: 60px;
    padding: 0 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .public-logo {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 24px;
    letter-spacing: -0.02em;
    color: var(--text-primary);
    text-decoration: none;
  }

  /* Mobile has its own top bar. */
  @media (max-width: 600px) {
    .public-top { display: none; }
  }
</style>
