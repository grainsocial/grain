// Comment on a gallery in a community's pool.
//   POST /xrpc/social.grain.unspecced.createPoolComment
//
// The comment is the commenter's own record, in their own repo, inside the
// community's space — beside the gallery it answers rather than in the public
// repo, where it would name a private gallery to everyone. Which is also why
// the thread is assembled by reading every member's repo: your reply to my
// gallery was never mine to hold.

import { defineProcedure, InvalidRequestError } from "$hatk";
import { tid } from "../helpers/tid.ts";
import { poolUri } from "../spaces/client.ts";
import { throwSpaceError } from "../spaces/errors.ts";

const COLLECTION = "social.grain.comment";

export default defineProcedure("social.grain.unspecced.createPoolComment", async (ctx) => {
  const { ok, db, viewer, pds, input } = ctx;
  if (!viewer) throw new InvalidRequestError("Authentication required");

  const { group, gallery, text, facets, replyTo } = input;
  const trimmed = String(text ?? "").trim();
  if (!trimmed) throw new InvalidRequestError("A comment needs something in it");

  const space = poolUri(group);
  const rkey = tid();

  try {
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
          text: trimmed,
          subject: gallery,
          ...(facets ? { facets } : {}),
          ...(replyTo ? { replyTo } : {}),
          createdAt: new Date().toISOString(),
        },
      },
    });
  } catch (err) {
    return throwSpaceError(err, db, viewer.did);
  }

  return ok({ uri: `at://${viewer.did}/${COLLECTION}/${rkey}`, rkey });
});
