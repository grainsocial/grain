import { Record as BskyProfile } from "$lexicon/types/app/bsky/actor/profile.ts";
import { Label } from "$lexicon/types/com/atproto/label/defs.ts";
import { Record as TangledProfile } from "$lexicon/types/sh/tangled/actor/profile.ts";
import {
  ProfileView,
  ProfileViewDetailed,
  ViewerState,
} from "$lexicon/types/social/grain/actor/defs.ts";
import { Record as GrainProfile } from "$lexicon/types/social/grain/actor/profile.ts";
import { Record as Favorite } from "$lexicon/types/social/grain/favorite.ts";
import { Record as Gallery } from "$lexicon/types/social/grain/gallery.ts";
import { Record as Photo } from "$lexicon/types/social/grain/photo.ts";
import { isPhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { Record as PhotoExif } from "$lexicon/types/social/grain/photo/exif.ts";
import { Un$Typed } from "$lexicon/util.ts";
import { BffContext, WithBffMeta } from "@bigmoves/bff";
import { getFollow, getFollowersCount, getFollowsCount } from "./follow.ts";
import {
  galleryToView,
  getGalleryCameras,
  getGalleryItemsAndPhotos,
} from "./gallery.ts";
import { photoToView, photoUrl } from "./photo.ts";
import type { SocialNetwork } from "./timeline.ts";

export function getActorProfile(did: string, ctx: BffContext) {
  const actor = ctx.indexService.getActor(did);
  if (!actor) return null;
  const profileRecord = ctx.indexService.getRecord<WithBffMeta<GrainProfile>>(
    `at://${did}/social.grain.actor.profile/self`,
  );
  return profileRecord ? profileToView(profileRecord, actor.handle) : null;
}

export function getActorProfileDetailed(did: string, ctx: BffContext) {
  const actor = ctx.indexService.getActor(did);
  if (!actor) return null;
  const profileRecord = ctx.indexService.getRecord<WithBffMeta<GrainProfile>>(
    `at://${did}/social.grain.actor.profile/self`,
  );
  const followersCount = getFollowersCount(did, ctx);
  const followsCount = getFollowsCount(did, ctx);
  const galleries = getActorGalleries(did, ctx);
  const cameras = Array.from(
    new Set(
      galleries.flatMap((g) =>
        getGalleryCameras(g.items?.filter(isPhotoView) ?? [])
      ),
    ),
  ).sort((a, b) => a.localeCompare(b));

  let followedBy: string | undefined = "";
  let following: string | undefined = "";
  if (ctx.currentUser) {
    followedBy = getFollow(ctx.currentUser.did, did, ctx)?.uri;
    following = getFollow(did, ctx.currentUser.did, ctx)?.uri;
  }

  return profileRecord
    ? profileDetailedToView({
      record: profileRecord,
      handle: actor.handle,
      cameras,
      followersCount,
      followsCount,
      galleryCount: galleries.length,
      viewer: {
        followedBy,
        following,
      },
    })
    : null;
}

export function profileToView(
  record: WithBffMeta<GrainProfile>,
  handle: string,
): Un$Typed<ProfileView> {
  return {
    cid: record.cid,
    did: record.did,
    handle,
    displayName: record.displayName,
    description: record.description,
    avatar: record?.avatar
      ? photoUrl(record.did, record.avatar.ref.toString(), "thumbnail")
      : undefined,
  };
}

export function profileDetailedToView(params: {
  record: WithBffMeta<GrainProfile>;
  handle: string;
  followersCount: number;
  followsCount: number;
  galleryCount: number;
  viewer: ViewerState;
  cameras?: string[];
}): Un$Typed<ProfileViewDetailed> {
  const {
    record,
    handle,
    followersCount,
    followsCount,
    galleryCount,
    viewer,
    cameras,
  } = params;
  return {
    cid: record.cid,
    did: record.did,
    handle,
    displayName: record.displayName,
    description: record.description,
    avatar: record?.avatar
      ? photoUrl(record.did, record.avatar.ref.toString(), "thumbnail")
      : undefined,
    followersCount,
    followsCount,
    galleryCount,
    viewer,
    cameras,
  };
}

export function getActorPhotos(handleOrDid: string, ctx: BffContext) {
  let did: string;

  if (handleOrDid.includes("did:")) {
    did = handleOrDid;
  } else {
    const actor = ctx.indexService.getActorByHandle(handleOrDid);
    if (!actor) return [];
    did = actor.did;
  }

  const photos = ctx.indexService.getRecords<WithBffMeta<Photo>>(
    "social.grain.photo",
    {
      where: [{ field: "did", equals: did }],
      orderBy: [{ field: "createdAt", direction: "desc" }],
    },
  );
  const exif = ctx.indexService.getRecords<WithBffMeta<PhotoExif>>(
    "social.grain.photo.exif",
    {
      where: [{ field: "photo", in: photos.items.map((p) => p.uri) }],
    },
  );
  const exifMap = new Map<string, WithBffMeta<PhotoExif>>();
  exif.items.forEach((e) => {
    exifMap.set(e.photo, e);
  });
  return photos.items.map((photo) => {
    const exifData = exifMap.get(photo.uri);
    return photoToView(photo.did, photo, exifData);
  });
}

export function getActorGalleries(handleOrDid: string, ctx: BffContext) {
  let did: string;

  if (handleOrDid.includes("did:")) {
    did = handleOrDid;
  } else {
    const actor = ctx.indexService.getActorByHandle(handleOrDid);
    if (!actor) return [];
    did = actor.did;
  }

  const { items: galleries } = ctx.indexService.getRecords<
    WithBffMeta<Gallery>
  >("social.grain.gallery", {
    where: [{ field: "did", equals: did }],
    orderBy: [{ field: "createdAt", direction: "desc" }],
  });

  const galleryPhotosMap = getGalleryItemsAndPhotos(ctx, galleries);
  const creator = getActorProfile(did, ctx);
  const labelMap = new Map<string, Label[]>();
  for (const gallery of galleries) {
    const labels = ctx.indexService.queryLabels({ subjects: [gallery.uri] });
    labelMap.set(gallery.uri, labels);
  }

  if (!creator) return [];

  return galleries.map((gallery) =>
    galleryToView({
      record: gallery,
      creator,
      items: galleryPhotosMap.get(gallery.uri) ?? [],
      labels: labelMap.get(gallery.uri) ?? [],
    })
  );
}

export function getActorGalleryFavs(handleOrDid: string, ctx: BffContext) {
  let did: string;

  if (handleOrDid.includes("did:")) {
    did = handleOrDid;
  } else {
    const actor = ctx.indexService.getActorByHandle(handleOrDid);
    if (!actor) return [];
    did = actor.did;
  }

  const { items: favRecords } = ctx.indexService.getRecords<
    WithBffMeta<Favorite>
  >(
    "social.grain.favorite",
    {
      where: [{ field: "did", equals: did }],
      orderBy: [{ field: "createdAt", direction: "desc" }],
    },
  );

  if (!favRecords.length) return [];

  const galleryUris = favRecords.map((fav) => fav.subject);

  const { items: galleries } = ctx.indexService.getRecords<
    WithBffMeta<Gallery>
  >(
    "social.grain.gallery",
    {
      where: [{ field: "uri", in: galleryUris }],
    },
  );

  // Map gallery uri to gallery object for fast lookup
  const galleryMap = new Map(galleries.map((g) => [g.uri, g]));
  const galleryPhotosMap = getGalleryItemsAndPhotos(ctx, galleries);
  const creators = new Map<string, ReturnType<typeof getActorProfile>>();
  const uniqueDids = Array.from(
    new Set(galleries.map((gallery) => gallery.did)),
  );

  const labelMap = new Map<string, Label[]>();
  for (const gallery of galleries) {
    const labels = ctx.indexService.queryLabels({ subjects: [gallery.uri] });
    labelMap.set(gallery.uri, labels);
  }

  const { items: profiles } = ctx.indexService.getRecords<
    WithBffMeta<GrainProfile>
  >(
    "social.grain.actor.profile",
    {
      where: [{ field: "did", in: uniqueDids }],
    },
  );

  for (const profile of profiles) {
    const handle = ctx.indexService.getActor(profile.did)?.handle ?? "";
    creators.set(profile.did, profileToView(profile, handle));
  }

  // Order galleries by the order of favRecords (favorited at)
  return favRecords
    .map((fav) => {
      const gallery = galleryMap.get(fav.subject);
      if (!gallery) return null;
      const creator = creators.get(gallery.did);
      if (!creator) return null;
      return galleryToView({
        record: gallery,
        creator,
        items: galleryPhotosMap.get(gallery.uri) ?? [],
        labels: labelMap.get(gallery.uri) ?? [],
      });
    })
    .filter((g) => g !== null);
}

export function getActorProfiles(
  handleOrDid: string,
  ctx: BffContext,
): SocialNetwork[] {
  let did: string;

  if (handleOrDid.includes("did:")) {
    did = handleOrDid;
  } else {
    const actor = ctx.indexService.getActorByHandle(handleOrDid);
    if (!actor) return [];
    did = actor.did;
  }

  const { items: grainProfiles } = ctx.indexService.getRecords<
    WithBffMeta<GrainProfile>
  >(
    "social.grain.actor.profile",
    {
      where: {
        AND: [
          { field: "did", equals: did },
          { field: "uri", contains: "self" },
        ],
      },
    },
  );

  const { items: tangledProfiles } = ctx.indexService.getRecords<
    WithBffMeta<TangledProfile>
  >(
    "sh.tangled.actor.profile",
    {
      where: {
        AND: [
          { field: "did", equals: did },
          { field: "uri", contains: "self" },
        ],
      },
    },
  );

  const { items: bskyProfiles } = ctx.indexService.getRecords<
    WithBffMeta<BskyProfile>
  >(
    "app.bsky.actor.profile",
    {
      where: {
        AND: [
          { field: "did", equals: did },
          { field: "uri", contains: "self" },
        ],
      },
    },
  );

  const profiles: SocialNetwork[] = [];
  if (grainProfiles.length) profiles.push("grain");
  if (bskyProfiles.length) profiles.push("bluesky");
  if (tangledProfiles.length) profiles.push("tangled");
  return profiles;
}

export function getActorProfilesBulk(
  dids: string[],
  ctx: BffContext,
) {
  const { items: profiles } = ctx.indexService.getRecords<
    WithBffMeta<GrainProfile>
  >(
    "social.grain.actor.profile",
    {
      where: {
        AND: [
          { field: "did", in: dids },
        ],
      },
    },
  );

  return profiles.map((profile) => {
    const handle = ctx.indexService.getActor(profile.did)?.handle ?? "";
    return profileToView(profile, handle);
  });
}

export function searchActors(query: string, ctx: BffContext) {
  const actors = ctx.indexService.searchActors(query);

  const { items } = ctx.indexService.getRecords<WithBffMeta<GrainProfile>>(
    "social.grain.actor.profile",
    {
      where: {
        OR: [
          ...(actors.length > 0
            ? [{
              field: "did",
              in: actors.map((actor) => actor.did),
            }]
            : []),
          {
            field: "displayName",
            contains: query,
          },
          {
            field: "did",
            contains: query,
          },
        ],
      },
    },
  );

  const profileMap = new Map<string, WithBffMeta<GrainProfile>>();
  for (const item of items) {
    profileMap.set(item.did, item);
  }

  const actorMap = new Map();
  actors.forEach((actor) => {
    actorMap.set(actor.did, actor);
  });

  const profileViews = [];

  for (const actor of actors) {
    if (profileMap.has(actor.did)) {
      const profile = profileMap.get(actor.did)!;
      profileViews.push(profileToView(profile, actor.handle));
    }
  }

  for (const profile of items) {
    if (!actorMap.has(profile.did)) {
      const handle = ctx.indexService.getActor(profile.did)?.handle;
      if (!handle) continue;
      profileViews.push(profileToView(profile, handle));
    }
  }

  return profileViews;
}
