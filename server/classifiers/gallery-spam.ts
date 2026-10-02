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
        "Is this gallery advertising a product, service, investment, or download, rather than sharing photographs?",
      criteria: {
        true: "Sells or promotes something to the reader — a crypto platform, an ebook, a paid service, an affiliate link, a discount. Repeated near-identical listings from one poster count.",
        false:
          "Photographs shared as photographs. A photographer naming their own shop, print store, portfolio, or Ko-fi alongside their work is NOT a promotional listing — the photographs are still the point.",
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

  async buildState({ subject }) {
    const v = subject.value ?? {};
    const title = typeof v.title === "string" ? v.title.trim() : "";
    const description = typeof v.description === "string" ? v.description.trim() : "";

    // A gallery carrying almost no text has no question to answer. The cut is
    // deliberately low: a short title can still be spam — "MIS EBOOKS" is ten
    // characters.
    if (title.length + description.length < 8) return null;

    return { title: title || null, description: description || null };
  },
});
