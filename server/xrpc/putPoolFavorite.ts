// Favourite, or unfavourite, a gallery in a community's pool.
//   POST /xrpc/social.grain.unspecced.putPoolFavorite
//
// The record is the viewer's own, and it goes into the pool rather than their
// public repo. In the public repo a favourite is a public statement that names
// its subject — which for a pooled gallery would publish the gallery's author,
// its rkey and the fact somebody can see it, to a network that is not supposed
// to know it exists.
//
// Unfavouriting finds the record by reading the viewer's own favourites in the
// space, so the client does not have to hold an rkey between page loads: it is
// their own repo, read through their own session, and one list call is cheaper
// than a stale identifier.

import { defineProcedure, InvalidRequestError } from "$hatk";
import { tid } from "../helpers/tid.ts";
import { listSpaceRecords, poolUri } from "../spaces/client.ts";
import { throwSpaceError } from "../spaces/errors.ts";

const COLLECTION = "social.grain.favorite";

export default defineProcedure("social.grain.unspecced.putPoolFavorite", async (ctx) => {
  const { ok, db, viewer, pds, input } = ctx;
  if (!viewer) throw new InvalidRequestError("Authentication required");

  const { group, gallery, on } = input;
  const space = poolUri(group);

  try {
    const mine = await listSpaceRecords(pds, viewer.did, space, viewer.did, COLLECTION);
    const existing = mine.find((r) => (r.value as { subject?: string }).subject === gallery);

    if (!on) {
      if (existing) {
        await pds("com.atproto.space.deleteRecord", {
          method: "POST",
          body: { space, repo: viewer.did, collection: COLLECTION, rkey: existing.rkey },
        });
      }
      return ok({ on: false });
    }

    // Already there: the toggle is idempotent rather than a second record.
    if (existing) return ok({ on: true, rkey: existing.rkey });

    const rkey = tid();
    await pds("com.atproto.space.putRecord", {
      method: "POST",
      body: {
        space,
        repo: viewer.did,
        collection: COLLECTION,
        rkey,
        validate: false,
        record: {
          $type: COLLECTION,
          subject: gallery,
          createdAt: new Date().toISOString(),
        },
      },
    });
    return ok({ on: true, rkey });
  } catch (err) {
    return throwSpaceError(err, db, viewer.did);
  }
});
