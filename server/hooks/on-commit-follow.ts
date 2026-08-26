import { defineHook } from "$hatk";
import { shouldPush } from "../helpers/notifPrefs.ts";
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
