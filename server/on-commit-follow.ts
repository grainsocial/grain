import { defineHook } from "$hatk";

export default defineHook("on-commit", { collections: ["social.grain.graph.follow"] },
  async ({ action, record, repo, lookup, push }) => {
    if (action !== "create" || !record) return

    const subject = record.subject as string
    if (!subject || subject === repo) return

    const profiles = await lookup("social.grain.actor.profile", "did", [repo])
    const actor = profiles.get(repo)

    await push.send({
      did: subject,
      title: "New follower",
      body: `${(actor?.value as any)?.displayName ?? "Someone"} followed you`,
      data: { type: "follow", did: repo },
    })
  }
)
