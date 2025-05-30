import { Record as BskyFollow } from "$lexicon/types/app/bsky/graph/follow.ts";
import { BffContext, WithBffMeta } from "@bigmoves/bff";

export function getFollow(
  followeeDid: string,
  followerDid: string,
  ctx: BffContext,
) {
  const {
    items: [follow],
  } = ctx.indexService.getRecords<WithBffMeta<BskyFollow>>(
    "app.bsky.graph.follow",
    {
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
    },
  );
  return follow;
}
