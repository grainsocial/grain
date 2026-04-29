import { defineHook } from "$hatk";
import { shouldPush, isBlockedOrMuted } from "../helpers/notifPrefs.ts";
import { getUnseenCount } from "../helpers/unseenCount.ts";
import { extractMentionDids } from "../helpers/extractMentions.ts";

const MAX_MENTIONS_PER_RECORD = 5;

function snippet(text: string | undefined | null, max = 140): string {
  if (!text) return "";
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

export default defineHook("on-commit", { collections: ["social.grain.gallery"] },
  async ({ action, record, repo, uri, db, lookup, push }) => {
    if (action === "delete") {
      // Drop dedup rows so a future re-create of the same rkey can push fresh.
      await db.run(`DELETE FROM _mention_pushes WHERE record_uri = $1`, [uri])
      return
    }
    if (action !== "create" || !record) return

    const mentioned = extractMentionDids((record as any).facets).filter((d) => d !== repo)
    if (mentioned.length === 0) return
    if (mentioned.length > MAX_MENTIONS_PER_RECORD) return

    const profiles = await lookup("social.grain.actor.profile", "did", [repo])
    const actor = profiles.get(repo)
    const displayName = (actor?.value as any)?.displayName ?? "Someone"
    const title = `${displayName} mentioned you`
    const body = (record as any).title ?? snippet((record as any).description) ?? ""
    const now = new Date().toISOString()

    for (const did of mentioned) {
      // Atomically claim the dedup row. RETURNING is empty when the row
      // already existed (INSERT OR IGNORE'd), which both guards against a
      // gallery-edit re-push and races between two near-simultaneous fires
      // for the same URI (e.g. quick edit lands in the same indexer batch).
      const claimed = (await db.query(
        `INSERT OR IGNORE INTO _mention_pushes (record_uri, recipient_did, created_at)
           VALUES ($1, $2, $3) RETURNING recipient_did`,
        [uri, did, now],
      )) as unknown[]
      if (claimed.length === 0) continue
      if (await isBlockedOrMuted(db, did, repo)) continue
      if (!(await shouldPush(db, did, repo, "mentions"))) continue
      const badge = await getUnseenCount(db, did) + 1
      await push.send({
        did,
        title,
        body,
        data: { type: "gallery-mention", uri },
        badge,
      })
    }
  }
)
