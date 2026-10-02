import { defineClassifier } from "$hatk";

/**
 * Identity questions run on the handle and profile alone, with no content gate:
 * an impersonation account typically posts nothing, so gating on content would
 * score everything except the accounts this exists to find.
 *
 * `identity_use` and `passing_as` are asked separately so the parody question
 * stays a policy decision here rather than a judgement baked into the criteria:
 * a declared parody account scores high on the first and low on the second.
 */
export default defineClassifier({
  subject: "account",
  label: "impersonation",
  // Only the stronger claim files a report. `identity_use` is recorded for
  // every account and shown in the queue, but a fan account that says so is
  // not on its own a violation of the guidelines as written.
  threshold: { passing_as: 0.7 },
  questions: {
    identity_use: {
      type: "noul",
      instructions:
        "Does this account trade on the identity of a specific famous real person, company, or brand — whether or not it admits to being a parody or fan account?",
      criteria: {
        true: "The handle, display name, or bio is built around a famous person's or brand's name and draws on their identity for attention. Parody, fan and tribute accounts COUNT as true here.",
        false:
          "An ordinary account. A name that merely coincides with, or puns on, a famous one without drawing on that identity is false.",
      },
    },
    passing_as: {
      type: "noul",
      // Each question carries its own premise. Clef answers them in parallel, so
      // this one cannot lean on `identity_use` and names the fame condition
      // itself — without it the question reduces to "does this person state a
      // job title?", which every real founder answers yes to.
      instructions:
        "Does this account claim to BE a specific famous person, company, or brand that it is not — using that famous name as its own identity and writing as though it were them?",
      criteria: {
        true: "Adopts a well-known person's or brand's name and speaks as them, asserting their fame, company, or achievements as its own.",
        false:
          "An ordinary person describing their own real life and work — INCLUDING their genuine job title, their own company, and their own accomplishments, however senior. Someone who founded a company nobody has heard of is not impersonating anyone. Also false for an openly labelled fan, parody, or commentary account.",
      },
    },
  },

  async buildState({ db, subject }) {
    const [profile] = (await db.query(
      `SELECT display_name, description FROM "social.grain.actor.profile" WHERE did = $1 LIMIT 1`,
      [subject.did],
    )) as { display_name: string | null; description: string | null }[];

    return {
      handle: subject.handle,
      displayName: profile?.display_name || null,
      bio: profile?.description || null,
    };
  },
});
