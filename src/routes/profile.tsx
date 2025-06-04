import { BffContext, RouteHandler } from "@bigmoves/bff";
import { ProfilePage, ProfileTabs } from "../components/ProfilePage.tsx";
import {
  getActorGalleries,
  getActorGalleryFavs,
  getActorProfile,
  getActorProfiles,
} from "../lib/actor.ts";
import { type FollowMap, getFollows } from "../lib/follow.ts";
import { getActorTimeline, type SocialNetwork } from "../lib/timeline.ts";
import { getPageMeta } from "../meta.ts";
import type { State } from "../state.ts";
import { profileLink } from "../utils.ts";

export const handler: RouteHandler = (
  req,
  params,
  ctx: BffContext<State>,
) => {
  const url = new URL(req.url);
  const tab = url.searchParams.get("tab") as ProfileTabs;
  const handle = params.handle;
  const timelineItems = getActorTimeline(handle, ctx);
  const actor = ctx.indexService.getActorByHandle(handle);
  const isHxRequest = req.headers.get("hx-request") !== null;
  const render = isHxRequest ? ctx.html : ctx.render;

  if (!actor) return ctx.next();

  const profile = getActorProfile(actor.did, ctx);

  if (!profile) return ctx.next();

  let followMap: FollowMap = {
    "social.grain.graph.follow": "",
    "app.bsky.graph.follow": "",
    "sh.tangled.graph.follow": "",
  };
  let actorProfiles: SocialNetwork[] = [];
  let userProfiles: SocialNetwork[] = [];

  if (ctx.currentUser) {
    followMap = getFollows(profile.did, ctx.currentUser.did, ctx);
    actorProfiles = getActorProfiles(ctx.currentUser.did, ctx);
  }

  userProfiles = getActorProfiles(handle, ctx);

  ctx.state.meta = [
    {
      title: profile.displayName
        ? `${profile.displayName} (${profile.handle}) — Grain`
        : `${profile.handle} — Grain`,
    },
    ...getPageMeta(profileLink(handle)),
  ];

  ctx.state.scripts = ["photo_manip.js", "profile_dialog.js"];

  if (tab === "favs") {
    const galleryFavs = getActorGalleryFavs(handle, ctx);
    return render(
      <ProfilePage
        userProfiles={userProfiles}
        actorProfiles={actorProfiles}
        followMap={followMap}
        loggedInUserDid={ctx.currentUser?.did}
        timelineItems={timelineItems}
        profile={profile}
        selectedTab={tab}
        galleries={[]}
        galleryFavs={galleryFavs}
      />,
    );
  }
  if (tab === "galleries") {
    const galleries = getActorGalleries(handle, ctx);
    return render(
      <ProfilePage
        userProfiles={userProfiles}
        actorProfiles={actorProfiles}
        followMap={followMap}
        loggedInUserDid={ctx.currentUser?.did}
        timelineItems={timelineItems}
        profile={profile}
        selectedTab={tab}
        galleries={galleries}
      />,
    );
  }
  return ctx.render(
    <ProfilePage
      userProfiles={userProfiles}
      actorProfiles={actorProfiles}
      followMap={followMap}
      loggedInUserDid={ctx.currentUser?.did}
      timelineItems={timelineItems}
      profile={profile}
    />,
  );
};
