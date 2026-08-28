import { defineProcedure, InvalidRequestError } from "$hatk";
import { callCommunityHost } from "../helpers/communityHost.ts";

export default defineProcedure("social.grain.unspecced.leaveGroup", async (ctx) => {
  const { input, ok, viewer } = ctx;
  if (!viewer) throw new InvalidRequestError("Sign in first");
  const r = await callCommunityHost(ctx.pds, input.group, "community.opensocial.leaveCommunity", {
    community: input.group,
  });
  if (!r.ok)
    throw new InvalidRequestError(r.body?.message ?? `leave failed (${r.status})`, r.body?.error);
  return ok({});
});
