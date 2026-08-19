// Private galleries other accounts have shared with the viewer.
//   GET /xrpc/social.grain.unspecced.listSharedGalleries
//
// The one place grain keeps something the protocol does not. A space's member
// list lives with its authority and being added leaves no trace on the member's
// own PDS, so a reader has nothing to enumerate — listSpaces on their server
// returns only spaces they have written into, which for a reader is none.
//
// So grain records who a gallery was shared with as it shares it. That record
// is a hint and never an authority: every row here is confirmed by actually
// reading the gallery through a credential the authority issues, so a viewer
// since removed from the space sees a 403 and the row is dropped from the
// answer rather than shown.

import { defineQuery, InvalidRequestError } from "$hatk";
import { listSpaceRecords, parseSpaceUri, SpaceError } from "../spaces/client.ts";

interface InviteRow {
  space: string;
  author_did: string;
  created_at: string;
}

export default defineQuery("social.grain.unspecced.listSharedGalleries", async (ctx) => {
  const { ok, db, viewer, pds, params } = ctx;
  if (!viewer) throw new InvalidRequestError("Authentication required");

  const limit = Math.min(Number(params.limit) || 25, 50);

  const rows = (await db.query(
    `SELECT space, author_did, created_at FROM _space_invites
     WHERE member_did = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [viewer.did, limit],
  )) as InviteRow[];
  if (rows.length === 0) return ok({ galleries: [] });

  const galleries = await Promise.all(
    rows.map(async (row) => {
      let skey: string;
      let authority: string;
      try {
        ({ skey, authority } = parseSpaceUri(row.space));
      } catch {
        return null;
      }

      try {
        const records = await listSpaceRecords(
          pds,
          viewer.did,
          row.space,
          authority,
          "social.grain.gallery",
        );
        const record = records.find((r) => r.rkey === skey) ?? records[0];
        const value = record?.value as { title?: string; createdAt?: string } | undefined;

        return {
          space: row.space,
          skey,
          author: row.author_did,
          ...(value?.title ? { title: value.title } : {}),
          ...(value?.createdAt ? { createdAt: value.createdAt } : {}),
        };
      } catch (err) {
        // Removed from the space, or the gallery is gone. Either way it is not
        // the viewer's to see, and a row we cannot read is not one to show.
        if (err instanceof SpaceError) return null;
        throw err;
      }
    }),
  );

  const items = galleries.filter((g): g is NonNullable<typeof g> => g !== null);

  // Handles, so a shared gallery says who shared it. A DID that resolves to
  // nothing keeps the row — the gallery is still readable.
  const authors = [...new Set(items.map((g) => g.author))];
  const handleRows =
    authors.length > 0
      ? ((await db.query(
          `SELECT did, handle FROM _repos WHERE did IN (${authors.map((_, i) => `$${i + 1}`).join(",")})`,
          authors,
        )) as { did: string; handle: string }[])
      : [];
  const handles = new Map(handleRows.map((r) => [r.did, r.handle]));

  return ok({
    galleries: items.map((g) => ({
      ...g,
      ...(handles.get(g.author) ? { authorHandle: handles.get(g.author) } : {}),
    })),
  });
});
