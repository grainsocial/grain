// Withdraw the viewer's own gallery from a community's pool.
//   POST /xrpc/social.grain.unspecced.deletePoolGallery
//
// The counterpart to createPoolGallery, and the same shape in reverse: a
// gallery in a pool is the author's own records — the gallery, its photos, the
// items joining them — living in the community's space rather than the public
// repo. Putting them there should not mean being unable to take them back.
//
// Author-scoped by construction, not by a check: every write names
// `repo: viewer.did`, so this can only ever remove the viewer's own records.
// Evicting somebody else's gallery is the group's act and wants its own route.
//
// The rkeys are read rather than derived. createPoolGallery happens to name a
// photo `${rkey}-${index}`, but a gallery edited later need not keep that, and
// deleting by a guessed name would silently leave records behind in a space
// nothing indexes.
import { defineProcedure, InvalidRequestError } from "$hatk";
import { listSpaceRecords, poolUri } from "../spaces/client.ts";
import { throwSpaceError } from "../spaces/errors.ts";

interface ItemValue {
  gallery?: string;
  item?: string;
}

export default defineProcedure("social.grain.unspecced.deletePoolGallery", async (ctx) => {
  const { ok, db, viewer, pds, input } = ctx;
  if (!viewer) throw new InvalidRequestError("Authentication required");

  const { group, rkey } = input;
  const space = poolUri(group);
  const selfUri = (collection: string, key: string) => `at://${viewer.did}/${collection}/${key}`;
  const galleryUri = selfUri("social.grain.gallery", rkey);

  let items: { rkey: string; value: unknown }[];
  try {
    items = await listSpaceRecords(pds, viewer.did, space, viewer.did, "social.grain.gallery.item");
  } catch (err) {
    return throwSpaceError(err, db, viewer.did);
  }

  // The items that join this gallery to its photos, and the photos they name.
  const mine = items.filter((i) => (i.value as ItemValue)?.gallery === galleryUri);
  const photoRkeys = new Set<string>();
  for (const i of mine) {
    const item = (i.value as ItemValue)?.item;
    if (typeof item === "string" && item.startsWith(`at://${viewer.did}/social.grain.photo/`)) {
      photoRkeys.add(item.split("/").pop()!);
    }
  }

  const del = (collection: string, key: string) => ({
    $type: "com.atproto.space.applyWrites#delete",
    collection,
    rkey: key,
  });
  const writes = [
    del("social.grain.gallery", rkey),
    ...mine.map((i) => del("social.grain.gallery.item", i.rkey)),
    ...[...photoRkeys].map((k) => del("social.grain.photo", k)),
  ];

  try {
    await pds("com.atproto.space.applyWrites", {
      method: "POST",
      body: { space, repo: viewer.did, writes },
    });
  } catch (err) {
    return throwSpaceError(err, db, viewer.did);
  }

  return ok({ deleted: writes.length });
});
