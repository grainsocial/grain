// The pools the viewer is in, as one feed.
//   GET /xrpc/social.grain.unspecced.listPoolFeed
//
// Not a `defineFeed`: those are SQL over the index with a cursor, and there is
// no index here to page through. This is assembled per viewer, per request —
// which is also why it cannot be shared, cached or handed to anyone else.
//
// Two halves, both private. *Which* groups the viewer belongs to comes
// from their own PDS — the members spaces they have written an acceptance
// into — each confirmed with the group's host (see helpers/membership.ts).
// What is in each group's pool is a credentialed read per pool, and a pool
// that refuses is dropped rather than failing the feed: a group need not
// keep a pool at all.

import { defineQuery, InvalidRequestError } from "$hatk";
import type { GrainActorProfile } from "$hatk";
import { hydrateGroups } from "../hydrate/groups.ts";
import { lookupHandles } from "../helpers/lookupHandles.ts";
import { groupsOf } from "../helpers/membership.ts";
import { type PoolGallery, readPool } from "../helpers/pool.ts";
import { throwSpaceError } from "../spaces/errors.ts";

export default defineQuery("social.grain.unspecced.listPoolFeed", async (ctx) => {
  const { ok, db, viewer, pds, params } = ctx;
  if (!viewer) throw new InvalidRequestError("Authentication required");

  const limit = Math.min(Number(params.limit) || 30, 100);

  const groups = await groupsOf(db, pds, viewer.did);
  if (groups.length === 0) return ok({ galleries: [], groups: [] });

  // One pool at a time would be one round trip to two hosts per group; they do
  // not depend on each other, so they go together. `allSettled`, because a
  // refusal from one group's host is a pool to skip.
  const settled = await Promise.allSettled(groups.map((group) => readPool(pds, viewer.did, group)));
  // Every pool refusing is not "an empty feed" — it is the session or the
  // network, and it gets reported like any other failed space read.
  const reachable = settled.filter((r) => r.status === "fulfilled");
  if (reachable.length === 0 && settled.length > 0) {
    return throwSpaceError((settled[0] as PromiseRejectedResult).reason, db, viewer.did);
  }

  const galleries: PoolGallery[] = reachable
    .flatMap((r) => (r as PromiseFulfilledResult<PoolGallery[]>).value)
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .slice(0, limit);

  const dids = [...new Set(galleries.map((g) => g.did))];
  const shown = [...new Set(galleries.map((g) => g.group))];
  const [handles, profiles, groupViews] = await Promise.all([
    lookupHandles(db, dids),
    ctx.lookup<GrainActorProfile>("social.grain.actor.profile", "did", dids),
    hydrateGroups(ctx, shown, { mine: groups }),
  ]);

  return ok({
    galleries: galleries.map((g) => {
      const profile = profiles.get(g.did);
      const name = profile?.value.displayName;
      const avatar = profile?.value.avatar
        ? ctx.blobUrl(g.did, profile.value.avatar, "avatar")
        : undefined;
      return {
        space: g.space,
        group: g.group,
        did: g.did,
        rkey: g.rkey,
        title: g.title,
        ...(g.description ? { description: g.description } : {}),
        ...(g.createdAt ? { createdAt: g.createdAt } : {}),
        uri: g.uri,
        photoCount: g.photoCount,
        favCount: g.favCount,
        ...(g.viewerFav ? { viewerFav: g.viewerFav } : {}),
        commentCount: g.commentCount,
        items: g.photos,
        ...(handles.get(g.did) ? { handle: handles.get(g.did) } : {}),
        ...(avatar ? { avatar } : {}),
        ...(name ? { displayName: name } : {}),
      };
    }),
    // The pools these came out of, so each card can say whose it is.
    groups: groupViews,
  });
});
