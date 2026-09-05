import { defineSetup } from "$hatk";

// Which stories each account has watched. Private, appview-held state like
// _mutes: it never touches the repo, so nothing rebuilds it from the network.
//
// `subject` is the story's AT URI. A story only lives 24 hours and a view is
// only interesting while it does, so rows are pruned once they are a week old
// rather than kept forever.
export default defineSetup(async (ctx) => {
  await ctx.db.run(`
    CREATE TABLE IF NOT EXISTS _story_views (
      did TEXT NOT NULL,
      subject TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (did, subject)
    )
  `);
  await ctx.db.run(`CREATE INDEX IF NOT EXISTS idx_story_views_did ON _story_views (did)`);
  await ctx.db.run(`DELETE FROM _story_views WHERE created_at < $1`, [
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  ]);
});
