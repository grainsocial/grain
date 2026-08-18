import { defineSetup } from "$hatk";

export default defineSetup(async (ctx) => {
  // Keyed by PDS endpoint, not by DID: support is a property of the server, so
  // every account on one host shares an answer and one probe covers them all.
  await ctx.db.run(`
    CREATE TABLE IF NOT EXISTS _space_support (
      pds_endpoint TEXT PRIMARY KEY,
      supported INTEGER NOT NULL,
      missing TEXT NOT NULL,
      checked_at TEXT NOT NULL
    )
  `);
});
