import { defineProcedure, InvalidRequestError } from "$hatk";
import { callGroupHost } from "../helpers/groupHost.ts";
import { acceptMembership, forgetRefusal } from "../helpers/membership.ts";

/** The first time Grain talks to a group host directly: ask to join. */
export default defineProcedure("social.grain.unspecced.joinGroup", async (ctx) => {
  const { input, ok, viewer } = ctx;
  if (!viewer) throw new InvalidRequestError("Sign in to join a group");
  const r = await callGroupHost(ctx.pds, input.group, "fyi.opensocial.requestJoin", {
    group: input.group,
    ...(input.message ? { message: input.message } : {}),
  });
  if (!r.ok)
    throw new InvalidRequestError(r.body?.message ?? `join failed (${r.status})`, r.body?.error);
  if (r.body.status !== "admitted") return ok({ status: "pending" });
  forgetRefusal(viewer.did, input.group);
  // The member's half of membership, and what lets grain find this group
  // again from their own PDS. A request that is still pending gets its
  // acceptance when the group page next sees them admitted (getGroup).
  await acceptMembership(ctx.pds, viewer.did, input.group).catch(() => {});
  return ok({ status: "admitted" });
});
