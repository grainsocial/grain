import { defineClassifier } from "$hatk";

/**
 * Scam personas are judged from the profile, because that is where they live: a
 * stated age and profession, an emotive line about connection, and nothing
 * behind it. The gate is a bio *or* any content, not content alone — these
 * accounts often carry a filled-in profile and a single post.
 */
export default defineClassifier({
  subject: "account",
  label: (signal) => (signal === "financial_scam" ? "spam" : "other"),
  // Clef puts an empty-bio account at 0.55–0.6 on `romance_persona`, grain's own
  // account included; the personas behind real takedowns scored 0.69 and up.
  threshold: { romance_persona: 0.65, financial_scam: 0.5 },
  questions: {
    romance_persona: {
      type: "noul",
      instructions:
        "Is this profile a fabricated persona of the kind used to run romance or confidence scams?",
      criteria: {
        true: "An idealised stranger persona — stated profession and age, emotive bio about love, loneliness or connection, follow-bait — with little real photographic content behind it.",
        false: "A real person's profile, whatever its tone.",
      },
    },
    financial_scam: {
      type: "noul",
      instructions:
        "Does this account advertise money, winnings, giveaways, crypto, or investment returns in a way characteristic of advance-fee or giveaway scams?",
      criteria: {
        true: "Claims of lottery/prize winnings, offers to share money, or promises of guaranteed or fast investment/crypto returns aimed at strangers.",
        false:
          "No such offer. Mentioning one's job in finance, or a tip jar, donation link, or Ko-fi for one's own creative work, is not a scam.",
      },
    },
  },

  async buildState({ db, subject }) {
    const [profile] = (await db.query(
      `SELECT display_name, description FROM "social.grain.actor.profile" WHERE did = $1 LIMIT 1`,
      [subject.did],
    )) as { display_name: string | null; description: string | null }[];

    const galleries = (await db.query(
      `SELECT title, description FROM "social.grain.gallery" WHERE did = $1 LIMIT 6`,
      [subject.did],
    )) as { title: string; description: string | null }[];

    // Nothing written and nothing posted is nothing to judge.
    if (!profile?.description && !profile?.display_name && !galleries.length) return null;

    return {
      handle: subject.handle,
      displayName: profile?.display_name || null,
      bio: profile?.description || null,
      galleries: galleries.map((g) => ({ title: g.title, description: g.description || null })),
    };
  },
});
