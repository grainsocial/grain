// One gallery from a community's pool.
//   GET /xrpc/social.grain.unspecced.getPoolGallery?group=&did=&rkey=
//
// The same read as getPrivateGallery, pointed at a space the community owns:
// the author wrote the gallery, other members wrote the favourites and the
// comments on it, and the viewer's credential is what proves they are one of
// those people. All of it comes back together because all of it is in the same
// space — there is no index to ask separately.
//
// Photos come back as CIDs for getPrivateBlob; a space's blob has no public
// URL, which is the point of putting it there.

import { defineQuery, InvalidRequestError } from "$hatk";
import type { GrainActorProfile } from "$hatk";
import { lookupHandles } from "../helpers/lookupHandles.ts";
import { readPool } from "../helpers/pool.ts";
import { poolUri } from "../spaces/client.ts";
import { throwSpaceError } from "../spaces/errors.ts";

export default defineQuery("social.grain.unspecced.getPoolGallery", async (ctx) => {
  const { ok, db, viewer, pds, params } = ctx;
  if (!viewer) throw new InvalidRequestError("Authentication required");

  const group = params.group as string;
  const did = params.did as string;
  const rkey = params.rkey as string;

  try {
    const found = (await readPool(pds, viewer.did, group)).find(
      (g) => g.did === did && g.rkey === rkey,
    );

    // Everyone the answer names — the author and whoever has said something.
    // A DID grain has never indexed keeps its row: in a private pool an
    // unindexed account is an ordinary case, and its handle is not the point.
    const dids = [...new Set([did, ...(found?.comments ?? []).map((c) => c.did)])];
    const [handles, profiles] = await Promise.all([
      lookupHandles(db, dids),
      ctx.lookup<GrainActorProfile>("social.grain.actor.profile", "did", dids),
    ]);
    const who = (actor: string) => ({
      did: actor,
      ...(handles.get(actor) ? { handle: handles.get(actor) } : {}),
      ...(profiles.get(actor)?.value.displayName
        ? { displayName: profiles.get(actor)!.value.displayName }
        : {}),
      ...(profiles.get(actor)?.value.avatar
        ? { avatar: ctx.blobUrl(actor, profiles.get(actor)!.value.avatar, "avatar") }
        : {}),
    });

    return ok({
      space: poolUri(group),
      did,
      ...who(did),
      viewerIsAuthor: viewer.did === did,
      ...(found
        ? {
            gallery: {
              uri: found.uri,
              title: found.title,
              ...(found.description ? { description: found.description } : {}),
              ...(found.createdAt ? { createdAt: found.createdAt } : {}),
            },
            favCount: found.favCount,
            ...(found.viewerFav ? { viewerFav: found.viewerFav } : {}),
            commentCount: found.commentCount,
            comments: found.comments.map((c) => ({
              uri: c.uri,
              rkey: c.rkey,
              text: c.text,
              ...(c.facets ? { facets: c.facets } : {}),
              ...(c.replyTo ? { replyTo: c.replyTo } : {}),
              ...(c.createdAt ? { createdAt: c.createdAt } : {}),
              author: who(c.did),
            })),
          }
        : { favCount: 0, commentCount: 0, comments: [] }),
      items: (found?.photos ?? []).map((p) => ({
        uri: p.uri,
        did: p.did,
        cid: p.cid,
        ...(p.alt ? { alt: p.alt } : {}),
        ...(p.aspectRatio ? { aspectRatio: p.aspectRatio } : {}),
        position: p.position,
      })),
    });
  } catch (err) {
    return throwSpaceError(err, db, viewer.did);
  }
});
