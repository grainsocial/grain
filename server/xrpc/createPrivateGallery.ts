// Create a gallery inside a permissioned space.
//   POST /xrpc/social.grain.unspecced.createPrivateGallery
//
// One gallery is one space: the space's skey is the gallery's rkey, and its
// authority is the author. Members are readers — in this shape only the author
// writes, which keeps curation whole. A member's records would live in their own
// repo, where the authority can evict them from the space but cannot remove a
// single photo from the gallery.
//
// Blobs are uploaded beforehand through the ordinary blob endpoint: a space
// record's blobs are ordinary account blobs, and only reading them back goes
// through the space.

import { defineProcedure, InvalidRequestError } from "$hatk";
import { getSpaceSupport, pdsEndpointFor } from "../helpers/spaceSupport.ts";
import { GALLERY_SPACE_TYPE, spaceUri } from "../spaces/client.ts";

interface PhotoInput {
  photo: unknown;
  alt?: string;
  aspectRatio: { width: number; height: number };
}

export default defineProcedure("social.grain.unspecced.createPrivateGallery", async (ctx) => {
  const { ok, db, viewer, pds, input } = ctx;
  if (!viewer) throw new InvalidRequestError("Authentication required");

  const { rkey, title, description } = input;
  const members = (input.members ?? []) as string[];
  const photos = (input.photos ?? []) as PhotoInput[];

  const endpoint = await pdsEndpointFor(db, viewer.did);
  if (!endpoint) throw new InvalidRequestError("No PDS session for this account");
  const support = await getSpaceSupport(db, endpoint);
  if (!support.supported) {
    throw new InvalidRequestError(
      "Your PDS does not serve permissioned spaces",
      "SpacesUnsupported",
    );
  }

  const space = spaceUri(viewer.did, rkey);
  const createdAt = new Date().toISOString();

  await pds("com.atproto.simplespace.createSpace", {
    method: "POST",
    body: {
      type: GALLERY_SPACE_TYPE,
      skey: rkey,
      policy: { $type: "com.atproto.simplespace.defs#memberListPolicy" },
      appAccess: { $type: "com.atproto.simplespace.defs#open" },
    },
  });

  // Sequential rather than concurrent: the authority applies these to one
  // member list, and a handful of readers is not worth racing.
  //
  // Each member is also recorded here, because nothing else will tell them.
  // Being added to a space leaves no trace on the member's own PDS, so without
  // this row a reader can only reach the gallery through a link somebody sent
  // them. It grants nothing on its own — the read still needs a credential the
  // authority issues.
  for (const did of members) {
    if (did === viewer.did) continue; // the authority is authorized without being listed
    await pds("com.atproto.simplespace.addMember", { method: "POST", body: { space, did } });
    await db.run(
      `INSERT INTO _space_invites (space, member_did, author_did, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (space, member_did) DO NOTHING`,
      [space, did, viewer.did, createdAt],
    );
  }

  // The gallery, its photos and the items joining them, in one commit. A
  // half-written gallery is worse here than in the public repo: there is no
  // indexer to reconcile it against later.
  const writes: Record<string, unknown>[] = [
    {
      $type: "com.atproto.space.applyWrites#create",
      collection: "social.grain.gallery",
      rkey,
      value: {
        $type: "social.grain.gallery",
        title,
        ...(description ? { description } : {}),
        createdAt,
      },
    },
  ];

  photos.forEach((photo, index) => {
    const photoRkey = `${rkey}-${index}`;
    writes.push({
      $type: "com.atproto.space.applyWrites#create",
      collection: "social.grain.photo",
      rkey: photoRkey,
      value: {
        $type: "social.grain.photo",
        photo: photo.photo,
        ...(photo.alt ? { alt: photo.alt } : {}),
        aspectRatio: photo.aspectRatio,
        createdAt,
      },
    });
    writes.push({
      $type: "com.atproto.space.applyWrites#create",
      collection: "social.grain.gallery.item",
      rkey: photoRkey,
      value: {
        $type: "social.grain.gallery.item",
        gallery: `at://${viewer.did}/social.grain.gallery/${rkey}`,
        item: `at://${viewer.did}/social.grain.photo/${photoRkey}`,
        position: index,
        createdAt,
      },
    });
  });

  await pds("com.atproto.space.applyWrites", {
    method: "POST",
    body: { space, repo: viewer.did, writes },
  });

  return ok({ space, uri: `at://${viewer.did}/social.grain.gallery/${rkey}` });
});
