import { defineClassifier } from "$hatk";

/**
 * Spam judged per gallery rather than per account.
 *
 * Grain's moderation reports are filed against records rather than accounts,
 * and are resolved by labelling the gallery rather than removing its poster.
 * This scores the thing the label lands on.
 *
 * The distinction the questions turn on is that grain is a photo-sharing
 * service. Real galleries caption photographs; the spam ones are articles,
 * product listings, or bare links that happen to carry an image. "Nepal
 * Mudslides — Nepal after mudslides destruction" is a caption. "How AI Agent
 * Era Redraws SSD & Storage Value" followed by four paragraphs is not.
 */
export default defineClassifier({
  subject: "record",
  collections: ["social.grain.gallery"],
  label: "spam",
  threshold: 0.6,
  questions: {
    promotional_listing: {
      type: "noul",
      instructions:
        "Is this gallery the poster advertising something they profit from, rather than sharing photographs? Every gallery on grain carries photographs; judge what the text is for.",
      criteria: {
        true: "Sells or promotes something to the reader on the poster's behalf — a crypto platform, an ebook, a paid service, an affiliate link, a discount, a company's marketing. Use the poster's other galleries: many near-identical listings make it one.",
        false:
          "Photographs shared as photographs, whatever they show. Mentioning, joking about, photographing or reviewing a product, an ad, a shop or an event is NOT a promotional listing, and neither is sharing a link to an article, a talk or one's own blog, or selling a single personal item. A photographer naming their own shop, print store, portfolio, or Ko-fi alongside their work is NOT a promotional listing — the photographs are still the point. A poster whose other galleries are varied, personal posts is sharing, not listing.",
      },
    },
    article_not_caption: {
      type: "noul",
      instructions:
        "Is the gallery's text an article or blog post that happens to carry an image, rather than a caption describing the photographs?",
      criteria: {
        true: "Reads as written-for-search prose with an explanatory headline and body paragraphs — the kind of content-farm article that exists to rank, not to accompany a picture.",
        false:
          "A caption, a title, a place name, a date, a note about the shot or the trip, or nothing at all. Length alone does not make a caption an article: a long, personal story about the photographs is still a caption.",
      },
    },
  },

  async buildState({ db, subject }) {
    const v = subject.value ?? {};
    const title = typeof v.title === "string" ? v.title.trim() : "";
    const description = typeof v.description === "string" ? v.description.trim() : "";

    // A gallery carrying almost no text has no question to answer. The cut is
    // deliberately low: a short title can still be spam — "MIS EBOOKS" is ten
    // characters.
    if (title.length + description.length < 8) return null;

    // The poster's other galleries. One gallery alone cannot show the pattern
    // that separates a listing from a post: "MIS EBOOKS" fifteen times over is
    // spam, while a product joke in a varied personal archive is not.
    const [{ count }] = (await db.query(
      `SELECT COUNT(*) AS count FROM "social.grain.gallery" WHERE did = $1`,
      [subject.did],
    )) as { count: number }[];
    const others = (await db.query(
      `SELECT title, description FROM "social.grain.gallery"
       WHERE did = $1 AND uri <> $2 ORDER BY created_at DESC LIMIT 6`,
      [subject.did, subject.uri],
    )) as { title: string | null; description: string | null }[];

    return {
      title: title || null,
      description: description || null,
      poster: {
        galleries: Number(count),
        otherGalleries: others.map((g) =>
          [g.title, g.description].filter(Boolean).join(" — ").slice(0, 120),
        ),
      },
    };
  },
});
