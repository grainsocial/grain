<script lang="ts">
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'
</script>

<OGMeta title="Privacy Policy - grain" />
<DetailHeader label="Privacy Policy" />

<div class="legal">
  <p class="updated">Last Updated: June 3, 2025</p>

  <section>
    <h2>Data Storage and Access</h2>
    <p>
      Your data is stored on the AT Protocol. If you use a <code>grain.social</code> handle, it
      may be stored on our PDS. We do not store or access data beyond the protocol's standard
      behavior.
    </p>
  </section>

  <section>
    <h2>Public Data</h2>
    <p>All content on Grain is public. Private uploads are not currently supported.</p>
  </section>

  <section>
    <h2>EXIF Metadata</h2>
    <p>
      We optionally collect and display EXIF metadata from your photos. At upload time, you can
      choose whether to allow this metadata to be collected. The metadata is stored according to
      standard AT Protocol storage mechanisms and is not retained outside the protocol or used for
      other purposes. We do not collect GPS or location data from your photos.
    </p>
    <p>
      You can learn more about the types of metadata commonly embedded in photos at
      <a href="https://exiv2.org/tags.html" target="_blank" rel="noopener noreferrer">exiv2.org</a>.
    </p>
  </section>

  <section>
    <h2>Analytics</h2>
    <p>
      We use <a href="https://www.goatcounter.com/">Goatcounter</a> for analytics. It is
      privacy-focused: no IP addresses, cookies, or personal data is collected.
    </p>
  </section>

  <section>
    <h2>No Ads or Tracking</h2>
    <p>We do not serve ads, use third-party tracking, or sell user data.</p>
  </section>

  <section>
    <h2>Children's Privacy</h2>
    <p>Grain is not intended for users under 13 years of age.</p>
  </section>

  <section>
    <h2>Changes to Policy</h2>
    <p>
      This policy may be updated. Material changes will be communicated via the app or site.
    </p>
  </section>

  <section>
    <h2>Contact</h2>
    <p>
      For privacy questions, contact us at
      <a href="mailto:support@grain.social">support@grain.social</a>.
    </p>
  </section>
</div>

<style>
  .legal {
    padding: 20px 16px 60px;
    max-width: 640px;
  }
  .updated {
    font-size: 13px;
    color: var(--text-muted);
    margin-bottom: 24px;
  }
  section {
    margin-bottom: 28px;
  }
  h2 {
    font-size: 17px;
    font-weight: 700;
    margin-bottom: 8px;
    color: var(--text-primary);
  }
  p {
    font-size: 14px;
    line-height: 1.6;
    color: var(--text-secondary);
    margin-bottom: 8px;
  }
  a {
    color: var(--grain);
    text-decoration: none;
  }
  a:hover {
    text-decoration: underline;
  }
  code {
    background: var(--bg-elevated);
    padding: 1px 5px;
    border-radius: 4px;
    font-size: 13px;
  }
</style>
