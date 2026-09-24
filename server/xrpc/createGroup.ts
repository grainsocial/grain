import { defineProcedure, InvalidRequestError } from "$hatk";
import { callGroupHost, provisioningHost } from "../helpers/groupHost.ts";
import { acceptMembership } from "../helpers/membership.ts";
import { POOL_SPACE_TYPE } from "../spaces/client.ts";

// What Grain asks for on a group it starts: to speak for it on Grain. Its
// profile, and answering the pool's submissions, both in the group's own repo.
// The host only grants what Grain's client metadata already declares.
const GROUP_SCOPE = [
  "atproto",
  "repo:social.grain.actor.profile",
  "repo:social.grain.group.item",
  "repo:social.grain.group.decline",
].join(" ");

/**
 * Start a group without leaving Grain.
 *
 * The viewer asks Grain's group host to found it (service auth from their own
 * PDS names them the founder) and Grain authenticates to the host as itself;
 * the host creates the group and hands Grain a session on it, which hatk keeps
 * like any other. Then the group gets what a Grain group is: a pool, opened by
 * the viewer as its founding admin, and a Grain profile, written by Grain as
 * the group.
 */
export default defineProcedure("social.grain.unspecced.createGroup", async (ctx) => {
  const { input, ok, viewer } = ctx;
  if (!viewer) throw new InvalidRequestError("Sign in to start a group");
  const host = await provisioningHost();
  if (!host) throw new InvalidRequestError("This Grain does not start groups", "NotSupported");

  const name = input.name.trim().toLowerCase();
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(name))
    throw new InvalidRequestError("Use letters, numbers and hyphens", "InvalidName");
  const handle = `${name}${host.handleDomain}`;

  const lxm = "fyi.opensocial.provisionGroup";
  const { token } = (await ctx.pds("com.atproto.server.getServiceAuth", {
    params: { aud: host.did, lxm },
  })) as { token: string };
  const { did } = await ctx.obtainSession(
    `${host.url}/xrpc/${lxm}`,
    {
      handle,
      displayName: input.displayName,
      ...(input.description ? { description: input.description } : {}),
      scope: GROUP_SCOPE,
    },
    { headers: { authorization: `Bearer ${token}` } },
  );

  // The pool is a host decision (a space, and who may read it), so it is the
  // founder who asks for it.
  const pool = await callGroupHost(ctx.pds, did, "fyi.opensocial.createSpace", {
    group: did,
    type: POOL_SPACE_TYPE,
    skey: "self",
    name: "Pool",
    readableBy: ["member"],
  });
  if (!pool.ok)
    throw new InvalidRequestError(pool.body?.message ?? `could not open the pool (${pool.status})`);

  // The group's face on Grain, written as the group with the session the
  // host just handed over.
  await ctx.asAccount(did).putRecord("social.grain.actor.profile", "self", {
    displayName: input.displayName,
    ...(input.description ? { description: input.description } : {}),
    createdAt: new Date().toISOString(),
  });

  // The founder's half of membership, so the group is theirs on Grain at once.
  await acceptMembership(ctx.pds, viewer.did, did).catch(() => {});
  return ok({ did, handle });
});
