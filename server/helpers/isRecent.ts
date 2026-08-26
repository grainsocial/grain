/**
 * Whether a record is new enough to be worth a push notification.
 *
 * on-commit hooks fire for every indexed `create`, and hatk's full backfill
 * deletes a repo's records and re-inserts them — so re-importing one account
 * replays `create` for its entire history. Backfill is not rare: it runs on
 * login, and any repo the appview has not fully imported gets one.
 *
 * The hook context carries no flag distinguishing backfill from live firehose
 * traffic (`action`, `collection`, `record`, `repo`, `uri`, and that is all),
 * so the record's own timestamp is the only thing that can tell them apart.
 * A favorite created in June is not news whichever path delivered it.
 *
 * This was not theoretical: migrating the appview to a new host meant every
 * repo needed a full import, and users received notifications for months-old
 * favorites and follows — one account got twelve in a few minutes.
 *
 * Fails closed. A record with no parseable `createdAt` does not notify, on the
 * grounds that a missed notification is a smaller harm than replaying someone's
 * entire history to their followers. If a lexicon ever drops `createdAt`, push
 * for that collection goes quiet rather than going haywire — quiet is the
 * failure worth choosing, but it is a silent one, so check here first if
 * notifications stop.
 */
export function isRecent(
  record: Record<string, unknown> | null,
  maxAgeMs: number = 60 * 60 * 1000,
): boolean {
  const createdAt = record?.createdAt;
  if (typeof createdAt !== "string") return false;

  const created = Date.parse(createdAt);
  if (Number.isNaN(created)) return false;

  // Future-dated records are clock skew or a bad client, not a reason to skip.
  return Date.now() - created < maxAgeMs;
}
