import { RichText } from "@atproto/api";
import {
  ActorTable,
  BffContext,
  LabelerPolicies,
  RouteHandler,
} from "@bigmoves/bff";
import { ProfilePage, ProfileTabs } from "../components/ProfilePage.tsx";
import {
  getActorGalleries,
  getActorGalleryFavs,
  getActorProfile,
  getActorProfiles,
} from "../lib/actor.ts";
import { getFollow, getFollowers, getFollowing } from "../lib/follow.ts";
import {
  isLabeler as isLabelerFn,
  moderateGallery,
  ModerationDecsion,
} from "../lib/moderation.ts";
import { parseFacetedText } from "../lib/rich_text.ts";
import { type SocialNetwork } from "../lib/timeline.ts";
import { getPageMeta } from "../meta.ts";
import type { State } from "../state.ts";
import { profileLink } from "../utils.ts";

export const handler: RouteHandler = async (
  req,
  params,
  ctx: BffContext<State>,
) => {
  const url = new URL(req.url);
  const tab = url.searchParams.get("tab") as ProfileTabs;
  const handleOrDid = params.handleOrDid;

  let actor: ActorTable | undefined;
  if (handleOrDid.includes("did:")) {
    actor = ctx.indexService.getActor(handleOrDid);
  } else {
    actor = ctx.indexService.getActorByHandle(handleOrDid);
  }

  if (!actor) return ctx.next();

  const isHxRequest = req.headers.get("hx-request") !== null;
  const render = isHxRequest ? ctx.html : ctx.render;

  const profile = getActorProfile(actor.did, ctx);
  const galleries = getActorGalleries(actor.did, ctx);
  const followers = getFollowers(actor.did, ctx);
  const following = getFollowing(actor.did, ctx);

  let descriptionFacets: RichText["facets"] = undefined;
  if (profile?.description) {
    const resp = parseFacetedText(profile?.description, ctx);
    descriptionFacets = resp.facets;
  }

  let labelerDefinitions: LabelerPolicies | undefined = undefined;
  const isLabeler = await isLabelerFn(actor.did, ctx);
  if (isLabeler) {
    const labelerDefs = await ctx.getLabelerDefinitions();
    labelerDefinitions = labelerDefs[actor.did] ?? [];
  }

  const galleryModDecisionsMap = new Map<string, ModerationDecsion>();
  for (const gallery of galleries) {
    if (!gallery.labels || gallery.labels.length === 0) {
      continue;
    }
    const modDecision = await moderateGallery(
      gallery.labels ?? [],
      ctx,
    );
    if (!modDecision) {
      continue;
    }
    galleryModDecisionsMap.set(gallery.uri, modDecision);
  }

  if (!profile) return ctx.next();

  let followUri: string | undefined;
  let actorProfiles: SocialNetwork[] = [];
  let userProfiles: SocialNetwork[] = [];

  if (ctx.currentUser) {
    followUri = getFollow(profile.did, ctx.currentUser.did, ctx)?.uri;
    actorProfiles = getActorProfiles(ctx.currentUser.did, ctx);
  }

  userProfiles = getActorProfiles(actor.did, ctx);

  ctx.state.meta = [
    {
      title: profile.displayName
        ? `${profile.displayName} (${profile.handle}) — Grain`
        : `${profile.handle} — Grain`,
    },
    ...getPageMeta(profileLink(actor.did)),
  ];

  if (tab === "favs") {
    const galleryFavs = getActorGalleryFavs(actor.did, ctx);
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
        galleryModDecisionsMap={galleryModDecisionsMap}
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
      descriptionFacets={descriptionFacets}
      selectedTab={isLabeler ? "labels" : "galleries"}
      galleries={galleries}
      galleryModDecisionsMap={galleryModDecisionsMap}
      isLabeler={isLabeler}
      labelerDefinitions={labelerDefinitions}
    />,
  );
};
