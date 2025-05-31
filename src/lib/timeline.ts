import { Record as BskyFollow } from "$lexicon/types/app/bsky/graph/follow.ts";
import { ProfileView } from "$lexicon/types/social/grain/actor/defs.ts";
import { Record as Gallery } from "$lexicon/types/social/grain/gallery.ts";
import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { Un$Typed } from "$lexicon/util.ts";
import { AtUri } from "@atproto/syntax";
import { BffContext, QueryOptions, WithBffMeta } from "@bigmoves/bff";
import { getActorProfile } from "./actor.ts";
import { galleryToView, getGalleryItemsAndPhotos } from "./gallery.ts";

type TimelineItemType = "gallery";

export type TimelineItem = {
  createdAt: string;
  itemType: TimelineItemType;
  itemUri: string;
  actor: Un$Typed<ProfileView>;
  gallery: GalleryView;
};

type TimelineOptions = {
  actorDid?: string;
  followingDids?: Set<string>;
};

function processGalleries(
  ctx: BffContext,
  options?: TimelineOptions,
): TimelineItem[] {
  const items: TimelineItem[] = [];

  let whereClause: QueryOptions["where"] = options?.actorDid
    ? [{ field: "did", equals: options.actorDid }]
    : undefined;

  if (options?.followingDids && options.followingDids.size > 0) {
    whereClause = [
      ...(whereClause ?? []),
      { field: "did", in: Array.from(options.followingDids) },
    ];
  }

  const { items: galleries } = ctx.indexService.getRecords<
    WithBffMeta<Gallery>
  >("social.grain.gallery", {
    orderBy: [{ field: "createdAt", direction: "desc" }],
    where: whereClause,
  });

  if (galleries.length === 0) return items;

  // Get photos for all galleries
  const galleryPhotosMap = getGalleryItemsAndPhotos(ctx, galleries);

  for (const gallery of galleries) {
    const actor = ctx.indexService.getActor(gallery.did);
    if (!actor) continue;
    const profile = getActorProfile(actor.did, ctx);
    if (!profile) continue;

    const galleryUri = `at://${gallery.did}/social.grain.gallery/${
      new AtUri(gallery.uri).rkey
    }`;
    const galleryPhotos = galleryPhotosMap.get(galleryUri) || [];

    const galleryView = galleryToView(gallery, profile, galleryPhotos);
    items.push({
      itemType: "gallery",
      createdAt: gallery.createdAt,
      itemUri: galleryView.uri,
      actor: galleryView.creator,
      gallery: galleryView,
    });
  }

  return items;
}

function getTimelineItems(
  ctx: BffContext,
  options?: TimelineOptions,
): TimelineItem[] {
  const galleryItems = processGalleries(ctx, options);
  return galleryItems.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function getFollowingDids(ctx: BffContext): Set<string> {
  if (!ctx.currentUser?.did) return new Set();
  const { items: follows } = ctx.indexService.getRecords<
    WithBffMeta<BskyFollow>
  >(
    "app.bsky.graph.follow",
    { where: [{ field: "did", equals: ctx.currentUser.did }] },
  );
  return new Set(follows.map((f) => f.subject).filter(Boolean));
}

export function getTimeline(
  ctx: BffContext,
  type: "timeline" | "following" = "timeline",
): TimelineItem[] {
  let followingDids: Set<string> | undefined = undefined;
  if (type === "following") {
    followingDids = getFollowingDids(ctx);
  }
  const galleryItems = processGalleries(ctx, { followingDids });
  return galleryItems.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function getActorTimeline(handleOrDid: string, ctx: BffContext) {
  let did: string;
  if (handleOrDid.includes("did:")) {
    did = handleOrDid;
  } else {
    const actor = ctx.indexService.getActorByHandle(handleOrDid);
    if (!actor) return [];
    did = actor.did;
  }
  return getTimelineItems(ctx, { actorDid: did });
}
