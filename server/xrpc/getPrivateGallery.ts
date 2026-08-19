// Assemble a gallery that lives in a permissioned space.
//   GET /xrpc/social.grain.unspecced.getPrivateGallery?space=...
//
// Nothing here comes from the index, because nothing in a space ever reaches a
// firehose to be indexed from. The gallery is read from the repo that holds it,
// on the host that holds it, on every request — through the author's own session
// when the author is asking, and through a credential the space's authority
// issues when anyone else is.
//
// `cid` rides along per item so the client can ask getPrivateBlob for the bytes;
// they cannot come from the CDN.

import { defineQuery, InvalidRequestError } from "$hatk";
import { listSpaceRecords, parseSpaceUri } from "../spaces/client.ts";
import { throwSpaceError } from "../spaces/errors.ts";

interface PhotoValue {
  photo?: { ref?: { $link?: string } };
  alt?: string;
  aspectRatio?: { width: number; height: number };
}

interface ItemValue {
  item?: string;
  position?: number;
}

export default defineQuery("social.grain.unspecced.getPrivateGallery", async (ctx) => {
  const { ok, db, viewer, pds, params } = ctx;
  if (!viewer) throw new InvalidRequestError("Authentication required");

  const space = params.space;
  let authority: string;
  let skey: string;
  try {
    ({ authority, skey } = parseSpaceUri(space));
  } catch {
    throw new InvalidRequestError(`Not a space uri: ${space}`);
  }

  try {
    const [galleries, items, photos] = await Promise.all([
      listSpaceRecords(pds, viewer.did, space, authority, "social.grain.gallery"),
      listSpaceRecords(pds, viewer.did, space, authority, "social.grain.gallery.item"),
      listSpaceRecords(pds, viewer.did, space, authority, "social.grain.photo"),
    ]);

    // An item names its photo by the at-uri the record would have in a public
    // repo, so photos are keyed the same way. A space record has no uri of its
    // own — its address is the space, the repo, the collection and the rkey.
    const byUri = new Map(photos.map((p) => [`at://${authority}/social.grain.photo/${p.rkey}`, p]));

    const view = items
      .map((item) => {
        const value = item.value as ItemValue;
        const photo = value.item ? byUri.get(value.item) : undefined;
        if (!photo) return null;
        const photoValue = photo.value as PhotoValue;
        const cid = photoValue.photo?.ref?.$link;
        if (!cid) return null;
        return {
          uri: `at://${authority}/social.grain.photo/${photo.rkey}`,
          did: authority,
          cid,
          ...(photoValue.alt ? { alt: photoValue.alt } : {}),
          ...(photoValue.aspectRatio ? { aspectRatio: photoValue.aspectRatio } : {}),
          position: value.position ?? 0,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.position - b.position);

    const galleryRecord = galleries.find((g) => g.rkey === skey) ?? galleries[0];
    const galleryValue = galleryRecord?.value as
      | { title?: string; description?: string; createdAt?: string }
      | undefined;

    return ok({
      space,
      authority,
      viewerIsAuthor: viewer.did === authority,
      ...(galleryRecord && galleryValue?.title
        ? {
            gallery: {
              uri: `at://${authority}/social.grain.gallery/${skey}`,
              title: galleryValue.title,
              ...(galleryValue.description ? { description: galleryValue.description } : {}),
              ...(galleryValue.createdAt ? { createdAt: galleryValue.createdAt } : {}),
            },
          }
        : {}),
      items: view,
    });
  } catch (err) {
    return throwSpaceError(err, db, viewer.did);
  }
});
