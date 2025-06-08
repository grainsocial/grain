import { Record as GrainFollow } from "$lexicon/types/social/grain/graph/follow.ts";
import { BffContext, WithBffMeta } from "@bigmoves/bff";
import { getActorProfile } from "./actor.ts";

export function getFollow(
  followeeDid: string,
  followerDid: string,
  ctx: BffContext,
) {
  const {
    items: [follow],
  } = ctx.indexService.getRecords<
    WithBffMeta<GrainFollow>
  >(
    "social.grain.graph.follow",
    {
      where: {
        AND: [{
          field: "did",
          equals: followerDid,
        }, {
          field: "subject",
          equals: followeeDid,
        }],
      },
    },
  );

  return follow;
}

export function getFollowers(
  followeeDid: string,
  ctx: BffContext,
): WithBffMeta<GrainFollow>[] {
  const { items: followers } = ctx.indexService.getRecords<
    WithBffMeta<GrainFollow>
  >(
    "social.grain.graph.follow",
    {
      orderBy: [{ field: "createdAt", direction: "desc" }],
      where: [{
        field: "subject",
        equals: followeeDid,
      }],
    },
  );
  return followers;
}

export function getFollowing(
  followerDid: string,
  ctx: BffContext,
): WithBffMeta<GrainFollow>[] {
  const { items: following } = ctx.indexService.getRecords<
    WithBffMeta<GrainFollow>
  >(
    "social.grain.graph.follow",
    {
      orderBy: [{ field: "createdAt", direction: "desc" }],
      where: [{
        field: "did",
        equals: followerDid,
      }],
    },
  );
  return following;
}

export function getFollowersWithProfiles(
  followeeDid: string,
  ctx: BffContext,
) {
  const followers = getFollowers(followeeDid, ctx);
  return followers
    .map((follow) => getActorProfile(follow.did, ctx))
    .filter((profile): profile is NonNullable<typeof profile> =>
      profile != null
    );
}

export function getFollowingWithProfiles(
  followerDid: string,
  ctx: BffContext,
) {
  const following = getFollowing(followerDid, ctx);
  return following
    .map((follow) => getActorProfile(follow.subject, ctx))
    .filter((profile): profile is NonNullable<typeof profile> =>
      profile != null
    );
}
