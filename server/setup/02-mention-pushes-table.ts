import { defineSetup } from "$hatk";

export default defineSetup(async (ctx) => {
  await ctx.db.run(`
    CREATE TABLE IF NOT EXISTS _mention_pushes (
      record_uri TEXT NOT NULL,
      recipient_did TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (record_uri, recipient_did)
    )
  `);
});
