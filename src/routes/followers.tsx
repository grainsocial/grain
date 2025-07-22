import { BffContext, RouteHandler } from "@bigmoves/bff";
import { Breadcrumb } from "../components/Breadcrumb.tsx";
import { FollowsList } from "../components/FollowsList.tsx";
import { Header } from "../components/Header.tsx";
import { getActorProfile } from "../lib/actor.ts";
import { getFollowersWithProfiles } from "../lib/graph.ts";
import { State } from "../state.ts";
import { profileLink } from "../utils.ts";

export const handler: RouteHandler = (
  _req,
  params,
  ctx: BffContext<State>,
) => {
  const handle = params.handle;
  if (!handle) return ctx.next();

  const actor = ctx.indexService.getActorByHandle(handle);

  if (!actor) return ctx.next();

  const profile = getActorProfile(actor?.did, ctx);

  if (!actor) return ctx.next();

  const followers = getFollowersWithProfiles(actor.did, ctx);

  ctx.state.meta = [{ title: `People following @${handle} — Grain` }];

  return ctx.render(
    <div class="p-4">
      <Breadcrumb
        items={[{ label: "profile", href: profileLink(handle) }, {
          label: "followers",
        }]}
      />
      <Header>{profile?.displayName}</Header>
      <p class="mb-6 text-zinc-600 dark:text-zinc-500">
        {followers.length ?? 0} followers
      </p>
      <FollowsList profiles={followers} />
    </div>,
  );
};
