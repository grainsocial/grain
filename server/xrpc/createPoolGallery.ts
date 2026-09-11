// Add a gallery to a community's pool.
//   POST /xrpc/social.grain.unspecced.createPoolGallery
//
// The pool is one space, anchored on the community, and the community made it.
// Nothing is created here and nothing is accepted: the member writes their own
// gallery into it, in their own repo, and being a member is the whole
// permission — their PDS asks the community's host whether they may write, and
// the host answers from the roster.
//
// That is also what makes leaving clean. The records are the author's, so a
// gallery goes with them; the pool is the space, so losing membership loses the
// read. Neither needs anything deleted.
//
// Blobs are uploaded beforehand through the ordinary blob endpoint: a space
// record's blobs are ordinary account blobs, and only reading them back goes
// through the space.

import { defineProcedure, InvalidRequestError } from "$hatk";
import { poolUri } from "../spaces/client.ts";
import { throwSpaceError } from "../spaces/errors.ts";

interface PhotoInput {
  photo: unknown;
  alt?: string;
  aspectRatio: { width: number; height: number };
}

export default defineProcedure("social.grain.unspecced.createPoolGallery", async (ctx) => {
  const { ok, db, viewer, pds, input } = ctx;
  if (!viewer) throw new InvalidRequestError("Authentication required");

  const { group, rkey, title, description } = input;
  const photos = (input.photos ?? []) as PhotoInput[];

  // No support probe first, unlike a private gallery. There the author's PDS
  // has to create a space, and asking beforehand is the difference between a
  // clear message and an upload wasted; here the space already exists, the one
  // call is a write into it, and its failure says what went wrong. A PDS that
  // serves describe only to an authenticated caller — the opensocial dev
  // network's does — would otherwise be read as having no spaces at all.
  const space = poolUri(group);
  const createdAt = new Date().toISOString();

  // The gallery, its photos and the items joining them, in one commit. A
  // half-written gallery is worse here than in the public repo: there is no
  // indexer to reconcile it against later.
  //
  // Records inside a space have no uri of their own — the address is the space,
  // the repo, the collection and the rkey — so an item names its gallery and
  // its photo by the uri each would have in the author's public repo. Every
  // reader assembles them the same way.
  const self = (collection: string, key: string) => `at://${viewer.did}/${collection}/${key}`;
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
        gallery: self("social.grain.gallery", rkey),
        item: self("social.grain.photo", photoRkey),
        position: index,
        createdAt,
      },
    });
  });

  try {
    await pds("com.atproto.space.applyWrites", {
      method: "POST",
      body: { space, repo: viewer.did, writes },
    });
  } catch (err) {
    return throwSpaceError(err, db, viewer.did);
  }

  return ok({ space, uri: self("social.grain.gallery", rkey) });
});
