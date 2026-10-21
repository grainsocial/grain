import { defineClassifier } from "$hatk";
import { BRIDGED_HIDDEN_COLLECTIONS, isBridgedAccount } from "../helpers/bridged.ts";

/**
 * Labels every post from a Bridgy Fed account `spam`, which hides it; see
 * `helpers/bridged.ts`. The handle or the profile's Bridgy footer is the whole
 * signal, so this asks no model.
 *
 * Unlike the other classifiers this acts rather than reports. It backs up the
 * label rule in `labels/spam.ts`, which never sees the records a backfill
 * writes, and a bridged account's first posts always arrive by backfill.
 *
 * A post that already carries a spam label row, positive or negated, is left
 * alone, so an admin who unhides one is not overruled on the next scan.
 */
export default defineClassifier({
  // No threshold, so nothing is reported: the labels are the action, and a
  // report per account would fill the queue with decisions already made.
  subject: "account",

  async buildState({ db, subject }) {
    if (!(await isBridgedAccount(db, subject.did, subject.handle ?? null))) return null;
    const handle = subject.handle?.toLowerCase() ?? null;

    // The unlabelled posts are the state, so each new post changes the
    // fingerprint and is scored again, and a fully labelled account is skipped.
    const unlabelled: string[] = [];
    for (const collection of BRIDGED_HIDDEN_COLLECTIONS) {
      const rows = (await db.query(
        `SELECT t.uri FROM "${collection}" t
         WHERE t.did = $1
           AND NOT EXISTS (SELECT 1 FROM _labels l WHERE l.uri = t.uri AND l.val = 'spam')`,
        [subject.did],
      )) as { uri: string }[];
      unlabelled.push(...rows.map((r) => r.uri));
    }
    if (!unlabelled.length) return null;

    return { handle, unlabelled };
  },

  async classify(state, { db }) {
    const now = new Date().toISOString();
    for (const uri of state.unlabelled as string[]) {
      await db.run(
        `INSERT INTO _labels (src, uri, val, neg, cts) VALUES ('self', $1, 'spam', false, $2)`,
        uri,
        now,
      );
    }
    return { bridged_account: 1 };
  },
});
