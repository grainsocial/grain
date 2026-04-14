import { defineHook } from "$hatk";
import { shouldPush } from "../helpers/notifPrefs.ts";
import { getUnseenCount } from "../helpers/unseenCount.ts";

export default defineHook("on-commit", { collections: ["social.grain.comment"] },
  async ({ action, record, repo, db, lookup, push }) => {
    if (action !== "create" || !record) return
    const subject = record.subject as string
    if (!subject) return

    // Look up commenter's profile
    const profiles = await lookup("social.grain.actor.profile", "did", [repo])
    const actor = profiles.get(repo)
    const displayName = (actor?.value as any)?.displayName ?? "Someone"

    // If this is a reply, notify the parent comment author
    if (record.replyTo) {
      const [parent] = await db.query(
        `SELECT did AS author FROM "social.grain.comment" WHERE uri = $1`,
        [record.replyTo],
      ) as { author: string }[]

      if (parent && parent.author !== repo) {
        if (await shouldPush(db, parent.author, repo, "comments")) {
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
  }
)
