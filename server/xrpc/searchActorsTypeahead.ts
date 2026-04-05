import { defineQuery, type GrainActorProfile } from "$hatk";

export default defineQuery(
  "social.grain.unspecced.searchActorsTypeahead",
  async (ctx) => {
    const { params, search, resolve, blobUrl, ok } = ctx;
    const { q, limit } = params;

    // Fetch from bsky and grain in parallel
    const [bskyResult, grainResult] = await Promise.all([
      fetch(
        `https://public.api.bsky.app/xrpc/app.bsky.actor.searchActorsTypeahead?q=${encodeURIComponent(q)}&limit=${limit}`
      )
        .then((r) => (r.ok ? r.json() : { actors: [] }))
        .catch(() => ({ actors: [] })),
      search("social.grain.actor.profile", q, { limit }).catch(() => ({
        records: [],
      })),
    ]);

    // Build grain profiles map keyed by DID
    const grainItems = await resolve<GrainActorProfile>(
      grainResult.records.map((r: any) => r.uri)
    );
    const seen = new Set<string>();
    const actors: {
      did: string;
      handle?: string;
      displayName?: string;
      avatar?: string;
    }[] = [];

    // Grain profiles first (prioritize grain users)
    for (const item of grainItems) {
      if (seen.has(item.did)) continue;
      seen.add(item.did);
      actors.push({
        did: item.did,
        handle: item.handle,
        displayName: item.value.displayName,
        avatar: blobUrl(item.did, item.value.avatar, "avatar"),
      });
    }

    // Merge bsky results, skip duplicates
    for (const actor of bskyResult.actors ?? []) {
      if (seen.has(actor.did)) continue;
      seen.add(actor.did);
      actors.push({
        did: actor.did,
        handle: actor.handle,
        displayName: actor.displayName,
        avatar: actor.avatar,
      });
    }

    return ok({ actors: actors.slice(0, limit) });
  }
);
