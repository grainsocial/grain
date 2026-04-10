import { defineProcedure } from "$hatk";

export default defineProcedure("social.grain.graph.unmuteActor", async (ctx) => {
  const { ok, db, viewer } = ctx;
  if (!viewer) throw new Error("Authentication required");

  await db.run(
    `DELETE FROM _mutes WHERE did = $1 AND subject = $2`,
    [viewer.did, ctx.input.actor],
  );

  return ok({});
});
