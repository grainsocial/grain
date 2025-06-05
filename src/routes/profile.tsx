import { BffContext, RouteHandler } from "@bigmoves/bff";
import { ProfilePage, ProfileTabs } from "../components/ProfilePage.tsx";
import {
  getActorGalleries,
  getActorGalleryFavs,
  getActorProfile,
  getActorProfiles,
} from "../lib/actor.ts";
import { getFollow, getFollowers, getFollowing } from "../lib/follow.ts";
import { type SocialNetwork } from "../lib/timeline.ts";
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
  const actor = ctx.indexService.getActorByHandle(handle);
  const isHxRequest = req.headers.get("hx-request") !== null;
  const render = isHxRequest ? ctx.html : ctx.render;

  if (!actor) return ctx.next();

  const profile = getActorProfile(actor.did, ctx);
  const galleries = getActorGalleries(handle, ctx);
  const followers = getFollowers(actor.did, ctx);
  const following = getFollowing(actor.did, ctx);

  if (!profile) return ctx.next();

  let followUri: string | undefined;
  let actorProfiles: SocialNetwork[] = [];
  let userProfiles: SocialNetwork[] = [];

  if (ctx.currentUser) {
    followUri = getFollow(profile.did, ctx.currentUser.did, ctx)?.uri;
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
        followersCount={followers.length}
        followingCount={following.length}
        userProfiles={userProfiles}
        actorProfiles={actorProfiles}
        followUri={followUri}
        loggedInUserDid={ctx.currentUser?.did}
        profile={profile}
        selectedTab="favs"
        galleries={galleries}
        galleryFavs={galleryFavs}
      />,
    );
  }
  return render(
    <ProfilePage
      followersCount={followers.length}
      followingCount={following.length}
      userProfiles={userProfiles}
      actorProfiles={actorProfiles}
      followUri={followUri}
      loggedInUserDid={ctx.currentUser?.did}
      profile={profile}
      selectedTab="galleries"
      galleries={galleries}
    />,
  );
};
