import { defineSetup } from "$hatk";

export default defineSetup(async (ctx) => {
  await ctx.db.run(`
    CREATE TABLE IF NOT EXISTS _mutes (
      did TEXT NOT NULL,
      subject TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (did, subject)
    )
  `);
  await ctx.db.run(`CREATE INDEX IF NOT EXISTS idx_mutes_did ON _mutes (did)`);
  await ctx.db.run(`CREATE INDEX IF NOT EXISTS idx_mutes_subject ON _mutes (subject)`);
});
