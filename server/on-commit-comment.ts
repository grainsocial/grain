import { defineHook } from "$hatk";

export default defineHook("on-commit", { collections: ["social.grain.comment"] },
  async ({ action, record, repo, db, lookup, push }) => {
    if (action !== "create" || !record) return
    const subject = record.subject as string
    if (!subject) return

    // Find the gallery author (comment.subject is the gallery URI)
    const [gallery] = await db.query(
      `SELECT did AS author FROM "social.grain.gallery" WHERE uri = $1`,
      [subject],
    ) as { author: string }[]

    if (!gallery) return

    // Look up commenter's profile
    const profiles = await lookup("social.grain.actor.profile", "did", [repo])
    const actor = profiles.get(repo)
    const displayName = (actor?.value as any)?.displayName ?? "Someone"

    // If this is a reply, notify the parent comment author instead
    if (record.replyTo) {
      const [parent] = await db.query(
        `SELECT did AS author FROM "social.grain.comment" WHERE uri = $1`,
        [record.replyTo],
      ) as { author: string }[]

      if (parent && parent.author !== repo) {
        await push.send({
          did: parent.author,
          title: "New reply",
          body: `${displayName} replied to your comment`,
          data: { type: "comment-reply", uri: subject },
        })
      }
    }

    // Notify the gallery author (unless they're the commenter)
    if (gallery.author !== repo) {
      await push.send({
        did: gallery.author,
        title: "New comment",
        body: `${displayName} commented on your gallery`,
        data: { type: "gallery-comment", uri: subject },
      })
    }
  }
)
