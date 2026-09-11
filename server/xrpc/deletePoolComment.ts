// Delete one of your own comments from a community's pool.
//   POST /xrpc/social.grain.unspecced.deletePoolComment
//
// Only your own: the write names your repo, and a space write into somebody
// else's repo is not a thing the protocol offers. A moderator who wants a
// comment gone takes the member out of the space instead, which takes their
// records with them.

import { defineProcedure, InvalidRequestError } from "$hatk";
import { poolUri } from "../spaces/client.ts";
import { throwSpaceError } from "../spaces/errors.ts";

export default defineProcedure("social.grain.unspecced.deletePoolComment", async (ctx) => {
  const { ok, db, viewer, pds, input } = ctx;
  if (!viewer) throw new InvalidRequestError("Authentication required");

  const { group, rkey } = input;
  try {
    await pds("com.atproto.space.deleteRecord", {
      method: "POST",
      body: {
        space: poolUri(group),
        repo: viewer.did,
        collection: "social.grain.comment",
        rkey,
      },
    });
  } catch (err) {
    return throwSpaceError(err, db, viewer.did);
  }
  return ok({ deleted: true });
});
