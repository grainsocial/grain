import { Record as BskyFollow } from "$lexicon/types/app/bsky/graph/follow.ts";
import { Record as TangledFollow } from "$lexicon/types/sh/tangled/graph/follow.ts";
import { Record as GrainFollow } from "$lexicon/types/social/grain/graph/follow.ts";
import { BffContext, WithBffMeta } from "@bigmoves/bff";

export type FollowSource =
  | "app.bsky.graph.follow"
  | "sh.tangled.graph.follow"
  | "social.grain.graph.follow";

export type FollowMap = Record<FollowSource, string>;

export function getFollows(
  followeeDid: string,
  followerDid: string,
  ctx: BffContext,
): FollowMap {
  const sources: FollowSource[] = [
    "app.bsky.graph.follow",
    "sh.tangled.graph.follow",
    "social.grain.graph.follow",
  ];

  const result: FollowMap = {} as FollowMap;

  for (const source of sources) {
    const {
      items: [follow],
    } = ctx.indexService.getRecords<
      WithBffMeta<BskyFollow | GrainFollow | TangledFollow>
    >(source, {
      where: [
        {
          field: "did",
          equals: followerDid,
        },
        {
          field: "subject",
          equals: followeeDid,
        },
      ],
    });
    if (follow && "uri" in follow) {
      result[source] = follow.uri;
    }
  }
  return result;
}
