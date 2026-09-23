import { defineQuery, InvalidRequestError } from "$hatk";
import { hydrateGroups, resolveGroupActor } from "../hydrate/groups.ts";
import { acceptMembership, candidateGroups, isMember } from "../helpers/membership.ts";

export default defineQuery("social.grain.unspecced.getGroup", async (ctx) => {
  const did = await resolveGroupActor(ctx, ctx.params.actor);
  if (!did) throw new InvalidRequestError("Not a group");
  const viewer = ctx.viewer?.did;
  const member =
    !!viewer && viewer !== did && (await isMember(ctx.pds, viewer, did, { fresh: true }));

  // Someone whose request was admitted since they last looked has no
  // acceptance yet, so their PDS does not list this group and nothing else in
  // grain would find it. This page is where they turn up; write it now.
  if (member) {
    const listed = await candidateGroups(ctx.pds).catch(() => [did]);
    if (!listed.includes(did)) await acceptMembership(ctx.pds, viewer, did).catch(() => {});
  }

  const [group] = await hydrateGroups(ctx, [did], { mine: member ? [did] : [] });
  return ctx.ok(group);
});
