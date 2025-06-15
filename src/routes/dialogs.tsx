import { Record as Profile } from "$lexicon/types/social/grain/actor/profile.ts";
import { Record as Gallery } from "$lexicon/types/social/grain/gallery.ts";
import { Record as Photo } from "$lexicon/types/social/grain/photo.ts";
import { isPhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { AtUri } from "@atproto/syntax";
import { BffContext, RouteHandler, WithBffMeta } from "@bigmoves/bff";
import { wrap } from "popmotion";
import { AddPhotosDialog } from "../components/AddPhotosDialog.tsx";
import { AvatarDialog } from "../components/AvatarDialog.tsx";
import { CreateAccountDialog } from "../components/CreateAccountDialog.tsx";
import { ExifInfoDialog } from "../components/ExifInfoDialog.tsx";
import { ExifOverlayDialog } from "../components/ExifOverlayDialog.tsx";
import { GalleryCreateEditDialog } from "../components/GalleryCreateEditDialog.tsx";
import {
  GallerySelectDialog,
  GallerySelectDialogSearchResults,
} from "../components/GallerySelectDialog.tsx";
import { GallerySortDialog } from "../components/GallerySortDialog.tsx";
import { LabelDefinitionDialog } from "../components/LabelDefinitionDialog.tsx";
import { PhotoAltDialog } from "../components/PhotoAltDialog.tsx";
import { PhotoDialog } from "../components/PhotoDialog.tsx";
import { PhotoExifDialog } from "../components/PhotoExifDialog.tsx";
import { PhotoSelectDialog } from "../components/PhotoSelectDialog.tsx";
import { ProfileDialog } from "../components/ProfileDialog.tsx";
import { RemovePhotoDialog } from "../components/RemovePhotoDialog.tsx";
import {
  getActorGalleries,
  getActorPhotos,
  getActorProfile,
} from "../lib/actor.ts";
import {
  getGallery,
  getGalleryItemsAndPhotos,
  queryGalleriesByName,
} from "../lib/gallery.ts";
import { atprotoLabelValueDefinitions } from "../lib/moderation.ts";
import { getPhoto, photoToView } from "../lib/photo.ts";
import type { State } from "../state.ts";

export const createGallery: RouteHandler = (
  _req,
  _params,
  ctx: BffContext<State>,
) => {
  ctx.requireAuth();
  return ctx.html(<GalleryCreateEditDialog />);
};

export const editGallery: RouteHandler = (
  _req,
  params,
  ctx: BffContext<State>,
) => {
  const { handle } = ctx.requireAuth();
  const rkey = params.rkey;
  const gallery = getGallery(handle, rkey, ctx);
  return ctx.html(<GalleryCreateEditDialog gallery={gallery} />);
};

export const sortGallery: RouteHandler = (
  _req,
  params,
  ctx: BffContext<State>,
) => {
  const { handle } = ctx.requireAuth();
  const rkey = params.rkey;
  const gallery = getGallery(handle, rkey, ctx);
  if (!gallery) return ctx.next();
  return ctx.html(<GallerySortDialog gallery={gallery} />);
};

export const editProfile: RouteHandler = (
  _req,
  _params,
  ctx: BffContext<State>,
) => {
  const { did } = ctx.requireAuth();
  if (!ctx.state.profile) return ctx.next();
  const profileRecord = ctx.indexService.getRecord<Profile>(
    `at://${did}/social.grain.actor.profile/self`,
  );
  if (!profileRecord) return ctx.next();
  return ctx.html(
    <ProfileDialog
      profile={ctx.state.profile}
    />,
  );
};

export const avatar: RouteHandler = (
  _req,
  params,
  ctx: BffContext<State>,
) => {
  const handle = params.handle;
  const actor = ctx.indexService.getActorByHandle(handle);
  if (!actor) return ctx.next();
  const profile = getActorProfile(actor.did, ctx);
  if (!profile) return ctx.next();
  return ctx.html(<AvatarDialog profile={profile} />);
};

export const image: RouteHandler = (
  req,
  _params,
  ctx: BffContext<State>,
) => {
  const url = new URL(req.url);
  const galleryUri = url.searchParams.get("galleryUri");
  const imageCid = url.searchParams.get("imageCid");
  if (!galleryUri || !imageCid) return ctx.next();
  const atUri = new AtUri(galleryUri);
  const galleryDid = atUri.hostname;
  const galleryRkey = atUri.rkey;
  const gallery = getGallery(galleryDid, galleryRkey, ctx);
  if (!gallery?.items) return ctx.next();
  const image = gallery.items.filter(isPhotoView).find((item) => {
    return item.cid === imageCid;
  });
  const imageAtIndex = gallery.items
    .filter(isPhotoView)
    .findIndex((image) => {
      return image.cid === imageCid;
    });
  const next = wrap(0, gallery.items.length, imageAtIndex + 1);
  const prev = wrap(0, gallery.items.length, imageAtIndex - 1);
  if (!image) return ctx.next();
  return ctx.html(
    <PhotoDialog
      gallery={gallery}
      image={image}
      nextImage={gallery.items.filter(isPhotoView).at(next)}
      prevImage={gallery.items.filter(isPhotoView).at(prev)}
    />,
  );
};

export const photoAlt: RouteHandler = (
  _req,
  params,
  ctx: BffContext<State>,
) => {
  const { did } = ctx.requireAuth();
  const photoRkey = params.rkey;
  const photoUri = `at://${did}/social.grain.photo/${photoRkey}`;
  const photo = ctx.indexService.getRecord<WithBffMeta<Photo>>(photoUri);
  if (!photo) return ctx.next();
  return ctx.html(
    <PhotoAltDialog photo={photoToView(did, photo)} />,
  );
};

export const photoExif: RouteHandler = (
  _req,
  params,
  ctx: BffContext<State>,
) => {
  const { did } = ctx.requireAuth();
  const photoRkey = params.rkey;
  const photoUri = `at://${did}/social.grain.photo/${photoRkey}`;
  const photo = getPhoto(photoUri, ctx);
  if (!photo) return ctx.next();
  return ctx.html(
    <PhotoExifDialog photo={photo} />,
  );
};

export const photoExifOverlay: RouteHandler = (
  _req,
  params,
  ctx: BffContext<State>,
) => {
  const did = params.did;
  const rkey = params.rkey;
  const photoUri = `at://${did}/social.grain.photo/${rkey}`;
  const photo = getPhoto(photoUri, ctx);
  if (!photo) return ctx.next();
  return ctx.html(
    <ExifOverlayDialog photo={photo} />,
  );
};

export const galleryPhotoSelect: RouteHandler = (
  _req,
  params,
  ctx: BffContext<State>,
) => {
  const { did } = ctx.requireAuth();
  const photos = getActorPhotos(did, ctx);
  const galleryUri = `at://${did}/social.grain.gallery/${params.galleryRkey}`;
  const gallery = ctx.indexService.getRecord<WithBffMeta<Gallery>>(
    galleryUri,
  );
  if (!gallery) return ctx.next();
  const galleryPhotosMap = getGalleryItemsAndPhotos(ctx, [gallery]);
  const itemUris =
    galleryPhotosMap.get(galleryUri)?.map((photo) => photo.uri) ?? [];
  return ctx.html(
    <PhotoSelectDialog
      galleryUri={galleryUri}
      itemUris={itemUris}
      photos={photos}
    />,
  );
};

export const createAccount: RouteHandler = (
  _req,
  _params,
  ctx: BffContext<State>,
) => {
  return ctx.html(<CreateAccountDialog />);
};

export const labelValueDefinition: RouteHandler = async (
  _req,
  params,
  ctx: BffContext<State>,
) => {
  const src = params.src;
  const val = params.val;
  const labelerDeinitionsMap = await ctx.getLabelerDefinitions();
  if (!labelerDeinitionsMap) return ctx.next();
  const labelValueDefinitions = labelerDeinitionsMap[src]
    ?.labelValueDefinitions;
  if (!labelValueDefinitions) return ctx.next();

  let valDef = labelValueDefinitions.find((def) => def.identifier === val);
  if (!valDef && typeof val === "string") {
    valDef = atprotoLabelValueDefinitions[val];
  }

  if (!valDef) return ctx.next();
  const labelerAtpData = await ctx.didResolver.resolveAtprotoData(src);
  return ctx.html(
    <LabelDefinitionDialog
      labelByHandle={labelerAtpData?.handle}
      labelValueDefinition={valDef}
    />,
  );
};

export const exifInfo: RouteHandler = (
  _req,
  _params,
  ctx: BffContext<State>,
) => {
  return ctx.html(
    <ExifInfoDialog />,
  );
};

export const gallerySelect: RouteHandler = (
  req,
  _params,
  ctx: BffContext<State>,
) => {
  const { did } = ctx.requireAuth();
  const url = new URL(req.url);
  const photoUri = url.searchParams.get("photoUri") as string || undefined;
  const galleries = getActorGalleries(did, ctx);
  const query = url.searchParams.get("q");

  if (query) {
    const galleries = queryGalleriesByName(did, query, ctx);
    return ctx.html(
      <GallerySelectDialogSearchResults galleries={galleries} />,
    );
  }

  if (query === "") {
    // no-op keep the original dialog open
    return ctx.html(<GallerySelectDialogSearchResults galleries={galleries} />);
  }

  return ctx.html(
    <GallerySelectDialog
      photoUri={photoUri}
      userDid={did}
      galleries={galleries ?? []}
    />,
  );
};

export const photoRemove: RouteHandler = (
  req,
  _params,
  ctx: BffContext<State>,
) => {
  return ctx.html(<RemovePhotoDialog />);
};

export const addPhotos: RouteHandler = (
  req,
  _params,
  ctx: BffContext<State>,
) => {
  return ctx.html(<AddPhotosDialog />);
};
