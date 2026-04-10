import { defineProcedure } from "$hatk";

export default defineProcedure("social.grain.graph.muteActor", async (ctx) => {
  const { ok, db, viewer } = ctx;
  if (!viewer) throw new Error("Authentication required");

  const { actor } = ctx.input;
  if (actor === viewer.did) throw new Error("Cannot mute yourself");

  await db.run(
    `INSERT INTO _mutes (did, subject, created_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (did, subject) DO NOTHING`,
    [viewer.did, actor, new Date().toISOString()],
  );

  return ok({});
});
