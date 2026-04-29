import { defineHook } from "$hatk";
import { shouldPush, isBlockedOrMuted } from "../helpers/notifPrefs.ts";
import { getUnseenCount } from "../helpers/unseenCount.ts";
import { extractMentionDids } from "../helpers/extractMentions.ts";

const MAX_MENTIONS_PER_RECORD = 5;

function snippet(text: string | undefined | null, max = 140): string {
  if (!text) return "";
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

export default defineHook("on-commit", { collections: ["social.grain.comment"] },
  async ({ action, record, repo, db, lookup, push, uri }) => {
    if (action === "delete") {
      // Drop dedup rows so a future re-create can fire fresh pushes.
      await db.run(`DELETE FROM _mention_pushes WHERE record_uri = $1`, [uri])
      return
    }
    if (action !== "create" || !record) return
    const subject = record.subject as string
    if (!subject) return

    // Look up commenter's profile
    const profiles = await lookup("social.grain.actor.profile", "did", [repo])
    const actor = profiles.get(repo)
    const displayName = (actor?.value as any)?.displayName ?? "Someone"

    // Track who received a higher-priority push for this commit so the mention
    // fan-out below skips them. Only add to this set when a push *actually*
    // fired — otherwise a recipient with comments-off + mentions-on would be
    // silenced for both.
    const supersededRecipients = new Set<string>([repo])

    // If this is a reply, notify the parent comment author
    if (record.replyTo) {
      const [parent] = await db.query(
        `SELECT did AS author FROM "social.grain.comment" WHERE uri = $1`,
        [record.replyTo],
      ) as { author: string }[]

      if (parent && parent.author !== repo) {
        if (await shouldPush(db, parent.author, repo, "comments")) {
          supersededRecipients.add(parent.author)
          const badge = await getUnseenCount(db, parent.author) + 1
          await push.send({
            did: parent.author,
            title: "New reply",
            body: `${displayName} replied to your comment`,
            data: { type: "comment-reply", uri: subject },
            badge,
          })
        }
      }
    }

    // Check if the subject is a gallery
    const [gallery] = await db.query(
      `SELECT did AS author FROM "social.grain.gallery" WHERE uri = $1`,
      [subject],
    ) as { author: string }[]

    if (gallery) {
      if (gallery.author !== repo) {
        if (await shouldPush(db, gallery.author, repo, "comments")) {
          supersededRecipients.add(gallery.author)
          const badge = await getUnseenCount(db, gallery.author) + 1
          await push.send({
            did: gallery.author,
            title: "New comment",
            body: `${displayName} commented on your gallery`,
            data: { type: "gallery-comment", uri: subject },
            badge,
          })
        }
      }

      await fanOutMentions({
        facets: (record as any).facets,
        supersededRecipients,
        actorDid: repo,
        displayName,
        commentText: (record as any).text,
        galleryUri: subject,
        commentUri: uri,
        db,
        push,
      })
      return
    }

    // Check if the subject is a story
    const [story] = await db.query(
      `SELECT did AS author FROM "social.grain.story" WHERE uri = $1`,
      [subject],
    ) as { author: string }[]

    if (story && story.author !== repo) {
      if (await shouldPush(db, story.author, repo, "comments")) {
        const badge = await getUnseenCount(db, story.author) + 1
        await push.send({
          did: story.author,
          title: "New comment",
          body: `${displayName} commented on your story`,
          data: { type: "story-comment", uri: subject },
          badge,
        })
      }
    }
    // Mentions inside story comments are intentionally not pushed — the iOS client
    // currently only handles gallery-scoped mention payloads.
  }
)

async function fanOutMentions(args: {
  facets: unknown
  supersededRecipients: Set<string>
  actorDid: string
  displayName: string
  commentText: string | undefined
  galleryUri: string
  commentUri: string
  db: {
    query: (sql: string, params?: unknown[]) => Promise<unknown[]>
    run: (sql: string, params?: unknown[]) => Promise<void>
  }
  push: { send: (payload: any) => Promise<unknown> }
}) {
  const { facets, supersededRecipients, actorDid, displayName, commentText, galleryUri, commentUri, db, push } = args
  const mentioned = extractMentionDids(facets).filter((d) => !supersededRecipients.has(d))
  if (mentioned.length === 0) return
  if (mentioned.length > MAX_MENTIONS_PER_RECORD) return

  const body = snippet(commentText) || `${displayName} mentioned you in a comment`
  const now = new Date().toISOString()

  for (const did of mentioned) {
    // Atomically claim the dedup row. RETURNING is empty when the row already
    // existed (INSERT OR IGNORE'd), which both guards against a comment-edit
    // re-push and races between two near-simultaneous fires for the same URI.
    const claimed = (await db.query(
      `INSERT OR IGNORE INTO _mention_pushes (record_uri, recipient_did, created_at)
         VALUES ($1, $2, $3) RETURNING recipient_did`,
      [commentUri, did, now],
    )) as unknown[]
    if (claimed.length === 0) continue
    if (await isBlockedOrMuted(db, did, actorDid)) continue
    if (!(await shouldPush(db, did, actorDid, "mentions"))) continue
    const badge = await getUnseenCount(db, did) + 1
    await push.send({
      did,
      title: `${displayName} mentioned you in a comment`,
      body,
      data: { type: "gallery-comment-mention", uri: galleryUri, commentUri },
      badge,
    })
  }
}
