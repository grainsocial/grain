import { Record as BskyFollow } from "$lexicon/types/app/bsky/graph/follow.ts";
import { Record as Profile } from "$lexicon/types/social/grain/actor/profile.ts";
import { Record as Favorite } from "$lexicon/types/social/grain/favorite.ts";
import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { Record as GalleryItem } from "$lexicon/types/social/grain/gallery/item.ts";
import { Record as Photo } from "$lexicon/types/social/grain/photo.ts";
import { isPhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { AtUri } from "@atproto/syntax";
import { BffContext, RouteHandler, WithBffMeta } from "@bigmoves/bff";
import {
  ButtonVariant,
  FavoriteButton,
} from "../components/FavoriteButton.tsx";
import { FollowButton } from "../components/FollowButton.tsx";
import { GalleryEditPhotosDialog } from "../components/GalleryEditPhotosDialog.tsx";
import { GalleryInfo } from "../components/GalleryInfo.tsx";
import { GalleryLayout } from "../components/GalleryLayout.tsx";
import { PhotoPreview } from "../components/PhotoPreview.tsx";
import { PhotoSelectButton } from "../components/PhotoSelectButton.tsx";
import { getActorPhotos } from "../lib/actor.ts";
import {
  createGallery,
  createGalleryItem,
  deleteGallery,
  getGallery,
  getGalleryFav,
  updateGallery,
} from "../lib/gallery.ts";
import { getFollowers } from "../lib/graph.ts";
import {
  createExif,
  createPhoto,
  deletePhoto,
  getPhoto,
} from "../lib/photo.ts";
import type { State } from "../state.ts";
import { galleryLink, profileLink, uploadPageLink } from "../utils.ts";

export const updateSeen: RouteHandler = (
  _req,
  _params,
  ctx: BffContext<State>,
) => {
  ctx.requireAuth();
  ctx.updateSeen(new Date().toISOString());
  return new Response(null, { status: 200 });
};

export const follow: RouteHandler = async (
  _req,
  params,
  ctx: BffContext<State>,
) => {
  ctx.requireAuth();
  const followeeDid = params.followeeDid;
  if (!followeeDid) return ctx.next();
  const followUri = await ctx.createRecord<BskyFollow>(
    "social.grain.graph.follow",
    {
      subject: followeeDid,
      createdAt: new Date().toISOString(),
    },
  );
  const followers = getFollowers(followeeDid, ctx);
  return ctx.html(
    <>
      <div hx-swap-oob="innerHTML:#followers-count">
        {followers.length}
      </div>
      <FollowButton followeeDid={followeeDid} followUri={followUri} />
    </>,
  );
};

export const unfollow: RouteHandler = async (
  _req,
  params,
  ctx: BffContext<State>,
) => {
  const { did } = ctx.requireAuth();
  const followeeDid = params.followeeDid;
  const rkey = params.rkey;
  await ctx.deleteRecord(
    `at://${did}/social.grain.graph.follow/${rkey}`,
  );
  const followers = getFollowers(followeeDid, ctx);
  return ctx.html(
    <>
      <div hx-swap-oob="innerHTML:#followers-count">
        {followers.length}
      </div>
      <FollowButton followeeDid={followeeDid} followUri={undefined} />
    </>,
  );
};

export const galleryCreateEdit: RouteHandler = async (
  req,
  _params,
  ctx: BffContext<State>,
) => {
  const { handle } = ctx.requireAuth();
  const formData = await req.formData();
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const url = new URL(req.url);
  const searchParams = new URLSearchParams(url.search);
  const uri = searchParams.get("uri");

  if (uri) {
    const success = await updateGallery(ctx, uri, {
      title,
      description,
    });
    if (!success) {
      return new Response("Failed to update gallery", { status: 500 });
    }
    const rkey = new AtUri(uri).rkey;
    return ctx.redirect(galleryLink(handle, rkey));
  }

  const galleryUri = await createGallery(ctx, { title, description });
  if (!galleryUri) {
    return new Response("Failed to create gallery", { status: 500 });
  }
  const rkey = new AtUri(galleryUri).rkey;
  return ctx.redirect(galleryLink(handle, rkey));
};

export const galleryDelete: RouteHandler = async (
  req,
  _params,
  ctx: BffContext<State>,
) => {
  const { handle } = ctx.requireAuth();
  const formData = await req.formData();
  const uri = formData.get("uri") as string;
  await deleteGallery(uri, true, ctx);
  return ctx.redirect(profileLink(handle));
};

export const galleryAddPhotos: RouteHandler = async (
  req,
  params,
  ctx: BffContext<State>,
) => {
  const { did } = ctx.requireAuth();
  const galleryRkey = params.rkey;
  const formData = await req.formData();
  const uris = formData.getAll("photoUri") as string[];
  const gallery = getGallery(did, galleryRkey, ctx);
  if (!gallery) return ctx.next();

  const creates = [];
  let position = gallery.items?.length ?? 0;
  for (const uri of uris) {
    creates.push({
      collection: "social.grain.gallery.item",
      data: {
        gallery: gallery.uri,
        item: uri,
        createdAt: new Date().toISOString(),
        position,
      },
    });
    position++;
  }
  await ctx.createRecords<WithBffMeta<GalleryItem>>(creates);

  const updatedGallery = getGallery(did, galleryRkey, ctx);
  if (!updatedGallery) return ctx.next();

  return ctx.html(
    <>
      <GalleryEditPhotosDialog
        galleryUri={gallery.uri}
        photos={updatedGallery?.items
          ?.filter(isPhotoView) ?? []}
      />
      <div hx-swap-oob="beforeend:#gallery-container">
        {updatedGallery.items?.filter(isPhotoView).filter((i) =>
          uris.includes(i.uri)
        ).map((item) => (
          <GalleryLayout.Item
            key={item.uri}
            photo={item}
            gallery={updatedGallery}
          />
        ))}
      </div>
      <div hx-swap-oob="outerHTML:#gallery-info">
        <GalleryInfo gallery={updatedGallery} />
      </div>
    </>,
  );
};

export const galleryAddPhoto: RouteHandler = async (
  req,
  params,
  ctx: BffContext<State>,
) => {
  const { did } = ctx.requireAuth();
  const url = new URL(req.url);
  const page = url.searchParams.get("page") || undefined;
  const galleryRkey = params.galleryRkey;
  const photoRkey = params.photoRkey;
  const galleryUri = `at://${did}/social.grain.gallery/${galleryRkey}`;
  const photoUri = `at://${did}/social.grain.photo/${photoRkey}`;
  const gallery = getGallery(did, galleryRkey, ctx);
  const photo = getPhoto(photoUri, ctx);

  if (!gallery || !photo) return ctx.next();

  if (
    gallery.items
      ?.filter(isPhotoView)
      .some((item) => item.uri === photoUri)
  ) {
    if (page === "upload") {
      return ctx.redirect(uploadPageLink(galleryRkey));
    }
    return new Response(null, { status: 500 });
  }

  await ctx.createRecord<GalleryItem>("social.grain.gallery.item", {
    gallery: galleryUri,
    item: photoUri,
    position: gallery.items?.length ?? 0,
    createdAt: new Date().toISOString(),
  });

  if (page === "upload") {
    return ctx.redirect(uploadPageLink(galleryRkey));
  }

  return ctx.html(
    <>
      <div hx-swap-oob="beforeend:#gallery-container">
        <GalleryLayout.Item
          key={photo.cid}
          photo={photo}
          gallery={gallery}
        />
      </div>
      <div hx-swap-oob="outerHTML:#gallery-info">
        <GalleryInfo gallery={gallery} />
      </div>
      <PhotoSelectButton
        galleryUri={galleryUri}
        photo={photo}
      />
    </>,
  );
};

export const galleryRemovePhoto: RouteHandler = async (
  req,
  params,
  ctx: BffContext<State>,
) => {
  const { did } = ctx.requireAuth();
  const url = new URL(req.url);
  const selectedGallery = url.searchParams.get("selectedGallery");
  const galleryRkey = params.galleryRkey;
  const photoRkey = params.photoRkey;
  const galleryUri = `at://${did}/social.grain.gallery/${galleryRkey}`;
  const photoUri = `at://${did}/social.grain.photo/${photoRkey}`;
  if (!galleryRkey || !photoRkey) return ctx.next();
  const photo = ctx.indexService.getRecord<WithBffMeta<Photo>>(photoUri);
  if (!photo) return ctx.next();
  const {
    items: [item],
  } = ctx.indexService.getRecords<WithBffMeta<GalleryItem>>(
    "social.grain.gallery.item",
    {
      where: [
        {
          field: "gallery",
          equals: galleryUri,
        },
        {
          field: "item",
          equals: photoUri,
        },
      ],
    },
  );
  if (!item) return ctx.next();
  await ctx.deleteRecord(item.uri);
  const gallery = getGallery(did, galleryRkey, ctx);
  if (!gallery) return ctx.next();
  return ctx.html(
    <>
      <div hx-swap-oob="outerHTML:#gallery-info">
        <GalleryInfo gallery={gallery} />
      </div>
      {/* Remove from gallery container or image previews */}
      {selectedGallery
        ? <div hx-swap-oob={`delete:#photo-${photoRkey}`} />
        : null}
    </>,
  );
};

export const photoEdit: RouteHandler = async (
  req,
  params,
  ctx: BffContext<State>,
) => {
  const { did } = ctx.requireAuth();
  const photoRkey = params.rkey;
  const formData = await req.formData();
  const alt = formData.get("alt") as string;
  const photoUri = `at://${did}/social.grain.photo/${photoRkey}`;
  const photo = ctx.indexService.getRecord<WithBffMeta<Photo>>(photoUri);
  if (!photo) return ctx.next();
  await ctx.updateRecord<Photo>("social.grain.photo", photoRkey, {
    photo: photo.photo,
    aspectRatio: photo.aspectRatio,
    alt,
    createdAt: photo.createdAt,
  });
  return new Response(null, { status: 200 });
};

export const photoDelete: RouteHandler = async (
  req,
  params,
  ctx: BffContext<State>,
) => {
  const { did } = ctx.requireAuth();
  const url = new URL(req.url);
  const selectedGallery = url.searchParams.get("selectedGallery");
  const selectedGalleryRkey = selectedGallery
    ? new AtUri(selectedGallery).rkey
    : undefined;
  const photoUri = `at://${did}/social.grain.photo/${params.rkey}`;
  await deletePhoto(photoUri, true, ctx);
  return ctx.redirect(uploadPageLink(selectedGalleryRkey));
};

export const galleryFavorite: RouteHandler = async (
  req,
  params,
  ctx: BffContext<State>,
) => {
  ctx.requireAuth();
  const url = new URL(req.url);
  const variant = url.searchParams.get("variant") as ButtonVariant || "button";
  const creatorDid = params.creatorDid;
  const galleryRkey = params.rkey;
  const galleryUri = `at://${creatorDid}/social.grain.gallery/${galleryRkey}`;
  const did = ctx.currentUser?.did;

  // Check if already favorited
  const existingFav = did ? getGalleryFav(did, galleryUri, ctx) : undefined;
  if (!existingFav) {
    try {
      await ctx.createRecord<WithBffMeta<Favorite>>("social.grain.favorite", {
        subject: galleryUri,
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Error creating favorite record:", e);
    }
  }

  const gallery = getGallery(creatorDid, galleryRkey, ctx);
  if (!gallery) return ctx.next();

  return ctx.html(
    <FavoriteButton gallery={gallery} variant={variant} />,
  );
};

export const galleryUnfavorite: RouteHandler = async (
  req,
  params,
  ctx: BffContext<State>,
) => {
  const { did } = ctx.requireAuth();
  const url = new URL(req.url);
  const variant = url.searchParams.get("variant") as ButtonVariant || "button";
  const creatorDid = params.creatorDid;
  const galleryRkey = params.rkey;
  const favRkey = params.favRkey;
  const favUri = `at://${did}/social.grain.favorite/${favRkey}`;

  try {
    await ctx.deleteRecord(favUri);
  } catch (e) {
    console.error("Error deleting favorite record:", e);
  }

  const gallery = getGallery(creatorDid, galleryRkey, ctx);
  if (!gallery) return ctx.next();

  return ctx.html(
    <FavoriteButton gallery={gallery} variant={variant} />,
  );
};

export const gallerySort: RouteHandler = async (
  req,
  params,
  ctx: BffContext<State>,
) => {
  const { did, handle } = ctx.requireAuth();
  const galleryRkey = params.rkey;
  const galleryUri = `at://${did}/social.grain.gallery/${galleryRkey}`;
  const {
    items,
  } = ctx.indexService.getRecords<WithBffMeta<GalleryItem>>(
    "social.grain.gallery.item",
    {
      where: [
        {
          field: "gallery",
          equals: galleryUri,
        },
      ],
    },
  );
  const itemsMap = new Map<string, WithBffMeta<GalleryItem>>();
  for (const item of items) {
    itemsMap.set(item.item, item);
  }
  const formData = await req.formData();
  const sortedItems = formData.getAll("item") as string[];
  const updates = [];
  let position = 0;
  for (const sortedItemUri of sortedItems) {
    const item = itemsMap.get(sortedItemUri);
    if (!item) continue;
    updates.push({
      collection: "social.grain.gallery.item",
      rkey: new AtUri(item.uri).rkey,
      data: {
        gallery: item.gallery,
        item: item.item,
        createdAt: item.createdAt,
        position,
      },
    });
    position++;
  }
  await ctx.updateRecords<WithBffMeta<GalleryItem>>(updates);
  return ctx.redirect(
    galleryLink(handle, new AtUri(galleryUri).rkey),
  );
};

export const profileUpdate: RouteHandler = async (
  req,
  _params,
  ctx: BffContext<State>,
) => {
  const { did, handle } = ctx.requireAuth();
  const formData = await req.formData();
  const displayName = formData.get("displayName") as string;
  const description = formData.get("description") as string;
  const file = formData.get("file") as File | null;

  const record = ctx.indexService.getRecord<Profile>(
    `at://${did}/social.grain.actor.profile/self`,
  );

  if (!record) {
    return new Response("Profile record not found", { status: 404 });
  }

  if (file) {
    try {
      const blobResponse = await ctx.agent?.uploadBlob(file);
      record.avatar = blobResponse?.data?.blob;
    } catch (e) {
      console.error("Failed to upload avatar:", e);
    }
  }

  try {
    await ctx.updateRecord<Profile>("social.grain.actor.profile", "self", {
      displayName,
      description,
      avatar: record.avatar,
    });
  } catch (e) {
    console.error("Error updating record:", e);
    const errorMessage = e instanceof Error
      ? e.message
      : "Unknown error occurred";
    return new Response(errorMessage, { status: 400 });
  }

  return ctx.redirect(`/profile/${handle}`);
};

export const getBlob: RouteHandler = async (
  req,
  _params,
  ctx: BffContext<State>,
) => {
  const url = new URL(req.url);
  const did = url.searchParams.get("did");
  const cid = url.searchParams.get("cid");
  if (!did || !cid) {
    return new Response("Missing did or cid", { status: 400 });
  }

  const atpData = await ctx.didResolver.resolveAtprotoData(did);
  if (!atpData) {
    return new Response("ATP not found", { status: 404 });
  }

  const blobUrl =
    `${atpData.pds}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${cid}`;

  try {
    const response = await fetch(blobUrl);
    if (!response.ok) {
      return new Response(`Failed to fetch blob: ${response.statusText}`, {
        status: response.status,
      });
    }

    const blobData = await response.arrayBuffer();
    return new Response(blobData, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "max-age=31536000, public",
      },
    });
  } catch (error) {
    console.error("Error fetching blob:", error);
    return new Response("Error fetching blob", { status: 500 });
  }
};

export const uploadPhoto: RouteHandler = async (
  req,
  _params,
  ctx: BffContext<State>,
) => {
  const { did } = ctx.requireAuth();

  ctx.rateLimit({
    namespace: "upload",
    points: 1,
    limit: 50,
    window: 24 * 60 * 60 * 1000, // 24 hours
  });

  if (!ctx.agent) {
    return new Response("Agent has not been initialized", { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const width = Number(formData.get("width")) || undefined;
    const height = Number(formData.get("height")) || undefined;
    const exifJsonString = formData.get("exif") as string;
    const galleryUri = formData.get("galleryUri") as string || undefined;
    const page = formData.get("page") as string || undefined;
    let exif = undefined;

    if (exifJsonString) {
      try {
        exif = JSON.parse(exifJsonString);
      } catch (e) {
        console.error("Failed to parse EXIF data:", e);
      }
    }

    if (!file) {
      return new Response("No file", { status: 400 });
    }

    // Check if file size exceeds 20MB limit
    const maxSizeBytes = 20 * 1000 * 1000; // 20MB in bytes
    if (file.size > maxSizeBytes) {
      return new Response("File too large. Maximum size is 20MB", {
        status: 400,
      });
    }

    const blobResponse = await ctx.agent.uploadBlob(file);

    const photoUri = await createPhoto({
      photo: blobResponse.data.blob,
      aspectRatio: width && height
        ? {
          width,
          height,
        }
        : undefined,
      createdAt: new Date().toISOString(),
    }, ctx);

    if (exif) {
      await createExif(
        {
          photo: photoUri,
          ...exif,
          createdAt: new Date().toISOString(),
        },
        ctx,
      );
    }

    let gallery: GalleryView | undefined = undefined;
    if (galleryUri) {
      gallery = getGallery(did, new AtUri(galleryUri).rkey, ctx) ?? undefined;
      await createGalleryItem(ctx, galleryUri, photoUri);
    }

    const photo = getPhoto(photoUri, ctx);
    if (!photo) return ctx.next();

    if (page === "gallery" && gallery && galleryUri) {
      const rkey = new AtUri(gallery.uri).rkey;
      // updated gallery post gallery item creation
      const updatedGallery = getGallery(did, rkey, ctx);
      if (!updatedGallery) {
        return ctx.next();
      }
      return ctx.html(
        <>
          <PhotoSelectButton
            galleryUri={gallery.uri}
            photo={photo}
          />
          <div hx-swap-oob="beforeend:#gallery-container">
            <GalleryLayout.Item
              key={photo.cid}
              photo={photo}
              gallery={updatedGallery}
            />
          </div>
          <div hx-swap-oob="outerHTML:#gallery-info">
            <GalleryInfo gallery={updatedGallery} />
          </div>
        </>,
      );
    }

    // @TODO: Use count queries
    let photosCount = 0;
    if (gallery && galleryUri) {
      const rkey = new AtUri(gallery.uri).rkey;
      const updatedGallery = getGallery(did, rkey, ctx);
      photosCount = updatedGallery?.items?.length ?? 0;
    } else {
      const photos = getActorPhotos(did, ctx);
      photosCount = photos.length;
    }

    return ctx.html(
      <>
        <PhotoPreview
          photo={photo}
          selectedGallery={gallery}
        />
        <div hx-swap-oob="photos-count">{photosCount}</div>
      </>,
    );
  } catch (e) {
    console.error("Error in uploadPhoto:", e);
    return new Response("Internal Server Error", { status: 500 });
  }
};
