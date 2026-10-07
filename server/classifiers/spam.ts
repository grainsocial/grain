import { defineClassifier } from "$hatk";

const MIN_GALLERIES = 5;

/**
 * Spam judged from what an account has posted. An account with fewer than
 * {@link MIN_GALLERIES} galleries is skipped: "does this exist only to drive
 * traffic, with no content of its own?" is trivially true of a profile whose
 * only text is a bio carrying a link, and stories contribute no text at all.
 * Traffic spam is a volume pattern; a single spam gallery is gallery-spam's to
 * catch.
 *
 * Both questions name their benign case explicitly. A photographer with a
 * portfolio link and an openly declared bot are permitted — the guidelines
 * prohibit abusing automation, not using it.
 */
export default defineClassifier({
  subject: "account",
  label: "spam",
  threshold: 0.5,
  questions: {
    traffic_spam: {
      type: "noul",
      instructions:
        "Does this account exist only to drive traffic elsewhere, with no genuine content of its own?",
      criteria: {
        true: "The galleries are bare links, repeated identical promotional listings, or keyword-stuffed adverts. Strip the outbound links and nothing of substance remains. Every gallery holds photographs the account uploaded, so judge the gallery text, not the bio: a link in the bio says nothing on its own.",
        false:
          "A real photographer, artist, developer, musician or writer sharing their own work, EVEN IF the bio or galleries link to a portfolio, shop, blog, Ko-fi, newsletter, or product they made. A link is not spam. Short, plain or default titles such as 'Untitled photo' are ordinary photo posts, not missing content.",
      },
    },
    undisclosed_automation: {
      type: "noul",
      instructions:
        "Is this account running undisclosed bulk automation? Grain's guidelines prohibit ABUSING automation, not using it — an openly declared bot is permitted.",
      criteria: {
        true: "Templated, machine-generated posting at volume with NO disclosure that the account is automated, and no human curation behind it.",
        false:
          "Either not automated, OR automated and openly says so (e.g. 'bot', 'robot account', 'automated', names the human who runs it). A person who simply uploads a lot of photos is not automation.",
      },
    },
  },

  async buildState({ db, subject }) {
    const [counts] = (await db.query(
      `SELECT
         (SELECT COUNT(*) FROM "social.grain.gallery" WHERE did = $1) AS galleries,
         (SELECT COUNT(*) FROM "social.grain.photo"   WHERE did = $1) AS photos,
         (SELECT COUNT(*) FROM "social.grain.story"   WHERE did = $1) AS stories`,
      [subject.did],
    )) as { galleries: number; photos: number; stories: number }[];

    const galleries = Number(counts?.galleries ?? 0);
    const photos = Number(counts?.photos ?? 0);
    const stories = Number(counts?.stories ?? 0);
    if (galleries < MIN_GALLERIES) return null;

    const [profile] = (await db.query(
      `SELECT description FROM "social.grain.actor.profile" WHERE did = $1 LIMIT 1`,
      [subject.did],
    )) as { description: string | null }[];

    // A sample, plus the true total. The count is its own signal: nine thousand
    // templated gallery titles say more than any eight of them do.
    const sample = (await db.query(
      `SELECT title, description FROM "social.grain.gallery" WHERE did = $1 LIMIT 8`,
      [subject.did],
    )) as { title: string; description: string | null }[];

    return {
      handle: subject.handle,
      bio: profile?.description || null,
      counts: { galleries, photos, stories },
      gallerySample: sample.map((g) => ({ title: g.title, description: g.description || null })),
    };
  },
});
