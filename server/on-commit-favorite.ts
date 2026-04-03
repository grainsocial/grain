import { defineHook } from "$hatk";

export default defineHook("on-commit", { collections: ["social.grain.favorite"] },
  async ({ action, record, repo, db, lookup, push }) => {
    if (action !== "create" || !record) return
    const subject = record.subject as string
    if (!subject) return

    const [gallery] = await db.query(
      `SELECT did AS author FROM "social.grain.gallery" WHERE uri = $1`,
      [subject],
    ) as { author: string }[]

    if (!gallery || gallery.author === repo) return

    const profiles = await lookup("social.grain.actor.profile", "did", [repo])
    const actor = profiles.get(repo)

    await push.send({
      did: gallery.author,
      title: "New favorite",
      body: `${(actor?.value as any)?.displayName ?? "Someone"} favorited your gallery`,
      data: { type: "gallery-favorite", uri: subject },
    })
  }
)
