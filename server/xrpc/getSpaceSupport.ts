// Whether the viewer's PDS serves permissioned spaces (proposal 0016).
//   GET /xrpc/social.grain.unspecced.getSpaceSupport
//
// The answer comes from a cached probe of community.lexicon.service.describe;
// see helpers/spaceSupport.ts for why that endpoint is the only way to ask.
// Today this is true for pds.js deployments with PDS_ENABLE_SPACES set and
// false everywhere else, bsky.social included — so anything built on it has to
// stay gated behind this call.

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
