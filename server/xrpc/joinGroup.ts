import { defineProcedure, InvalidRequestError } from "$hatk";
import { callCommunityHost } from "../helpers/communityHost.ts";

/** The first time Grain talks to a community host directly: ask to join. */
export default defineProcedure("social.grain.unspecced.joinGroup", async (ctx) => {
  const { input, ok, viewer } = ctx;
  if (!viewer) throw new InvalidRequestError("Sign in to join a group");
  const r = await callCommunityHost(ctx.pds, input.group, "community.opensocial.requestJoin", {
    community: input.group,
    ...(input.message ? { message: input.message } : {}),
  });
  if (!r.ok)
    throw new InvalidRequestError(r.body?.message ?? `join failed (${r.status})`, r.body?.error);
  return ok({ status: r.body.status === "admitted" ? "admitted" : "pending" });
});
