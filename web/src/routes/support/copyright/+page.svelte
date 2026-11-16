<script lang="ts">
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'
</script>

<OGMeta title="Copyright Policy - grain" />
<DetailHeader label="Copyright Policy" />

<div class="legal">
  <p class="updated">Last Updated: June 3, 2025</p>

  <section>
    <h2>Copyright Infringement</h2>
    <p>
      Grain respects the intellectual property rights of others and expects users to do the same.
      If you believe your copyrighted work has been used in a way that constitutes infringement,
      please notify us promptly.
    </p>
  </section>

  <section>
    <h2>Notice Requirements</h2>
    <p>
      Your infringement notice must include: (1) a description of the copyrighted work, (2) the
      location of the infringing material, (3) your contact information, (4) a statement that you
      believe in good faith the use is not authorized, and (5) a statement, under penalty of
      perjury, that the information is accurate.
    </p>
  </section>

  <section>
    <h2>DMCA Compliance</h2>
    <p>
      Grain complies with the Digital Millennium Copyright Act (DMCA). If you are a copyright
      holder and believe your rights have been violated, you may file a DMCA notice with the
      required information to our designated agent. We will promptly respond to all valid DMCA
      notices and take appropriate action, including removal of the infringing content and
      disabling access.
    </p>
  </section>

  <section>
    <h2>Repeat Infringers</h2>
    <p>
      Accounts that repeatedly infringe copyright may be suspended or removed in accordance with
      AT Protocol and Grain Social's moderation guidelines.
    </p>
  </section>

  <section>
    <h2>Contact</h2>
    <p>
      To report infringement or submit a DMCA notice, contact us at
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
</style>
