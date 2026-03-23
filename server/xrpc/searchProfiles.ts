import { defineQuery, type GrainActorProfile } from "$hatk";

export default defineQuery("social.grain.unspecced.searchProfiles", async (ctx) => {
  const { params, search, resolve, blobUrl, ok } = ctx;
  const { q, limit, cursor, fuzzy } = params;

  const result = await search("social.grain.actor.profile", q, { limit, cursor, fuzzy });
  const items = await resolve<GrainActorProfile>(result.records.map((r) => r.uri));

  const profiles = items.map((item) => ({
    did: item.did,
    handle: item.handle,
    displayName: item.value.displayName,
    description: item.value.description,
    avatar: blobUrl(item.did, item.value.avatar, "avatar"),
  }));

  return ok({ items: profiles, cursor: result.cursor });
});
