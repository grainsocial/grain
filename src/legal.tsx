import { ComponentChildren } from "preact";
import { Breadcrumb } from "./components/Breadcrumb.tsx";

type SectionProps = {
  title: string;
  children: ComponentChildren;
};

const Section = ({ title, children }: SectionProps) => (
  <section className="mb-8">
    <h2 className="text-xl font-bold mb-2 text-zinc-800 dark:text-zinc-100">
      {title}
    </h2>
    <div className="space-y-2 text-zinc-700 dark:text-zinc-300 text-sm">
      {children}
    </div>
  </section>
);

export function Terms() {
  return (
    <div className="px-4 py-4">
      <Breadcrumb
        items={[{ label: "support", href: "/support" }, { label: "terms" }]}
      />
      <h1 className="text-3xl font-bold mb-6 text-zinc-900 dark:text-white">
        Terms and Conditions
      </h1>
      <div className="mb-6 text-sm text-zinc-900 dark:text-white">
        Last Updated: June 3, 2025
      </div>
      <Section title="Overview">
        <p>
          Grain is a photo sharing app built on the{" "}
          <a
            href="https://atproto.com/"
            className="text-sky-500 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          />
          AT Protocol . All data, including photos, galleries, favorites, and
          metadata, is public and stored on the AT Protocol network. Users can
          upload photos, create and favorite galleries, and view non-location
          EXIF metadata.
        </p>
        <p>
          Grain is an open source project. These Terms apply to your use of the
          hosted version at{" "}
          <code>grain.social</code>, not to self-hosted instances or forks of
          the source code.
        </p>
      </Section>

      <Section title="Account and Data Ownership">
        <p>
          Grain uses the AT Protocol, so users retain full control over their
          data. We are an independent project and not affiliated with Bluesky or
          the AT Protocol.
        </p>
        <p>
          If you use a <code>grain.social</code>{" "}
          handle, your data may be stored on our own self-hosted{" "}
          <a
            href="https://atproto.com/guides/glossary#pds-personal-data-server"
            className="text-sky-500 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            PDS (Personal Data Server)
          </a>{" "}
          in accordance with protocol standards.
        </p>
      </Section>

      <Section title="Content">
        <p>
          You are responsible for any content you share. Do not upload content
          you do not have rights to. All uploads are publicly visible and cannot
          currently be set as private.
        </p>
      </Section>

      <Section title="Analytics">
        <p>
          We use{" "}
          <a
            href="https://www.goatcounter.com/"
            className="text-sky-500 hover:underline"
          >
            Goatcounter
          </a>{" "}
          for basic analytics. No personal data is collected, tracked, or sold.
        </p>
      </Section>

      <Section title="Prohibited Conduct">
        <p>
          Do not upload illegal content, harass users, impersonate others, or
          attempt to disrupt the network.
        </p>
      </Section>

      <Section title="Disclaimers">
        <p>
          Grain is provided "as is." We do not guarantee uptime, data retention,
          or uninterrupted access.
        </p>
      </Section>

      <Section title="Termination">
        <p>
          We reserve the right to suspend or terminate your access to Grain at
          any time, without prior notice, for conduct that we believe violates
          these Terms, our community standards, or is harmful to other users or
          the AT Protocol network. Terminated accounts may lose access to
          uploaded content unless retained through the protocol’s data
          persistence mechanisms.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          We may update these terms periodically. Continued use means acceptance
          of any changes.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          For any questions about these Terms, your account, or issues with the
          app, you can contact us at{" "}
          <a
            href="mailto:support@grain.social"
            className="text-sky-500 hover:underline"
          >
            support@grain.social
          </a>.
        </p>
      </Section>
    </div>
  );
}

export function PrivacyPolicy() {
  return (
    <div className="px-4 py-4">
      <Breadcrumb
        items={[{ label: "support", href: "/support" }, { label: "privacy" }]}
      />
      <h1 className="text-3xl font-bold mb-6 text-zinc-900 dark:text-white">
        Privacy Policy
      </h1>
      <div className="mb-6 text-sm text-zinc-900 dark:text-white">
        Last Updated: June 3, 2025
      </div>
      <Section title="Data Storage and Access">
        <p>
          Your data is stored on the AT Protocol. If you use a{" "}
          <code>grain.social</code>{" "}
          handle, it may be stored on our PDS. We do not store or access data
          beyond the protocol’s standard behavior.
        </p>
      </Section>

      <Section title="Public Data">
        <p>
          All content on Grain is public. Private uploads are not currently
          supported.
        </p>
      </Section>

      {
        /* Coming soon */
        /* <Section title="EXIF Metadata">
        <p>
          We optionally collect and display EXIF metadata (excluding location)
          from your photos. At upload time, you can choose whether to allow this
          metadata to be collected. The metadata is stored according to standard
          AT Protocol storage mechanisms and is not retained outside the
          protocol or used for other purposes.
        </p>
        <p>
          You can learn more about the types of metadata commonly embedded in
          photos at{" "}
          <a
            href="https://exiv2.org/tags.html"
            className="text-sky-500 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            exiv2.org
          </a>
          .
        </p>
      </Section> */
      }

      <Section title="Analytics">
        <p>
          We use{" "}
          <a
            href="https://www.goatcounter.com/"
            className="text-sky-500 hover:underline"
          >
            Goatcounter
          </a>{" "}
          for analytics. It is privacy-focused: no IP addresses, cookies, or
          personal data is collected.
        </p>
      </Section>

      <Section title="No Ads or Tracking">
        <p>We do not serve ads, use third-party tracking, or sell user data.</p>
      </Section>

      <Section title="Children’s Privacy">
        <p>Grain is not intended for users under 13 years of age.</p>
      </Section>

      <Section title="Changes to Policy">
        <p>
          This policy may be updated. Material changes will be communicated via
          the app or site.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          For privacy questions, contact us at{" "}
          <a
            href="mailto:support@grain.social"
            className="text-sky-500 hover:underline"
          >
            support@grain.social
          </a>.
        </p>
      </Section>
    </div>
  );
}

export function CopyrightPolicy() {
  return (
    <div className="px-4 py-4">
      <Breadcrumb
        items={[{ label: "support", href: "/support" }, { label: "copyright" }]}
      />
      <h1 className="text-3xl font-bold mb-6 text-zinc-900 dark:text-white">
        Copyright Policy
      </h1>
      <div className="mb-6 text-sm text-zinc-900 dark:text-white">
        Last Updated: June 3, 2025
      </div>
      <Section title="Copyright Infringement">
        <p>
          Grain respects the intellectual property rights of others and expects
          users to do the same. If you believe your copyrighted work has been
          used in a way that constitutes infringement, please notify us
          promptly.
        </p>
      </Section>

      <Section title="Notice Requirements">
        <p>
          Your infringement notice must include: (1) a description of the
          copyrighted work, (2) the location of the infringing material, (3)
          your contact information, (4) a statement that you believe in good
          faith the use is not authorized, and (5) a statement, under penalty of
          perjury, that the information is accurate.
        </p>
      </Section>

      <Section title="DMCA Compliance">
        <p>
          Grain complies with the Digital Millennium Copyright Act (DMCA). If
          you are a copyright holder and believe your rights have been violated,
          you may file a DMCA notice with the required information to our
          designated agent. We will promptly respond to all valid DMCA notices
          and take appropriate action, including removal of the infringing
          content and disabling access.
        </p>
      </Section>

      <Section title="Repeat Infringers">
        <p>
          Accounts that repeatedly infringe copyright may be suspended or
          removed in accordance with AT Protocol and Grain Social’s moderation
          guidelines.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          To report infringement or submit a DMCA notice, contact us at{" "}
          <a
            href="mailto:support@grain.social"
            className="text-sky-500 hover:underline"
          >
            support@grain.social
          </a>.
        </p>
      </Section>
    </div>
  );
}
