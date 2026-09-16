<script lang="ts">
  // Shown where a group surface would be, when the viewer's PDS cannot serve
  // one. Groups are pools, a pool is a permissioned space, and every read of
  // one mints a delegation token on the viewer's *own* server — so this is not
  // something grain can work around on their behalf, and saying so is more
  // use than an empty grid.
  let { what = 'Groups' }: { what?: string } = $props()
</script>

<div class="spaces-required">
  <p class="lead">{what} need a PDS that serves permissioned spaces.</p>
  <p class="detail">
    A group's pool lives in a space rather than in public records, and reading one
    starts with a token your own server issues. Yours doesn't serve spaces yet, so
    there's nothing grain can show you here.
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
