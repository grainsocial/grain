// Deletes the authenticated user's Grain account.
// Removes all of the user's Grain records from their PDS and clears supporting
// server-side state (mutes, preferences, push tokens, OAuth session).
// Reports and labels are moderation records and are preserved.
//   POST /xrpc/social.grain.unspecced.deleteAccount

import { defineProcedure } from "$hatk";

// Ordered children-first for cleanliness. atproto deleteRecord doesn't require
// a specific order, but this avoids leaving orphaned children visible in the
// appview between individual deletes.
const GRAIN_COLLECTIONS = [
  "social.grain.photo.exif",
  "social.grain.gallery.item",
  "social.grain.photo",
  "social.grain.gallery",
  "social.grain.story",
  "social.grain.favorite",
  "social.grain.comment",
  "social.grain.graph.follow",
  "social.grain.graph.block",
  "social.grain.actor.profile",
] as const;

export default defineProcedure("social.grain.unspecced.deleteAccount", async (ctx) => {
  const { db, ok, viewer, deleteRecord } = ctx;
  if (!viewer) throw new Error("Authentication required");
  const did = viewer.did;

  // 1. Delete every Grain record owned by the viewer from their PDS.
  //    Best-effort: log and continue on per-record failures so a single
  //    stuck record can't block the rest of the deletion.
  for (const collection of GRAIN_COLLECTIONS) {
    const rows = (await db.query(
      `SELECT uri FROM "${collection}" WHERE did = $1`,
      [did],
    )) as { uri: string }[];
    for (const row of rows) {
      const rkey = row.uri.split("/").pop()!;
      try {
        await deleteRecord(collection, rkey);
      } catch (err) {
        console.warn(`deleteAccount: failed to delete ${row.uri}:`, err);
      }
    }
  }

  // 2. Clear appview-side state keyed by the viewer's did. Reports and labels
  //    are moderation records and are intentionally preserved.
  await db.run(`DELETE FROM _mutes WHERE did = $1`, [did]);
  await db.run(`DELETE FROM _preferences WHERE did = $1`, [did]);
  await db.run(`DELETE FROM _push_tokens WHERE did = $1`, [did]);

  // 3. Revoke OAuth state. This ends the server-side session; the client
  //    should also clear local tokens and drop the user back to the login.
  await db.run(`DELETE FROM _oauth_refresh_tokens WHERE did = $1`, [did]);
  await db.run(`DELETE FROM _oauth_sessions WHERE did = $1`, [did]);

  return ok({});
});
