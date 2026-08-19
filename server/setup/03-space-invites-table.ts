import { defineSetup } from "$hatk";

export default defineSetup(async (ctx) => {
  // Who a private gallery was shared with, so a reader can be shown one.
  //
  // The protocol offers no reverse index: a space's member list lives with its
  // authority, and being added leaves no trace on the member's own PDS, so a
  // reader has nothing to enumerate. This is grain filling that gap for
  // galleries made through grain.
  //
  // A hint, never an authority. Every read still presents a space credential
  // the authority issues, so a row that is stale — a member since removed —
  // buys nothing but a 403.
  await ctx.db.run(`
    CREATE TABLE IF NOT EXISTS _space_invites (
      space TEXT NOT NULL,
      member_did TEXT NOT NULL,
      author_did TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (space, member_did)
    )
  `);
  await ctx.db.run(
    `CREATE INDEX IF NOT EXISTS idx_space_invites_member ON _space_invites (member_did, created_at DESC)`,
  );
});
