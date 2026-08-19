// The viewer's own private galleries.
//   GET /xrpc/social.grain.unspecced.listPrivateGalleries
//
// Their PDS holds the spaces, so it is the only thing that can enumerate them —
// there is no index to read, and a gallery that nothing links to is otherwise
// lost the moment its URL is.
//
// Authors only. A space tells its members nothing about itself: the authority
// holds the member list, but a member cannot ask which spaces they were added
// to. Someone you share a gallery with still needs the link.

import { defineQuery, InvalidRequestError } from "$hatk";
import { GALLERY_SPACE_TYPE, listSpaceRecords, parseSpaceUri } from "../spaces/client.ts";

/**
 * `com.atproto.space.listSpaces#spaceView` carries only `uri`. pds.js adds an
 * `isOwner` flag, but nothing in the lexicon promises it, so authorship is
 * decided from the URI instead — a space's authority is the DID it is anchored
 * on, which every conformant server states the same way.
 */
interface SpaceRef {
  uri: string;
}

export default defineQuery("social.grain.unspecced.listPrivateGalleries", async (ctx) => {
  const { ok, viewer, pds, params } = ctx;
  if (!viewer) throw new InvalidRequestError("Authentication required");

  const limit = Math.min(Number(params.limit) || 50, 100);

  const body = await pds("com.atproto.space.listSpaces", {
    method: "GET",
    params: { type: GALLERY_SPACE_TYPE, limit },
  });

  // listSpaces answers with the spaces this account has written into, which is
  // not the same as the ones it made: contribute a record to somebody else's
  // space and it lists too. Keep the ones anchored on the viewer.
  const spaces = ((body.spaces ?? []) as SpaceRef[]).filter((s) => {
    try {
      return parseSpaceUri(s.uri).authority === viewer.did;
    } catch {
      return false;
    }
  });

  // One read per space for its gallery record, concurrently — they all land on
  // the viewer's own PDS through their own session.
  const galleries = await Promise.all(
    spaces.map(async (space) => {
      let skey: string;
      try {
        ({ skey } = parseSpaceUri(space.uri));
      } catch {
        return null;
      }

      // A space whose record cannot be read is still a space the viewer made —
      // list it by its skey rather than dropping it, so a half-written gallery
      // stays reachable instead of disappearing.
      let title: string | undefined;
      let createdAt: string | undefined;
      try {
        const records = await listSpaceRecords(
          pds,
          viewer.did,
          space.uri,
          viewer.did,
          "social.grain.gallery",
        );
        const record = records.find((r) => r.rkey === skey) ?? records[0];
        const value = record?.value as { title?: string; createdAt?: string } | undefined;
        title = value?.title;
        createdAt = value?.createdAt;
      } catch {
        // fall through with just the skey
      }

      return {
        space: space.uri,
        skey,
        ...(title ? { title } : {}),
        ...(createdAt ? { createdAt } : {}),
      };
    }),
  );

  const items = galleries.filter((g): g is NonNullable<typeof g> => g !== null);
  // Newest first, and a gallery with no readable record sorts last rather than
  // jumping the list on an empty date.
  items.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  return ok({ galleries: items });
});
