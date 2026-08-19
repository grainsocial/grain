// Who a private gallery is shared with.
//   GET /xrpc/social.grain.unspecced.getSpaceMembers?space=...
//
// The member list lives on the space's authority and is not enumerated to the
// network, so this only works for the author, through their own session. Grain's
// _space_invites table is not consulted: it records what grain shared, while
// this answers what the space actually holds.

import { defineQuery, InvalidRequestError } from "$hatk";
import { parseSpaceUri } from "../spaces/client.ts";
import { throwSpaceError } from "../spaces/errors.ts";

interface MemberRow {
  did: string;
}

export default defineQuery("social.grain.unspecced.getSpaceMembers", async (ctx) => {
  const { ok, db, viewer, pds, params, lookup, blobUrl } = ctx;
  if (!viewer) throw new InvalidRequestError("Authentication required");

  let authority: string;
  try {
    ({ authority } = parseSpaceUri(params.space));
  } catch {
    throw new InvalidRequestError(`Not a space uri: ${params.space}`);
  }
  if (authority !== viewer.did) {
    throw new InvalidRequestError("Only the gallery's author can see its members", "NotAuthorized");
  }

  let dids: string[];
  try {
    const body = await pds("com.atproto.simplespace.listMembers", {
      method: "GET",
      params: { space: params.space, limit: 100 },
    });
    // createSpace puts the owner on their own member list, since membership is
    // what a member-list policy consults. True, and not what "shared with"
    // means to the person reading it.
    dids = ((body.members ?? []) as MemberRow[])
      .map((m) => m.did)
      .filter((did) => did !== authority);
  } catch (err) {
    return throwSpaceError(err, db, viewer.did);
  }

  if (dids.length === 0) return ok({ members: [] });

  // Profiles come from the public index, which may know nothing about an
  // account on a PDS grain has never seen. A bare DID is still a member.
  const profiles = await lookup("social.grain.actor.profile", "did", dids);
  const handleRows = (await db.query(
    `SELECT did, handle FROM _repos WHERE did IN (${dids.map((_, i) => `$${i + 1}`).join(",")})`,
    dids,
  )) as { did: string; handle: string }[];
  const handles = new Map(handleRows.map((r) => [r.did, r.handle]));

  return ok({
    members: dids.map((did) => {
      const profile = profiles.get(did);
      const value = profile?.value as { displayName?: string; avatar?: unknown } | undefined;
      return {
        did,
        ...(handles.get(did) ? { handle: handles.get(did) } : {}),
        ...(value?.displayName ? { displayName: value.displayName } : {}),
        ...(profile ? { avatar: blobUrl(did, value?.avatar, "avatar") ?? undefined } : {}),
      };
    }),
  });
});
