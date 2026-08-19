// Share an existing private gallery with another account.
//   POST /xrpc/social.grain.unspecced.addSpaceMember
//
// The space's authority holds the member list and consults it when minting a
// credential, so adding someone here is what actually grants them the gallery.
// The invite row written alongside is only so they can find it without a link.

import { defineProcedure, InvalidRequestError } from "$hatk";
import { resolveActor } from "../helpers/resolveActor.ts";
import { parseSpaceUri } from "../spaces/client.ts";
import { throwSpaceError } from "../spaces/errors.ts";

export default defineProcedure("social.grain.unspecced.addSpaceMember", async (ctx) => {
  const { ok, db, viewer, pds, input } = ctx;
  if (!viewer) throw new InvalidRequestError("Authentication required");

  const { space, actor } = input;

  let authority: string;
  try {
    ({ authority } = parseSpaceUri(space));
  } catch {
    throw new InvalidRequestError(`Not a space uri: ${space}`);
  }
  if (authority !== viewer.did) {
    throw new InvalidRequestError("Only the gallery's author can add members", "NotAuthorized");
  }
  // A handle is what a person knows; the space stores a DID. Resolved through
  // the index first, then the viewer's PDS, which can resolve a handle grain
  // has never indexed.
  const did = await resolveActor(db, pds, actor);
  if (!did) {
    throw new InvalidRequestError(`Could not find ${actor}`, "ActorNotFound");
  }
  if (did === viewer.did) {
    throw new InvalidRequestError("You already have access to your own gallery");
  }

  try {
    await pds("com.atproto.simplespace.addMember", { method: "POST", body: { space, did } });
  } catch (err) {
    return throwSpaceError(err, db, viewer.did);
  }

  await db.run(
    `INSERT INTO _space_invites (space, member_did, author_did, created_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (space, member_did) DO NOTHING`,
    [space, did, viewer.did, new Date().toISOString()],
  );

  return ok({ did });
});
