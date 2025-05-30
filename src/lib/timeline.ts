import { Record as BskyFollow } from "$lexicon/types/app/bsky/graph/follow.ts";
import { ProfileView } from "$lexicon/types/social/grain/actor/defs.ts";
import { Record as Favorite } from "$lexicon/types/social/grain/favorite.ts";
import { Record as Gallery } from "$lexicon/types/social/grain/gallery.ts";
import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { Un$Typed } from "$lexicon/util.ts";
import { AtUri } from "@atproto/syntax";
import { BffContext, QueryOptions, WithBffMeta } from "@bigmoves/bff";
import { getActorProfile } from "./actor.ts";
import { galleryToView, getGalleryItemsAndPhotos } from "./gallery.ts";

type TimelineItemType = "gallery" | "favorite";

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

function processFavs(
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

  const { items: favs } = ctx.indexService.getRecords<WithBffMeta<Favorite>>(
    "social.grain.favorite",
    {
      orderBy: [{ field: "createdAt", direction: "desc" }],
      where: whereClause,
    },
  );

  if (favs.length === 0) return items;

  // Collect all gallery references from favorites
  const galleryRefs = new Map<string, WithBffMeta<Gallery>>();

  for (const favorite of favs) {
    if (!favorite.subject) continue;

    try {
      const atUri = new AtUri(favorite.subject);
      const galleryDid = atUri.hostname;
      const galleryRkey = atUri.rkey;
      const galleryUri =
        `at://${galleryDid}/social.grain.gallery/${galleryRkey}`;

      const gallery = ctx.indexService.getRecord<WithBffMeta<Gallery>>(
        galleryUri,
      );
      if (gallery) {
        galleryRefs.set(galleryUri, gallery);
      }
    } catch (e) {
      console.error("Error processing favorite:", e);
    }
  }

  const galleries = Array.from(galleryRefs.values());
  const galleryPhotosMap = getGalleryItemsAndPhotos(ctx, galleries);

  for (const favorite of favs) {
    if (!favorite.subject) continue;

    try {
      const atUri = new AtUri(favorite.subject);
      const galleryDid = atUri.hostname;
      const galleryRkey = atUri.rkey;
      const galleryUri =
        `at://${galleryDid}/social.grain.gallery/${galleryRkey}`;

      const gallery = galleryRefs.get(galleryUri);
      if (!gallery) continue;

      const galleryActor = ctx.indexService.getActor(galleryDid);
      if (!galleryActor) continue;
      const galleryProfile = getActorProfile(galleryActor.did, ctx);
      if (!galleryProfile) continue;

      const favActor = ctx.indexService.getActor(favorite.did);
      if (!favActor) continue;
      const favProfile = getActorProfile(favActor.did, ctx);
      if (!favProfile) continue;

      const galleryPhotos = galleryPhotosMap.get(galleryUri) || [];
      const galleryView = galleryToView(gallery, galleryProfile, galleryPhotos);

      items.push({
        itemType: "favorite",
        createdAt: favorite.createdAt,
        itemUri: favorite.uri,
        actor: favProfile,
        gallery: galleryView,
      });
    } catch (e) {
      console.error("Error processing favorite:", e);
      continue;
    }
  }

  return items;
}

function getTimelineItems(
  ctx: BffContext,
  options?: TimelineOptions,
): TimelineItem[] {
  const galleryItems = processGalleries(ctx, options);
  const favsItems = processFavs(ctx, options);
  const timelineItems = [...galleryItems, ...favsItems];

  return timelineItems.sort(
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
  const favsItems = processFavs(
    ctx,
    followingDids ? { followingDids } : undefined,
  );
  const timelineItems = [...galleryItems, ...favsItems];
  return timelineItems.sort(
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
