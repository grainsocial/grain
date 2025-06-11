import { Record as BskyProfile } from "$lexicon/types/app/bsky/actor/profile.ts";
import { Label } from "$lexicon/types/com/atproto/label/defs.ts";
import { Record as TangledProfile } from "$lexicon/types/sh/tangled/actor/profile.ts";
import { ProfileView } from "$lexicon/types/social/grain/actor/defs.ts";
import { Record as GrainProfile } from "$lexicon/types/social/grain/actor/profile.ts";
import { Record as Favorite } from "$lexicon/types/social/grain/favorite.ts";
import { Record as Gallery } from "$lexicon/types/social/grain/gallery.ts";
import { Record as Photo } from "$lexicon/types/social/grain/photo.ts";
import { Record as PhotoExif } from "$lexicon/types/social/grain/photo/exif.ts";
import { Un$Typed } from "$lexicon/util.ts";
import { BffContext, WithBffMeta } from "@bigmoves/bff";
import { galleryToView, getGalleryItemsAndPhotos } from "./gallery.ts";
import { photoToView } from "./photo.ts";
import type { SocialNetwork } from "./timeline.ts";

export function getActorProfile(did: string, ctx: BffContext) {
  const actor = ctx.indexService.getActor(did);
  if (!actor) return null;
  const profileRecord = ctx.indexService.getRecord<WithBffMeta<GrainProfile>>(
    `at://${did}/social.grain.actor.profile/self`,
  );
  return profileRecord ? profileToView(profileRecord, actor.handle) : null;
}

export function profileToView(
  record: WithBffMeta<GrainProfile>,
  handle: string,
): Un$Typed<ProfileView> {
  return {
    did: record.did,
    handle,
    displayName: record.displayName,
    description: record.description,
    avatar: record?.avatar
      ? `https://cdn.bsky.app/img/feed_thumbnail/plain/${record.did}/${record.avatar.ref.toString()}`
      : undefined,
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
    galleryToView(
      gallery,
      creator,
      galleryPhotosMap.get(gallery.uri) ?? [],
      labelMap.get(gallery.uri) ?? [],
    )
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
      return galleryToView(
        gallery,
        creator,
        galleryPhotosMap.get(gallery.uri) ?? [],
        labelMap.get(gallery.uri) ?? [],
      );
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
