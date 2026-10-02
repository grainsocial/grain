import { defineClassifier } from "$hatk";

/**
 * Nudity and sexual content, judged by Clef from the photo itself.
 *
 * The criteria follow how grain's moderators have actually labelled, which is
 * broader than "is anything explicit visible": a nude whose pose or hand covers
 * them was labelled, and so was a boudoir shot showing bare buttocks. A sketch
 * of nude figures was dismissed, so artwork is excluded. Glamour and fashion
 * work that keeps everyone dressed stays out of the queue — that is where a
 * poster's self-label belongs, not a report.
 *
 * `sexual` is its own question because nudity does not cover it: a captioned
 * porn meme can show no nudity at all.
 *
 * Measured on prod: every admin decision matched, and nothing in 446 random
 * photos reached 0.5 on either question. That rests on a handful of real
 * positives, so treat the thresholds as a starting point. Nothing here detects
 * gore; prod has no real example of it to tune against.
 */
export default defineClassifier({
  subject: "record",
  collections: ["social.grain.photo"],
  label: (signal) => signal,
  threshold: { nudity: 0.5, sexual: 0.5 },
  questions: {
    nudity: {
      type: "noul",
      instructions: "Is a real person in this photograph nude or nearly nude?",
      criteria: {
        true: "A person is unclothed or close to it: genitals, female nipples or bare buttocks are visible, OR the person is naked with only a hand, an object, the pose or the crop hiding them, OR sheer clothing shows the body beneath. Artistic, documentary and boudoir photographs all count.",
        false:
          "Everyone is dressed, including in swimwear, sportswear, lingerie that fully covers, or costume. A shirtless man at the beach, in sport or at work is false. Drawings, paintings, sketches and sculptures are false: the question is about photographs of real people.",
      },
    },
    sexual: {
      type: "noul",
      instructions: "Does this image depict sexual activity or explicitly sexual posing?",
    },
  },

  async buildState({ subject }) {
    const v = subject.value ?? {};
    const cid = (v.photo as any)?.ref?.$link ?? (v.photo as any)?.ref;
    if (typeof cid !== "string") return null;
    // The CID is what makes a changed photo score again.
    return { did: subject.did, cid };
  },

  // hatk scales this to 512px before sending it, which is what keeps a large
  // thumbnail inside Clef's context window.
  images: (state) => [
    `https://cdn.bsky.app/img/feed_thumbnail/plain/${state.did}/${state.cid}@jpeg`,
  ],
});
