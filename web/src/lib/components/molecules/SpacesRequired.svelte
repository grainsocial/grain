<script lang="ts">
  // Shown where a group surface would be, when the viewer's PDS cannot serve
  // one. Groups are pools, a pool is a permissioned space, and every read of
  // one mints a delegation token on the viewer's *own* server — so this is not
  // something grain can work around on their behalf, and saying so is more
  // use than an empty grid.
  let { what = 'Groups' }: { what?: string } = $props()
</script>

<div class="spaces-required">
  <p class="lead">{what} aren't available for your account yet.</p>
  <p class="detail">
    Your account is hosted somewhere that doesn't support private sharing yet. Once it
    does, they'll show up here.
  </p>
</div>

<style>
  .spaces-required {
    padding: 2rem 1rem;
    text-align: center;
    max-width: 32rem;
    margin: 0 auto;
  }
  .lead {
    font-weight: 600;
    margin-bottom: 0.5rem;
  }
  .detail {
    color: var(--color-text-muted, #666);
    font-size: 0.9rem;
    line-height: 1.5;
  }
</style>
