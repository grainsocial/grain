import { defineHook } from "$hatk";
import { shouldPush } from "../helpers/notifPrefs.ts";
import { isBlockedOrMuted } from "../helpers/isModerated.ts";
import { isRecent } from "../helpers/isRecent.ts";
import { getUnseenCount } from "../helpers/unseenCount.ts";

export default defineHook(
  "on-commit",
  { collections: ["social.grain.graph.follow"] },
  async ({ action, record, repo, db, lookup, push }) => {
    if (action !== "create" || !record) return;

    // Backfill re-creates a repo's whole history; only notify on fresh records.
    if (!isRecent(record)) return;

    const subject = record.subject as string;
    if (!subject || subject === repo) return;

    // A taken-down account should not announce itself as a new follower.
    const [repos] = (await db.query(
      `SELECT 1 FROM _repos WHERE did = $1 AND status = 'takendown' LIMIT 1`,
      [repo],
    )) as unknown[];
    if (repos) return;

    // A blocked or muted account should not announce itself either.
    if (await isBlockedOrMuted(db, subject, repo)) return;

    if (!(await shouldPush(db, subject, repo, "follows"))) return;

    const profiles = await lookup("social.grain.actor.profile", "did", [repo]);
    const actor = profiles.get(repo);

    const badge = (await getUnseenCount(db, subject)) + 1;
    await push.send({
      did: subject,
      title: "New follower",
      body: `${(actor?.value as any)?.displayName ?? "Someone"} followed you`,
      data: { type: "follow", did: repo },
      badge,
    });
  },
);
