import { defineQuery, InvalidRequestError } from "$hatk";
import { hydrateGroups, resolveGroupActor } from "../hydrate/groups.ts";

export default defineQuery("social.grain.unspecced.getGroup", async (ctx) => {
  const did = await resolveGroupActor(ctx, ctx.params.actor);
  if (!did) throw new InvalidRequestError("Not a group");
  const [group] = await hydrateGroups(ctx, [did]);
  return ctx.ok(group);
});
