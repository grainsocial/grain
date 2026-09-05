/** Label values that cause content to be filtered from feeds (imperative + defaultSetting:"hide"). */
export const HIDE_LABELS = new Set([
  "!hide",
  "!takedown",
  "spam",
  "copyright",
  "gore",
  "nsfl",
  "dmca-violation",
  "doxxing",
]);

/** SQL fragment: NOT EXISTS subquery filtering rows with hide-severity labels.
 *  A label is only active if its latest row (by cts) has neg = 0.
 *  `uriExpr` is the column to match against (e.g. "t.uri"). */
export function hideLabelsFilter(uriExpr: string): string {
  const inList = [...HIDE_LABELS].map((v) => `'${v}'`).join(",");
  return `NOT EXISTS (
    SELECT 1 FROM _labels l
    WHERE l.uri = ${uriExpr} AND l.val IN (${inList})
      AND l.neg = 0
      AND NOT EXISTS (
        SELECT 1 FROM _labels l2
        WHERE l2.uri = l.uri AND l2.val = l.val AND l2.neg = 1 AND l2.cts > l.cts
      )
  )`;
}

/** SQL fragment: NOT EXISTS subquery filtering rows the author self-labelled
 *  with a hide-severity value. `selfLabelTable` is the record's self-label
 *  child table, e.g. "social.grain.story__labels_self_labels". The story
 *  hydrator drops these before serving, so a count that includes them is a
 *  count of stories nobody will ever be shown. */
export function hideSelfLabelsFilter(selfLabelTable: string, uriExpr: string): string {
  const inList = [...HIDE_LABELS].map((v) => `'${v}'`).join(",");
  return `NOT EXISTS (
    SELECT 1 FROM "${selfLabelTable}" sl
    WHERE sl.parent_uri = ${uriExpr} AND sl.val IN (${inList})
  )`;
}
