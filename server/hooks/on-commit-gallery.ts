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

    // Filter to DIDs we haven't already pushed for this gallery URI.
    // Indexer fires action='create' on every edit too, so this prevents
    // re-notifying pre-existing mentions when the description is edited.
    const existing = (await db.query(
      `SELECT recipient_did FROM _mention_pushes WHERE record_uri = $1`,
      [uri],
    )) as { recipient_did: string }[]
    const alreadyPushed = new Set(existing.map((r) => r.recipient_did))
    const targets = mentioned.filter((d) => !alreadyPushed.has(d))
    if (targets.length === 0) return

    const profiles = await lookup("social.grain.actor.profile", "did", [repo])
    const actor = profiles.get(repo)
    const displayName = (actor?.value as any)?.displayName ?? "Someone"
    const title = `${displayName} mentioned you`
    const body = (record as any).title ?? snippet((record as any).description) ?? ""
    const now = new Date().toISOString()

    for (const did of targets) {
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
      await db.run(
        `INSERT OR IGNORE INTO _mention_pushes (record_uri, recipient_did, created_at) VALUES ($1, $2, $3)`,
        [uri, did, now],
      )
    }
  }
)
