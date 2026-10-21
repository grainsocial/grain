import { defineLabel } from "$hatk";
import { BRIDGED_HIDDEN_COLLECTIONS, isBridgedHandle } from "../helpers/bridged.ts";

export default defineLabel({
  definition: {
    identifier: "spam",
    severity: "inform",
    blurs: "content",
    defaultSetting: "hide",
    locales: [
      { lang: "en", name: "Spam", description: "Unwanted or repetitive promotional content." },
    ],
  },

  // Hides a bridged account's post the moment it is indexed, rather than when
  // the `bridged` classifier reaches the account a minute later. Rules only
  // run on live writes, which come from accounts already in `_repos`, so the
  // handle is there to check.
  //
  // A post that already carries a spam label row, positive or negated, is left
  // alone: an edit re-runs the rule, and must not overrule an admin's unhide.
  async evaluate({ db, record }) {
    if (!BRIDGED_HIDDEN_COLLECTIONS.includes(record.collection)) return [];
    const [repo] = (await db.query(`SELECT handle FROM _repos WHERE did = $1`, [record.did])) as {
      handle: string | null;
    }[];
    if (!isBridgedHandle(repo?.handle)) return [];
    const labelled = await db.query(
      `SELECT 1 FROM _labels WHERE uri = $1 AND val = 'spam' LIMIT 1`,
      [record.uri],
    );
    return labelled.length ? [] : ["spam"];
  },
});
