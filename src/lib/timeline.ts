import { Record as BskyFollow } from "$lexicon/types/app/bsky/graph/follow.ts";
import { Record as TangledFollow } from "$lexicon/types/sh/tangled/graph/follow.ts";
import { ProfileView } from "$lexicon/types/social/grain/actor/defs.ts";
import { Record as Gallery } from "$lexicon/types/social/grain/gallery.ts";
import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { Record as GrainFollow } from "$lexicon/types/social/grain/graph/follow.ts";
import { Un$Typed } from "$lexicon/util.ts";
import { AtUri } from "@atproto/syntax";
import { BffContext, QueryOptions, WithBffMeta } from "@bigmoves/bff";
import { getGalleryCommentsCount } from "../modules/comments.tsx";
import { getActorProfile } from "./actor.ts";
import {
  galleryToView,
  getGalleryFav,
  getGalleryFavs,
  getGalleryItemsAndPhotos,
} from "./gallery.ts";
import { moderateGallery, ModerationDecsion } from "./moderation.ts";

export type TimelineItemType = "gallery";

export type SocialNetwork = "bluesky" | "grain" | "tangled";

export type TimelineItem = {
  createdAt: string;
  itemType: TimelineItemType;
  itemUri: string;
  actor: Un$Typed<ProfileView>;
  gallery: GalleryView;
  modDecision?: ModerationDecsion;
};

type TimelineOptions = {
  actorDid?: string;
  followingDids?: Set<string>;
};

async function processGalleries(
  ctx: BffContext,
  options?: TimelineOptions,
): Promise<TimelineItem[]> {
  const items: TimelineItem[] = [];

  let whereClause: QueryOptions["where"] = options?.actorDid
    ? [{ field: "did", equals: options.actorDid }]
    : undefined;

  if (options?.followingDids) {
    if (options.followingDids.size > 0) {
      whereClause = [
        ...(whereClause ?? []),
        { field: "did", in: Array.from(options.followingDids) },
      ];
    } else {
      return [];
    }
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
    const labels = ctx.indexService.queryLabels({
      subjects: [gallery.uri],
    });

    const favs = getGalleryFavs(gallery.uri, ctx);

    let viewerFav: string | undefined = undefined;
    if (ctx.currentUser?.did) {
      const fav = getGalleryFav(ctx.currentUser?.did, gallery.uri, ctx);
      if (fav) {
        viewerFav = fav.uri;
      }
    }

    const comments = getGalleryCommentsCount(gallery.uri, ctx);

    const galleryView = galleryToView({
      record: gallery,
      creator: profile,
      items: galleryPhotos,
      labels,
      favCount: favs,
      commentCount: comments,
      viewerState: {
        fav: viewerFav,
      },
    });

    let modDecision: ModerationDecsion | undefined = undefined;
    if (galleryView.labels?.length) {
      modDecision = await moderateGallery(labels, ctx);
    }

    items.push({
      itemType: "gallery",
      createdAt: gallery.createdAt,
      itemUri: galleryView.uri,
      actor: galleryView.creator,
      gallery: galleryView,
      modDecision,
    });
  }

  return items;
}

async function getTimelineItems(
  ctx: BffContext,
  options?: TimelineOptions,
): Promise<TimelineItem[]> {
  const galleryItems = await processGalleries(ctx, options);
  return galleryItems.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function getFollowingDids(type: SocialNetwork, ctx: BffContext): Set<string> {
  if (!ctx.currentUser?.did) return new Set();
  const typeToCollection: Record<SocialNetwork, string> = {
    bluesky: "app.bsky.graph.follow",
    grain: "social.grain.graph.follow",
    tangled: "sh.tangled.graph.follow",
  };
  const collection = typeToCollection[type];
  if (!collection) {
    throw new Error(`Unsupported social graph type: ${type}`);
  }
  const { items: follows } = ctx.indexService.getRecords<
    WithBffMeta<BskyFollow | GrainFollow | TangledFollow>
  >(
    collection,
    { where: [{ field: "did", equals: ctx.currentUser.did }] },
  );
  return new Set(follows.map((f) => f.subject).filter(Boolean));
}

export async function getTimeline(
  ctx: BffContext,
  type: "timeline" | "following",
  graph: SocialNetwork,
): Promise<TimelineItem[]> {
  let followingDids: Set<string> | undefined = undefined;
  if (type === "following") {
    followingDids = getFollowingDids(graph, ctx);
  }
  const galleryItems = await processGalleries(ctx, { followingDids });
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
