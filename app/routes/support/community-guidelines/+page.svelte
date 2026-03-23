<script lang="ts">
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'
</script>

<OGMeta title="Community Guidelines - grain" />
<DetailHeader label="Community Guidelines" />

<div class="legal">
  <section>
    <h2>About Grain Social</h2>
    <p>
      Grain Social is a photo-sharing service built on the AT Protocol. These guidelines apply
      specifically to Grain Social. While the protocol is decentralized and supports many
      independent services, our focus is on fostering a respectful, creative, and safe experience
      within our app.
    </p>
  </section>

  <section>
    <h2>Our Principles</h2>
    <ul>
      <li><strong>User choice</strong>: We are committed to empowering users with control over where their data is stored, how their content is moderated, and which algorithms power their feeds.</li>
      <li><strong>Welcoming space</strong>: We aim to build a friendly, inclusive environment where people enjoy sharing and discovering photos.</li>
      <li><strong>Evolving standards</strong>: Our policies will adapt over time based on your feedback and the needs of the community.</li>
    </ul>
  </section>

  <section>
    <h2>What's Not Allowed</h2>
    <p>Don't use Grain Social to break the law, harm others, or disrupt the network. Specifically, do not:</p>
    <ul>
      <li>Promote hate groups or terrorism</li>
      <li>Share child sexual abuse material or any sexual content involving minors</li>
      <li>Engage in trafficking, exploitation, or predatory behavior</li>
      <li>Trade illegal goods or substances</li>
      <li>Share private personal info without consent</li>
      <li>Hack, phish, scam, or impersonate others</li>
      <li>Spam, abuse automation, or manipulate engagement</li>
      <li>Violate copyrights or trademarks</li>
      <li>Spread false or misleading election info</li>
      <li>Evade moderation actions by creating new accounts</li>
    </ul>
  </section>

  <section>
    <h2>Respect Others</h2>
    <p>We expect respectful conduct. This includes avoiding:</p>
    <ul>
      <li>Harassment, bullying, or targeted abuse</li>
      <li>Hate speech or extremist content</li>
      <li>Threats of violence or glorification of harm</li>
      <li>Promotion of self-harm or suicide</li>
      <li>Graphic violence or non-consensual sexual content</li>
      <li>Misleading impersonation of individuals or organizations</li>
    </ul>
  </section>

  <section>
    <h2>Reporting Violations</h2>
    <p>
      Help us keep the community safe. You can report photos, galleries, or accounts directly
      through the app or by contacting us at
      <a href="mailto:support@grain.social">support@grain.social</a>.
      Our moderation team will review and take action where needed.
    </p>
  </section>
</div>

<style>
  .legal {
    padding: 20px 16px 60px;
    max-width: 640px;
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
  ul {
    list-style: disc;
    padding-left: 20px;
    font-size: 14px;
    line-height: 1.6;
    color: var(--text-secondary);
  }
  li {
    margin-bottom: 4px;
  }
  a {
    color: var(--grain);
    text-decoration: none;
  }
  a:hover {
    text-decoration: underline;
  }
</style>
