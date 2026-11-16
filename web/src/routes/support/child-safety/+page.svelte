<script lang="ts">
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'
</script>

<OGMeta title="Child Safety Standards - grain" />
<DetailHeader label="Child Safety Standards" />

<div class="legal">
  <p class="updated">Last Updated: September 14, 2026</p>

  <section>
    <h2>Our Commitment</h2>
    <p>
      Grain (also referred to as Grain Social) is a photography community built on the AT Protocol.
      Grain has zero tolerance for child sexual abuse and exploitation (CSAE). This page sets out
      the standards we hold every account to, how we act on child safety material, and how to reach
      us. It applies to the Grain website and to the Grain apps for Android and iOS.
    </p>
  </section>

  <section>
    <h2>Definitions</h2>
    <p>
      <strong>Child sexual abuse and exploitation (CSAE)</strong> covers any conduct that sexually
      exploits, abuses, or endangers a person under the age of 18. It includes grooming, sextortion,
      the sexualisation of minors, trafficking, and the solicitation of minors for sexual purposes.
    </p>
    <p>
      <strong>Child sexual abuse material (CSAM)</strong> is any visual depiction of sexually
      explicit conduct involving a person under the age of 18.
    </p>
  </section>

  <section>
    <h2>Prohibited Conduct</h2>
    <p>Grain explicitly prohibits, and will act on, all of the following:</p>
    <ul>
      <li>Uploading, sharing, requesting, or linking to child sexual abuse material</li>
      <li>Any sexual content depicting, describing, or involving a minor</li>
      <li>Sexualising a minor, including through captions, alt text, comments, or hashtags</li>
      <li>Grooming, sextortion, or any attempt to solicit a minor for sexual purposes</li>
      <li>Trafficking, exploitation, or predatory behaviour directed at minors</li>
      <li>Promoting, normalising, or expressing support for CSAE</li>
      <li>Creating an account to evade enforcement of this policy</li>
    </ul>
    <p>
      These standards are additional to, and read alongside, our
      <a href="/support/community-guidelines">Community Guidelines</a> and
      <a href="/support/terms">Terms of Service</a>.
    </p>
  </section>

  <section>
    <h2>Reporting to Us</h2>
    <p>
      Every gallery, story, comment, and account on Grain carries a report control inside the app.
      Open the menu on the item, choose Report, pick the Child Safety category, and add any detail
      that helps us find the content. Reports go straight to our moderation queue and no account is
      needed beyond the one you are signed in with.
    </p>
    <p>
      You can also write to
      <a href="mailto:support@grain.social">support@grain.social</a> at any time. We accept reports
      from anyone, whether or not they hold a Grain account.
    </p>
    <p>
      Please do not download, save, or forward suspected child sexual abuse material in order to
      report it. Send us the link or the account name and we will take it from there.
    </p>
  </section>

  <section>
    <h2>How We Respond</h2>
    <p>
      On obtaining actual knowledge of child sexual abuse material, Grain removes it, preserves the
      records required by law, and terminates the account responsible. We treat child safety reports
      ahead of every other kind of report in our queue.
    </p>
    <p>
      Because Grain is built on the AT Protocol, content lives in a user's own repository. Where
      material sits outside our control, we remove it from Grain's views and feeds, refuse to serve
      it, and notify the hosting provider so they can act on their copy.
    </p>
  </section>

  <section>
    <h2>Compliance with Child Safety Laws</h2>
    <p>
      Grain complies with applicable child safety laws in the jurisdictions where it operates. We
      have a process in place to report confirmed child sexual abuse material to the National Center
      for Missing and Exploited Children (NCMEC), and to the relevant regional authority where
      NCMEC is not the designated body. We cooperate with lawful requests from law enforcement
      arising from those reports.
    </p>
  </section>

  <section>
    <h2>Child Safety Point of Contact</h2>
    <p>
      Our designated child safety point of contact is Chad Miller, reachable at
      <a href="mailto:support@grain.social">support@grain.social</a>. This address is monitored, and
      the contact is able to speak to Grain's review and enforcement procedures and to act on
      notifications from platform operators and child safety organisations.
    </p>
  </section>

  <section>
    <h2>Minimum Age</h2>
    <p>
      Grain is not directed at children. You must be at least 13 years old to hold a Grain account,
      or older where your jurisdiction sets a higher minimum. We remove accounts we determine to
      belong to someone below that age.
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
  ul {
    list-style: disc;
    padding-left: 20px;
    font-size: 14px;
    line-height: 1.6;
    color: var(--text-secondary);
    margin-bottom: 8px;
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
