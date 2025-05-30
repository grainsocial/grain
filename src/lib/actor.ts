import { ProfileView } from "$lexicon/types/social/grain/actor/defs.ts";
import { Record as Profile } from "$lexicon/types/social/grain/actor/profile.ts";
import { Record as Gallery } from "$lexicon/types/social/grain/gallery.ts";
import { Record as Photo } from "$lexicon/types/social/grain/photo.ts";
import { Un$Typed } from "$lexicon/util.ts";
import { BffContext, WithBffMeta } from "@bigmoves/bff";
import { galleryToView, getGalleryItemsAndPhotos } from "./gallery.ts";
import { photoToView } from "./photo.ts";

export function getActorProfile(did: string, ctx: BffContext) {
  const actor = ctx.indexService.getActor(did);
  if (!actor) return null;
  const profileRecord = ctx.indexService.getRecord<WithBffMeta<Profile>>(
    `at://${did}/social.grain.actor.profile/self`,
  );
  return profileRecord ? profileToView(profileRecord, actor.handle) : null;
}

export function profileToView(
  record: WithBffMeta<Profile>,
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
  return photos.items.map((photo) => photoToView(photo.did, photo));
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
  if (!creator) return [];
  return galleries.map((gallery) =>
    galleryToView(gallery, creator, galleryPhotosMap.get(gallery.uri) ?? [])
  );
}
