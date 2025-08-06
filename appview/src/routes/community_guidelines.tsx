import { BffContext, RouteHandler } from "@bigmoves/bff";
import { ComponentChildren } from "preact";
import { Breadcrumb } from "../components/Breadcrumb.tsx";
import { State } from "../state.ts";

export const handler: RouteHandler = (
  _req,
  _params,
  ctx: BffContext<State>,
) => {
  ctx.state.meta = [
    { title: "Community Guidelines — Grain" },
  ];
  return ctx.render(
    <div className="px-4 py-4">
      <Breadcrumb
        items={[{ label: "support", href: "/support" }, {
          label: "community guidelines",
        }]}
      />
      <h1 className="text-3xl font-bold mb-6 text-zinc-900 dark:text-white">
        Community Guidelines
      </h1>
      <Section title="About Grain Social">
        <p>
          Grain Social is a photo-sharing service built on the AT Protocol.
          These guidelines apply specifically to Grain Social. While the
          protocol is decentralized and supports many independent services, our
          focus is on fostering a respectful, creative, and safe experience
          within our app.
        </p>
      </Section>

      <Section title="Our Principles">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>User choice</strong>: We are committed to empowering users
            with control over where their data is stored, how their content is
            moderated, and which algorithms power their feeds (hopefully more
            options soon!).
          </li>
          <li>
            <strong>Welcoming space</strong>: We aim to build a friendly,
            inclusive environment where people enjoy sharing and discovering
            photos.
          </li>
          <li>
            <strong>Evolving standards</strong>: Our policies will adapt over
            time based on your feedback and the needs of the community.
          </li>
        </ul>
      </Section>

      <Section title="What’s Not Allowed">
        <p>
          Don't use Grain Social to break the law, harm others, or disrupt the
          network. Specifically, do not:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Promote hate groups or terrorism</li>
          <li>
            Share child sexual abuse material or any sexual content involving
            minors
          </li>
          <li>Engage in trafficking, exploitation, or predatory behavior</li>
          <li>Trade illegal goods or substances</li>
          <li>Share private personal info without consent</li>
          <li>Hack, phish, scam, or impersonate others</li>
          <li>Spam, abuse automation, or manipulate engagement</li>
          <li>Violate copyrights or trademarks</li>
          <li>Spread false or misleading election info</li>
          <li>
            Evade moderation actions (e.g., ban evasion) by creating new
            accounts
          </li>
        </ul>
      </Section>

      <Section title="Respect Others">
        <p>We expect respectful conduct. This includes avoiding:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Harassment, bullying, or targeted abuse</li>
          <li>Hate speech or extremist content</li>
          <li>Threats of violence or glorification of harm</li>
          <li>Promotion of self-harm or suicide</li>
          <li>Graphic violence or non-consensual sexual content</li>
          <li>Misleading impersonation of individuals or organizations</li>
        </ul>
      </Section>

      <Section title="Reporting Violations">
        <p>
          Help us keep the community safe. You can report photos, galleries, or
          accounts directly through the app (soon!) or by contacting us at{" "}
          <a
            href="mailto:support@grain.social"
            className="text-sky-500 underline hover:underline"
          >
            support@grain.social
          </a>
          . Our moderation team will review and take action where needed.
          Reports may consider off-platform context when relevant.
        </p>
      </Section>
    </div>,
  );
};

type SectionProps = {
  title: string;
  children: ComponentChildren;
};

const Section = ({ title, children }: SectionProps) => (
  <section className="mb-8">
    <h2 className="text-xl font-bold mb-2 text-zinc-800 dark:text-zinc-100">
      {title}
    </h2>
    <div className="space-y-2 text-zinc-700 dark:text-zinc-300">
      {children}
    </div>
  </section>
);
