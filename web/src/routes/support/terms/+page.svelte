<script lang="ts">
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'
</script>

<OGMeta title="Terms and Conditions - grain" />
<DetailHeader label="Terms and Conditions" />

<div class="legal">
  <p class="updated">Last Updated: June 3, 2025</p>

  <section>
    <h2>Overview</h2>
    <p>
      Grain is a photo sharing app built on the
      <a href="https://atproto.com/" target="_blank" rel="noopener noreferrer">AT Protocol</a>.
      All data, including photos, galleries, favorites, and metadata, is public and stored on the
      AT Protocol network. Users can upload photos, create and favorite galleries, and view
      non-location EXIF metadata.
    </p>
    <p>
      Grain is an open source project. These Terms apply to your use of the hosted version at
      <code>grain.social</code>, not to self-hosted instances or forks of the source code.
    </p>
  </section>

  <section>
    <h2>Account and Data Ownership</h2>
    <p>
      Grain uses the AT Protocol, so users retain full control over their data. We are an
      independent project and not affiliated with Bluesky or the AT Protocol.
    </p>
    <p>
      If you use a <code>grain.social</code> handle, your data may be stored on our own self-hosted
      <a href="https://atproto.com/guides/glossary#pds-personal-data-server" target="_blank" rel="noopener noreferrer">PDS (Personal Data Server)</a>
      in accordance with protocol standards.
    </p>
  </section>

  <section>
    <h2>Content</h2>
    <p>
      You are responsible for any content you share. Do not upload content you do not have rights
      to. All uploads are publicly visible and cannot currently be set as private.
    </p>
  </section>

  <section>
    <h2>Analytics</h2>
    <p>
      We use <a href="https://www.goatcounter.com/">Goatcounter</a> for basic analytics. No
      personal data is collected, tracked, or sold.
    </p>
  </section>

  <section>
    <h2>Prohibited Conduct</h2>
    <p>
      Do not upload illegal content, harass users, impersonate others, or attempt to disrupt the
      network.
    </p>
  </section>

  <section>
    <h2>Disclaimers</h2>
    <p>
      Grain is provided "as is." We do not guarantee uptime, data retention, or uninterrupted
      access.
    </p>
  </section>

  <section>
    <h2>Termination</h2>
    <p>
      We reserve the right to suspend or terminate your access to Grain at any time, without prior
      notice, for conduct that we believe violates these Terms, our community standards, or is
      harmful to other users or the AT Protocol network. Terminated accounts may lose access to
      uploaded content unless retained through the protocol's data persistence mechanisms.
    </p>
  </section>

  <section>
    <h2>Changes</h2>
    <p>We may update these terms periodically. Continued use means acceptance of any changes.</p>
  </section>

  <section>
    <h2>Contact</h2>
    <p>
      For any questions about these Terms, your account, or issues with the app, you can contact
      us at <a href="mailto:support@grain.social">support@grain.social</a>.
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
