import { defineProcedure, InvalidRequestError } from "$hatk";
import { callCommunityHost } from "../helpers/communityHost.ts";
import { forgetMembership, withdrawAcceptance } from "../helpers/membership.ts";

export default defineProcedure("social.grain.unspecced.leaveGroup", async (ctx) => {
  const { input, ok, viewer } = ctx;
  if (!viewer) throw new InvalidRequestError("Sign in first");
  // First, while the space still takes this member's writes.
  await withdrawAcceptance(ctx.pds, viewer.did, input.group).catch(() => {});
  const r = await callCommunityHost(ctx.pds, input.group, "fyi.opensocial.leaveCommunity", {
    community: input.group,
  });
  if (!r.ok)
    throw new InvalidRequestError(r.body?.message ?? `leave failed (${r.status})`, r.body?.error);
  forgetMembership(viewer.did, input.group);
  return ok({});
});
