import { defineHook, type GrainActorProfile, type BskyActorProfile } from "$hatk";

export default defineHook("on-login", async (ctx) => {
  const { did, ensureRepo, lookup } = ctx;

  // Backfill the user's repo and wait for completion
  await ensureRepo(did);

  // Check if user already has a grain profile
  const grainProfiles = await lookup<GrainActorProfile>("social.grain.actor.profile", "did", [did]);
  if (grainProfiles.has(did)) return;

  // No grain profile — copy from bsky profile if available
  const bskyProfiles = await lookup<BskyActorProfile>("app.bsky.actor.profile", "did", [did]);
  const bsky = bskyProfiles.get(did);
  if (!bsky) return;

  const record: Record<string, unknown> = {
    createdAt: new Date().toISOString(),
  };
  if (bsky.value.displayName) record.displayName = bsky.value.displayName;
  if (bsky.value.description) record.description = bsky.value.description;
  if (bsky.value.avatar) record.avatar = bsky.value.avatar;

  await ctx.createRecord("social.grain.actor.profile", record, { rkey: "self" });
});
