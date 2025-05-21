import { Record as BskyFollow } from "$lexicon/types/app/bsky/graph/follow.ts";
import { Record as Profile } from "$lexicon/types/social/grain/actor/profile.ts";
import { Record as Favorite } from "$lexicon/types/social/grain/favorite.ts";
import { Record as Gallery } from "$lexicon/types/social/grain/gallery.ts";
import { Record as GalleryItem } from "$lexicon/types/social/grain/gallery/item.ts";
import { Record as Photo } from "$lexicon/types/social/grain/photo.ts";
import { isPhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { AtUri } from "@atproto/syntax";
import { BffContext, RouteHandler, WithBffMeta } from "@bigmoves/bff";
import { FavoriteButton } from "../components/FavoriteButton.tsx";
import { FollowButton } from "../components/FollowButton.tsx";
import { PhotoButton } from "../components/PhotoButton.tsx";
import { PhotoSelectButton } from "../components/PhotoSelectButton.tsx";
import { deleteGallery, getGallery, getGalleryFavs } from "../gallery.ts";
import { photoToView } from "../photo.ts";
import type { State } from "../state.ts";
import { galleryLink } from "../utils.ts";

export const updateSeen: RouteHandler = (
  _req,
  _params,
  ctx: BffContext<State>,
) => {
  ctx.requireAuth();
  ctx.updateSeen();
  return new Response(null, { status: 200 });
};

export const follow: RouteHandler = async (
  _req,
  params,
  ctx: BffContext<State>,
) => {
  ctx.requireAuth();
  const did = params.did;
  if (!did) return ctx.next();
  const followUri = await ctx.createRecord<BskyFollow>(
    "app.bsky.graph.follow",
    {
      subject: did,
      createdAt: new Date().toISOString(),
    },
  );
  return ctx.html(<FollowButton followeeDid={did} followUri={followUri} />);
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
    `at://${did}/app.bsky.graph.follow/${rkey}`,
  );
  return ctx.html(
    <FollowButton followeeDid={followeeDid} followUri={undefined} />,
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
    const gallery = ctx.indexService.getRecord<WithBffMeta<Gallery>>(uri);
    if (!gallery) return ctx.next();
    const rkey = new AtUri(uri).rkey;
    try {
      await ctx.updateRecord<Gallery>("social.grain.gallery", rkey, {
        title,
        description,
        createdAt: gallery.createdAt,
      });
    } catch (e) {
      console.error("Error updating record:", e);
      const errorMessage = e instanceof Error
        ? e.message
        : "Unknown error occurred";
      return new Response(errorMessage, { status: 400 });
    }
    return ctx.redirect(galleryLink(handle, rkey));
  }

  const createdUri = await ctx.createRecord<Gallery>(
    "social.grain.gallery",
    {
      title,
      description,
      createdAt: new Date().toISOString(),
    },
  );
  return ctx.redirect(galleryLink(handle, new AtUri(createdUri).rkey));
};

export const galleryDelete: RouteHandler = async (
  req,
  _params,
  ctx: BffContext<State>,
) => {
  ctx.requireAuth();
  const formData = await req.formData();
  const uri = formData.get("uri") as string;
  await deleteGallery(uri, ctx);
  return ctx.redirect("/");
};

export const galleryAddPhoto: RouteHandler = async (
  _req,
  params,
  ctx: BffContext<State>,
) => {
  const { did } = ctx.requireAuth();
  const galleryRkey = params.galleryRkey;
  const photoRkey = params.photoRkey;
  const galleryUri = `at://${did}/social.grain.gallery/${galleryRkey}`;
  const photoUri = `at://${did}/social.grain.photo/${photoRkey}`;
  const gallery = getGallery(did, galleryRkey, ctx);
  const photo = ctx.indexService.getRecord<WithBffMeta<Photo>>(photoUri);
  if (!gallery || !photo) return ctx.next();
  if (
    gallery.items
      ?.filter(isPhotoView)
      .some((item) => item.uri === photoUri)
  ) {
    return new Response(null, { status: 500 });
  }
  await ctx.createRecord<Gallery>("social.grain.gallery.item", {
    gallery: galleryUri,
    item: photoUri,
    position: gallery.items?.length ?? 0,
    createdAt: new Date().toISOString(),
  });
  gallery.items = [
    ...(gallery.items ?? []),
    photoToView(photo.did, photo),
  ];
  return ctx.html(
    <>
      <div hx-swap-oob="beforeend:#masonry-container">
        <PhotoButton
          key={photo.cid}
          photo={photoToView(photo.did, photo)}
          gallery={gallery}
        />
      </div>
      <PhotoSelectButton
        galleryUri={galleryUri}
        itemUris={gallery.items?.filter(isPhotoView).map((item) => item.uri) ??
          []}
        photo={photoToView(photo.did, photo)}
      />
    </>,
  );
};

export const galleryRemovePhoto: RouteHandler = async (
  _req,
  params,
  ctx: BffContext<State>,
) => {
  const { did } = ctx.requireAuth();
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
    <PhotoSelectButton
      galleryUri={galleryUri}
      itemUris={gallery.items?.filter(isPhotoView).map((item) => item.uri) ??
        []}
      photo={photoToView(photo.did, photo)}
    />,
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
  _req,
  params,
  ctx: BffContext<State>,
) => {
  const { did } = ctx.requireAuth();
  await ctx.deleteRecord(
    `at://${did}/social.grain.photo/${params.rkey}`,
  );
  const { items } = ctx.indexService.getRecords<WithBffMeta<GalleryItem>>(
    "social.grain.gallery.item",
    {
      where: [
        {
          field: "item",
          equals: `at://${did}/social.grain.photo/${params.rkey}`,
        },
      ],
    },
  );
  for (const item of items) {
    await ctx.deleteRecord(item.uri);
  }
  return new Response(null, { status: 200 });
};

export const galleryFavorite: RouteHandler = async (
  req,
  _params,
  ctx: BffContext<State>,
) => {
  const { did } = ctx.requireAuth();
  const url = new URL(req.url);
  const searchParams = new URLSearchParams(url.search);
  const galleryUri = searchParams.get("galleryUri");
  const favUri = searchParams.get("favUri") ?? undefined;
  if (!galleryUri) return ctx.next();
  if (favUri) {
    await ctx.deleteRecord(favUri);
    const favs = getGalleryFavs(galleryUri, ctx);
    return ctx.html(
      <FavoriteButton
        currentUserDid={did}
        favs={favs}
        galleryUri={galleryUri}
      />,
    );
  }
  await ctx.createRecord<WithBffMeta<Favorite>>("social.grain.favorite", {
    subject: galleryUri,
    createdAt: new Date().toISOString(),
  });
  const favs = getGalleryFavs(galleryUri, ctx);
  return ctx.html(
    <FavoriteButton
      currentUserDid={did}
      galleryUri={galleryUri}
      favs={favs}
    />,
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

  const record = ctx.indexService.getRecord<Profile>(
    `at://${did}/social.grain.actor.profile/self`,
  );

  if (!record) {
    return new Response("Profile record not found", { status: 404 });
  }

  try {
    await ctx.updateRecord<Profile>("social.grain.actor.profile", "self", {
      displayName,
      description,
      avatar: record.avatar,
    });
  } catch (e) {
    console.error("Error updating record:", e);
  }

  return ctx.redirect(`/profile/${handle}`);
};
