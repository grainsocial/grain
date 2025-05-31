import { Record as BskyFollow } from "$lexicon/types/app/bsky/graph/follow.ts";
import { BffContext, RouteHandler, WithBffMeta } from "@bigmoves/bff";
import { ProfilePage, ProfileTabs } from "../components/ProfilePage.tsx";
import {
  getActorGalleries,
  getActorGalleryFavs,
  getActorProfile,
} from "../lib/actor.ts";
import { getFollow } from "../lib/follow.ts";
import { getActorTimeline } from "../lib/timeline.ts";
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

  let follow: WithBffMeta<BskyFollow> | undefined;

  if (ctx.currentUser) {
    follow = getFollow(profile.did, ctx.currentUser.did, ctx);
  }

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
        followUri={follow?.uri}
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
        followUri={follow?.uri}
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
      followUri={follow?.uri}
      loggedInUserDid={ctx.currentUser?.did}
      timelineItems={timelineItems}
      profile={profile}
    />,
  );
};
