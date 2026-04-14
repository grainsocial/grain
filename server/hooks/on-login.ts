import { defineHook, type GrainActorProfile } from "$hatk";

export default defineHook("on-login", async (ctx) => {
  const { did, ensureRepo, lookup, db } = ctx;

  // Backfill repo in the background — large repos can block the login redirect
  ensureRepo(did).catch((err) =>
    console.error(`[on-login] ensureRepo failed for ${did}:`, err)
  );

  // Check if user already has a populated grain profile
  const grainProfiles = await lookup<GrainActorProfile>("social.grain.actor.profile", "did", [did]);
  const grainProfile = grainProfiles.get(did);
  if (grainProfile?.value.displayName) return;

  // Fetch bsky profile directly from the user's PDS (fast, no backfill needed)
  const rows = await db.query(
    "SELECT pds_endpoint FROM _oauth_sessions WHERE did = $1",
    [did]
  ) as { pds_endpoint: string }[];
  const pdsEndpoint = rows[0]?.pds_endpoint;
  if (!pdsEndpoint) return;

  const url = `${pdsEndpoint}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(did)}&collection=app.bsky.actor.profile&rkey=self`;
  const res = await fetch(url);
  if (!res.ok) return;
  const { value: bsky } = (await res.json()) as { value: Record<string, unknown> };
  if (!bsky) return;

  const record: Record<string, unknown> = {
    createdAt: grainProfile?.value.createdAt ?? new Date().toISOString(),
  };
  if (bsky.displayName) record.displayName = bsky.displayName;
  if (bsky.description) record.description = bsky.description;
  if (bsky.avatar) record.avatar = bsky.avatar;

  if (grainProfile) {
    await ctx.putRecord("social.grain.actor.profile", "self", record);
  } else {
    await ctx.createRecord("social.grain.actor.profile", record, { rkey: "self" });
  }
});
