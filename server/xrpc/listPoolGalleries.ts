// Every gallery in a community's pool.
//   GET /xrpc/social.grain.unspecced.listPoolGalleries?group=did:...
//
// Nothing here comes from the index, because nothing in a space ever reaches a
// firehose to be indexed from. The read is `readPool`: the space names the
// repos that have written into it, each is read on the host that holds it, and
// all of it needs a credential the community's host issues to a member — so a
// viewer who is not one gets a 401 and no gallery at all, which is the whole
// feature.
//
// `cid` rides along per cover so the client can ask getPrivateBlob for the
// bytes; they cannot come from the CDN.

import { defineQuery, InvalidRequestError } from "$hatk";
import type { GrainActorProfile } from "$hatk";
import { lookupHandles } from "../helpers/lookupHandles.ts";
import { readPool } from "../helpers/pool.ts";
import { poolUri } from "../spaces/client.ts";
import { throwSpaceError } from "../spaces/errors.ts";

export default defineQuery("social.grain.unspecced.listPoolGalleries", async (ctx) => {
  const { ok, db, viewer, pds, params } = ctx;
  if (!viewer) throw new InvalidRequestError("Authentication required");

  const group = params.group as string;
  const limit = Math.min(Number(params.limit) || 50, 100);

  try {
    const galleries = (await readPool(pds, viewer.did, group)).slice(0, limit);

    // Whose gallery it is, in the words grain uses everywhere else. A DID
    // grain has never indexed keeps its row — the gallery is still readable,
    // and in a private pool an unindexed author is an ordinary case.
    const dids = [...new Set(galleries.map((g) => g.did))];
    const [handles, profiles] = await Promise.all([
      lookupHandles(db, dids),
      ctx.lookup<GrainActorProfile>("social.grain.actor.profile", "did", dids),
    ]);

    return ok({
      space: poolUri(group),
      galleries: galleries.map((g) => {
        const name = profiles.get(g.did)?.value.displayName;
        const cover = g.photos[0];
        return {
          space: g.space,
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
          ...(cover ? { cover } : {}),
          ...(handles.get(g.did) ? { handle: handles.get(g.did) } : {}),
          ...(name ? { displayName: name } : {}),
        };
      }),
    });
  } catch (err) {
    return throwSpaceError(err, db, viewer.did);
  }
});
