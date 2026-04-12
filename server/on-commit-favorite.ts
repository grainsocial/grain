import { defineHook } from "$hatk";
import { shouldPush } from "./helpers/notifPrefs.ts";

export default defineHook("on-commit", { collections: ["social.grain.favorite"] },
  async ({ action, record, repo, db, lookup, push }) => {
    if (action !== "create" || !record) return
    const subject = record.subject as string
    if (!subject) return

    // Check if the subject is a gallery
    const [gallery] = await db.query(
      `SELECT did AS author FROM "social.grain.gallery" WHERE uri = $1`,
      [subject],
    ) as { author: string }[]

    if (gallery && gallery.author !== repo) {
      if (!(await shouldPush(db, gallery.author, repo, "favorites"))) return
      const profiles = await lookup("social.grain.actor.profile", "did", [repo])
      const actor = profiles.get(repo)
      await push.send({
        did: gallery.author,
        title: "New favorite",
        body: `${(actor?.value as any)?.displayName ?? "Someone"} favorited your gallery`,
        data: { type: "gallery-favorite", uri: subject },
      })
      return
    }

    // Check if the subject is a story
    const [story] = await db.query(
      `SELECT did AS author FROM "social.grain.story" WHERE uri = $1`,
      [subject],
    ) as { author: string }[]

    if (story && story.author !== repo) {
      if (!(await shouldPush(db, story.author, repo, "favorites"))) return
      const profiles = await lookup("social.grain.actor.profile", "did", [repo])
      const actor = profiles.get(repo)
      await push.send({
        did: story.author,
        title: "New favorite",
        body: `${(actor?.value as any)?.displayName ?? "Someone"} favorited your story`,
        data: { type: "story-favorite", uri: subject },
      })
    }
  }
)
