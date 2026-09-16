// Whether the viewer's PDS serves permissioned spaces (proposal 0016).
//   GET /xrpc/social.grain.unspecced.getSpaceSupport
//
// The answer comes from a cached probe: community.lexicon.service.describe when
// the server offers it, and otherwise the methods themselves, judged against how
// that server answers for a method it does not have. See helpers/spaceSupport.ts.
//
// True today for pds.js with PDS_ENABLE_SPACES and for the alpha @atproto/pds
// build — which serves spaces but no describe, and so read as false until the
// fallback existed. False for bsky.social and everything else, so anything built
// on spaces stays gated behind this call.

import { defineQuery, InvalidRequestError } from "$hatk";
import { getSpaceSupport, pdsEndpointFor } from "../helpers/spaceSupport.ts";

export default defineQuery("social.grain.unspecced.getSpaceSupport", async (ctx) => {
  const { ok, db, viewer, params } = ctx;
  if (!viewer) throw new InvalidRequestError("Authentication required");

  const pds = await pdsEndpointFor(db, viewer.did);
  if (!pds) throw new InvalidRequestError("No PDS session for this account");

  // A query param arrives as a string, and "false" read plainly is true.
  const force = params.force === true || params.force === "true";

  return ok(await getSpaceSupport(db, pds, { force }));
});
