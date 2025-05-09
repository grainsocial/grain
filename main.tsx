import { lexicons } from "$lexicon/lexicons.ts";
import { Record as BskyProfile } from "$lexicon/types/app/bsky/actor/profile.ts";
import { Record as BskyFollow } from "$lexicon/types/app/bsky/graph/follow.ts";
import { ProfileView } from "$lexicon/types/social/grain/actor/defs.ts";
import { Record as Profile } from "$lexicon/types/social/grain/actor/profile.ts";
import { Record as Favorite } from "$lexicon/types/social/grain/favorite.ts";
import { Record as Gallery } from "$lexicon/types/social/grain/gallery.ts";
import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { Record as GalleryItem } from "$lexicon/types/social/grain/gallery/item.ts";
import {
  isRecord as isPhoto,
  Record as Photo,
} from "$lexicon/types/social/grain/photo.ts";
import {
  isPhotoView,
  PhotoView,
} from "$lexicon/types/social/grain/photo/defs.ts";
import { $Typed, Un$Typed } from "$lexicon/util.ts";
import { AtUri } from "@atproto/syntax";
import {
  bff,
  BffContext,
  BffMiddleware,
  CSS,
  JETSTREAM,
  oauth,
  OAUTH_ROUTES,
  onSignedInArgs,
  requireAuth,
  RootProps,
  route,
  RouteHandler,
  UnauthorizedError,
  WithBffMeta,
} from "@bigmoves/bff";
import {
  Button,
  cn,
  Dialog,
  Input,
  Layout,
  Login,
  Meta,
  type MetaDescriptor,
  Textarea,
} from "@bigmoves/bff/components";
import { createCanvas, Image } from "@gfx/canvas";
import { join } from "@std/path";
import { formatDistanceStrict } from "date-fns";
import { wrap } from "popmotion";
import { ComponentChildren, JSX, VNode } from "preact";

const PUBLIC_URL = Deno.env.get("BFF_PUBLIC_URL") ?? "http://localhost:8080";
const GOATCOUNTER_URL = Deno.env.get("GOATCOUNTER_URL");

let cssContentHash: string = "";

bff({
  appName: "Grain Social",
  collections: [
    "social.grain.gallery",
    "social.grain.actor.profile",
    "social.grain.photo",
    "social.grain.favorite",
    "social.grain.gallery.item",
  ],
  jetstreamUrl: JETSTREAM.WEST_1,
  lexicons,
  rootElement: Root,
  onListen: async () => {
    const cssFileContent = await Deno.readFile(
      join(Deno.cwd(), "static", "styles.css"),
    );
    const hashBuffer = await crypto.subtle.digest("SHA-256", cssFileContent);
    cssContentHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  },
  onError: (err) => {
    if (err instanceof UnauthorizedError) {
      const ctx = err.ctx;
      return ctx.redirect(OAUTH_ROUTES.loginPage);
    }
    return new Response("Internal Server Error", {
      status: 500,
    });
  },
  middlewares: [
    (_req, ctx) => {
      if (ctx.currentUser) {
        const profile = getActorProfile(ctx.currentUser.did, ctx);
        if (profile) {
          ctx.state.profile = profile;
          return ctx.next();
        }
      }
      return ctx.next();
    },
    oauth({
      onSignedIn,
      LoginComponent: ({ error }) => (
        <div
          id="login"
          class="flex justify-center items-center w-full h-full relative"
          style="background-image: url('https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:bcgltzqazw5tb6k2g3ttenbj/bafkreiewhwu3ro5dv7omedphb62db4koa7qtvyzfhiiypg3ru4tvuxkrjy@webp'); background-size: cover; background-position: center;"
        >
          <Login hx-target="#login" error={error} errorClass="text-white" />
          <div class="absolute bottom-2 right-2 text-white text-sm">
            Photo by{" "}
            <a
              href={profileLink("chadtmiller.com")}
              class="hover:underline font-semibold"
            >
              @chadtmiller.com
            </a>
          </div>
        </div>
      ),
    }),
    route("/", (_req, _params, ctx) => {
      const items = getTimeline(ctx);
      ctx.state.meta = [{ title: "Timeline — Grain" }, getPageMeta("")];
      return ctx.render(<Timeline items={items} />);
    }),
    route("/profile/:handle", (req, params, ctx) => {
      const url = new URL(req.url);
      const tab = url.searchParams.get("tab");
      const handle = params.handle;
      const timelineItems = getActorTimeline(handle, ctx);
      const galleries = getActorGalleries(handle, ctx);
      const actor = ctx.indexService.getActorByHandle(handle);
      if (!actor) return ctx.next();
      const profile = getActorProfile(actor.did, ctx);
      if (!profile) return ctx.next();
      let follow: WithBffMeta<BskyFollow> | undefined;
      if (ctx.currentUser) {
        follow = getFollow(
          profile.did,
          ctx.currentUser.did,
          ctx,
        );
      }
      ctx.state.meta = [
        {
          title: profile.displayName
            ? `${profile.displayName} (${profile.handle}) — Grain`
            : `${profile.handle} — Grain`,
        },
        getPageMeta(profileLink(handle)),
      ];
      if (tab) {
        return ctx.html(
          <ProfilePage
            followUri={follow?.uri}
            loggedInUserDid={ctx.currentUser?.did}
            timelineItems={timelineItems}
            profile={profile}
            selectedTab={tab}
            galleries={galleries}
          />,
        );
      }
      return ctx.render(
        <ProfilePage
          followUri={follow?.uri}
          loggedInUserDid={ctx.currentUser?.did}
          timelineItems={timelineItems}
          profile={profile}
        />,
      );
    }),
    route("/profile/:handle/:rkey", (_req, params, ctx: BffContext<State>) => {
      const did = ctx.currentUser?.did;
      let favs: WithBffMeta<Favorite>[] = [];
      const handle = params.handle;
      const rkey = params.rkey;
      const gallery = getGallery(handle, rkey, ctx);
      if (!gallery) return ctx.next();
      favs = getGalleryFavs(gallery.uri, ctx);
      ctx.state.meta = [
        { title: `${(gallery.record as Gallery).title} — Grain` },
        ...getPageMeta(galleryLink(handle, rkey)),
        ...getGalleryMeta(gallery),
      ];
      ctx.state.scripts = ["photo_dialog.js", "masonry.js", "sortable.js"];
      return ctx.render(
        <GalleryPage favs={favs} gallery={gallery} currentUserDid={did} />,
      );
    }),
    route("/upload", (req, _params, ctx) => {
      requireAuth(ctx);
      const url = new URL(req.url);
      const galleryRkey = url.searchParams.get("returnTo");
      const photos = getActorPhotos(ctx.currentUser.did, ctx);
      ctx.state.meta = [{ title: "Upload — Grain" }, getPageMeta("/upload")];
      return ctx.render(
        <UploadPage
          handle={ctx.currentUser.handle}
          photos={photos}
          returnTo={galleryRkey
            ? galleryLink(ctx.currentUser.handle, galleryRkey)
            : undefined}
        />,
      );
    }),
    route("/follow/:did", ["POST"], async (_req, params, ctx) => {
      requireAuth(ctx);
      const did = params.did;
      if (!did) return ctx.next();
      const followUri = await ctx.createRecord<BskyFollow>(
        "app.bsky.graph.follow",
        {
          subject: did,
          createdAt: new Date().toISOString(),
        },
      );
      return ctx.html(
        <FollowButton followeeDid={did} followUri={followUri} />,
      );
    }),
    route("/follow/:did/:rkey", ["DELETE"], async (_req, params, ctx) => {
      requireAuth(ctx);
      const did = params.did;
      const rkey = params.rkey;
      if (!did) return ctx.next();
      await ctx.deleteRecord(
        `at://${ctx.currentUser.did}/app.bsky.graph.follow/${rkey}`,
      );
      return ctx.html(
        <FollowButton followeeDid={did} followUri={undefined} />,
      );
    }),
    route("/dialogs/gallery/new", (_req, _params, ctx) => {
      requireAuth(ctx);
      return ctx.html(<GalleryCreateEditDialog />);
    }),
    route("/dialogs/gallery/:rkey", (_req, params, ctx) => {
      requireAuth(ctx);
      const handle = ctx.currentUser.handle;
      const rkey = params.rkey;
      const gallery = getGallery(handle, rkey, ctx);
      return ctx.html(<GalleryCreateEditDialog gallery={gallery} />);
    }),
    route("/onboard", (_req, _params, ctx) => {
      requireAuth(ctx);
      return ctx.render(
        <div
          hx-get="/dialogs/profile"
          hx-trigger="load"
          hx-target="body"
          hx-swap="afterbegin"
        />,
      );
    }),
    route("/dialogs/profile", (_req, _params, ctx: BffContext<State>) => {
      requireAuth(ctx);

      if (!ctx.state.profile) return ctx.next();

      const profileRecord = ctx.indexService.getRecord<Profile>(
        `at://${ctx.currentUser.did}/social.grain.actor.profile/self`,
      );

      if (!profileRecord) return ctx.next();

      return ctx.html(
        <ProfileDialog
          profile={ctx.state.profile}
          avatarCid={profileRecord.avatar?.ref.toString()}
        />,
      );
    }),
    route("/dialogs/avatar/:handle", (_req, params, ctx) => {
      const handle = params.handle;
      const actor = ctx.indexService.getActorByHandle(handle);
      if (!actor) return ctx.next();
      const profile = getActorProfile(actor.did, ctx);
      if (!profile) return ctx.next();
      return ctx.html(<AvatarDialog profile={profile} />);
    }),
    route("/dialogs/image", (req, _params, ctx) => {
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
    }),
    route("/dialogs/image-alt", (req, _params, ctx) => {
      const url = new URL(req.url);
      const galleryUri = url.searchParams.get("galleryUri");
      const imageCid = url.searchParams.get("imageCid");
      if (!galleryUri || !imageCid) return ctx.next();
      const atUri = new AtUri(galleryUri);
      const galleryDid = atUri.hostname;
      const galleryRkey = atUri.rkey;
      const gallery = getGallery(galleryDid, galleryRkey, ctx);
      const photo = gallery?.items?.filter(isPhotoView).find((photo) => {
        return photo.cid === imageCid;
      });
      if (!photo || !gallery) return ctx.next();
      return ctx.html(
        <PhotoAltDialog galleryUri={gallery.uri} photo={photo} />,
      );
    }),
    route("/dialogs/photo-select/:galleryRkey", (_req, params, ctx) => {
      requireAuth(ctx);
      const photos = getActorPhotos(ctx.currentUser.did, ctx);
      const galleryUri =
        `at://${ctx.currentUser.did}/social.grain.gallery/${params.galleryRkey}`;
      const gallery = ctx.indexService.getRecord<WithBffMeta<Gallery>>(
        galleryUri,
      );
      if (!gallery) return ctx.next();
      const galleryPhotosMap = getGalleryItemsAndPhotos(ctx, [gallery]);
      const itemUris = galleryPhotosMap.get(galleryUri)?.map((photo) =>
        photo.uri
      ) ?? [];
      return ctx.html(
        <PhotoSelectDialog
          galleryUri={galleryUri}
          itemUris={itemUris}
          photos={photos}
        />,
      );
    }),
    route("/actions/create-edit", ["POST"], async (req, _params, ctx) => {
      requireAuth(ctx);
      const formData = await req.formData();
      const title = formData.get("title") as string;
      const description = formData.get("description") as string;
      const url = new URL(req.url);
      const searchParams = new URLSearchParams(url.search);
      const uri = searchParams.get("uri");
      const handle = ctx.currentUser?.handle;

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
    }),
    route("/actions/gallery/delete", ["POST"], async (req, _params, ctx) => {
      requireAuth(ctx);
      const formData = await req.formData();
      const uri = formData.get("uri") as string;
      await deleteGallery(uri, ctx);
      return ctx.redirect("/");
    }),
    route(
      "/actions/gallery/:galleryRkey/add-photo/:photoRkey",
      ["PUT"],
      async (_req, params, ctx) => {
        requireAuth(ctx);
        const galleryRkey = params.galleryRkey;
        const photoRkey = params.photoRkey;
        const galleryUri =
          `at://${ctx.currentUser.did}/social.grain.gallery/${galleryRkey}`;
        const photoUri =
          `at://${ctx.currentUser.did}/social.grain.photo/${photoRkey}`;
        const gallery = getGallery(ctx.currentUser.did, galleryRkey, ctx);
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
                isCreator={ctx.currentUser.did === gallery.creator.did}
                isLoggedIn={!!ctx.currentUser.did}
              />
            </div>
            <PhotoSelectButton
              galleryUri={galleryUri}
              itemUris={gallery.items?.filter(isPhotoView).map((item) =>
                item.uri
              ) ?? []}
              photo={photoToView(photo.did, photo)}
            />
          </>,
        );
      },
    ),
    route(
      "/actions/gallery/:galleryRkey/remove-photo/:photoRkey",
      ["PUT"],
      async (_req, params, ctx) => {
        requireAuth(ctx);
        const galleryRkey = params.galleryRkey;
        const photoRkey = params.photoRkey;
        const galleryUri =
          `at://${ctx.currentUser.did}/social.grain.gallery/${galleryRkey}`;
        const photoUri =
          `at://${ctx.currentUser.did}/social.grain.photo/${photoRkey}`;
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
        const gallery = getGallery(ctx.currentUser.did, galleryRkey, ctx);
        if (!gallery) return ctx.next();
        return ctx.html(
          <PhotoSelectButton
            galleryUri={galleryUri}
            itemUris={gallery.items?.filter(isPhotoView).map((item) =>
              item.uri
            ) ?? []}
            photo={photoToView(photo.did, photo)}
          />,
        );
      },
    ),
    route("/actions/photo/:rkey", ["PUT"], async (req, params, ctx) => {
      requireAuth(ctx);
      const photoRkey = params.rkey;
      const formData = await req.formData();
      const alt = formData.get("alt") as string;
      const photoUri =
        `at://${ctx.currentUser.did}/social.grain.photo/${photoRkey}`;
      const photo = ctx.indexService.getRecord<WithBffMeta<Photo>>(photoUri);
      if (!photo) return ctx.next();
      await ctx.updateRecord<Photo>("social.grain.photo", photoRkey, {
        photo: photo.photo,
        aspectRatio: photo.aspectRatio,
        alt,
        createdAt: photo.createdAt,
      });
      return new Response(null, { status: 200 });
    }),
    route("/actions/favorite", ["POST"], async (req, _params, ctx) => {
      requireAuth(ctx);
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
            currentUserDid={ctx.currentUser.did}
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
          currentUserDid={ctx.currentUser.did}
          galleryUri={galleryUri}
          favs={favs}
        />,
      );
    }),
    route("/actions/profile/update", ["POST"], async (req, _params, ctx) => {
      requireAuth(ctx);
      const formData = await req.formData();
      const displayName = formData.get("displayName") as string;
      const description = formData.get("description") as string;
      const avatarCid = formData.get("avatarCid") as string;

      const record = ctx.indexService.getRecord<Profile>(
        `at://${ctx.currentUser.did}/social.grain.actor.profile/self`,
      );

      if (!record) {
        return new Response("Profile record not found", { status: 404 });
      }

      await ctx.updateRecord<Profile>("social.grain.actor.profile", "self", {
        displayName,
        description,
        avatar: ctx.blobMetaCache.get(avatarCid)?.blobRef ?? record.avatar,
      });

      return ctx.redirect(`/profile/${ctx.currentUser.handle}`);
    }),
    route("/actions/photo/:rkey", ["DELETE"], (_req, params, ctx) => {
      requireAuth(ctx);
      ctx.deleteRecord(
        `at://${ctx.currentUser.did}/social.grain.photo/${params.rkey}`,
      );
      return new Response(null, { status: 200 });
    }),
    route("/actions/sort-end", ["POST"], async (req, _params, ctx) => {
      const formData = await req.formData();
      const items = formData.getAll("item") as string[];
      console.log(items);
      return new Response(null, { status: 200 });
    }),
    ...photoUploadRoutes(),
    ...avatarUploadRoutes(),
  ],
});

type State = {
  profile?: ProfileView;
  scripts?: string[];
  meta?: MetaDescriptor[];
};

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

function createImageFromDataURL(dataURL: string): Promise<Image> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = dataURL;
  });
}

async function compressImageForPreview(file: File): Promise<string> {
  const maxWidth = 500,
    maxHeight = 500,
    format = "jpeg";

  // Create an image from the file
  const dataUrl = await readFileAsDataURL(file);
  const img = await createImageFromDataURL(dataUrl);

  // Create a canvas with reduced dimensions
  const canvas = createCanvas(img.width, img.height);
  let width = img.width;
  let height = img.height;

  // Calculate new dimensions while maintaining aspect ratio
  if (width > height) {
    if (width > maxWidth) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    }
  } else {
    if (height > maxHeight) {
      width = Math.round((width * maxHeight) / height);
      height = maxHeight;
    }
  }

  canvas.width = width;
  canvas.height = height;

  // Draw and compress the image
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }
  ctx.drawImage(img, 0, 0, width, height);

  // Convert to compressed image data URL
  return canvas.toDataURL(format);
}

type TimelineItemType = "gallery" | "favorite";

type TimelineItem = {
  createdAt: string;
  itemType: TimelineItemType;
  itemUri: string;
  actor: Un$Typed<ProfileView>;
  gallery: GalleryView;
};

type TimelineOptions = {
  actorDid?: string;
};

function getFollow(followeeDid: string, followerDid: string, ctx: BffContext) {
  const { items: [follow] } = ctx.indexService.getRecords<
    WithBffMeta<BskyFollow>
  >(
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

function getGalleryItemsAndPhotos(
  ctx: BffContext,
  galleries: WithBffMeta<Gallery>[],
): Map<string, WithBffMeta<Photo>[]> {
  const galleryUris = galleries.map(
    (gallery) =>
      `at://${gallery.did}/social.grain.gallery/${new AtUri(gallery.uri).rkey}`,
  );

  if (galleryUris.length === 0) return new Map();

  const { items: galleryItems } = ctx.indexService.getRecords<
    WithBffMeta<GalleryItem>
  >("social.grain.gallery.item", {
    orderBy: { field: "createdAt", direction: "asc" },
    where: [{ field: "gallery", in: galleryUris }],
  });

  const photoUris = galleryItems.map((item) => item.item).filter(Boolean);
  if (photoUris.length === 0) return new Map();

  const { items: photos } = ctx.indexService.getRecords<WithBffMeta<Photo>>(
    "social.grain.photo",
    {
      where: [{ field: "uri", in: photoUris }],
    },
  );

  const photosMap = new Map<string, WithBffMeta<Photo>>();
  for (const photo of photos) {
    photosMap.set(photo.uri, photo);
  }

  const galleryPhotosMap = new Map<string, WithBffMeta<Photo>[]>();
  for (const item of galleryItems) {
    const galleryUri = item.gallery;
    const photo = photosMap.get(item.item);

    if (!galleryPhotosMap.has(galleryUri)) {
      galleryPhotosMap.set(galleryUri, []);
    }

    if (photo) {
      galleryPhotosMap.get(galleryUri)?.push(photo);
    }
  }

  return galleryPhotosMap;
}

function processGalleries(
  ctx: BffContext,
  options?: TimelineOptions,
): TimelineItem[] {
  const items: TimelineItem[] = [];

  const whereClause = options?.actorDid
    ? [{ field: "did", equals: options.actorDid }]
    : undefined;

  const { items: galleries } = ctx.indexService.getRecords<
    WithBffMeta<Gallery>
  >("social.grain.gallery", {
    orderBy: { field: "createdAt", direction: "desc" },
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

function processStars(
  ctx: BffContext,
  options?: TimelineOptions,
): TimelineItem[] {
  const items: TimelineItem[] = [];

  const whereClause = options?.actorDid
    ? [{ field: "did", equals: options.actorDid }]
    : undefined;

  const { items: favs } = ctx.indexService.getRecords<WithBffMeta<Favorite>>(
    "social.grain.favorite",
    {
      orderBy: { field: "createdAt", direction: "desc" },
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
  const favsItems = processStars(ctx, options);
  const timelineItems = [...galleryItems, ...favsItems];

  return timelineItems.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function getTimeline(ctx: BffContext): TimelineItem[] {
  return getTimelineItems(ctx);
}

function getActorTimeline(handleOrDid: string, ctx: BffContext) {
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

function getActorPhotos(handleOrDid: string, ctx: BffContext) {
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
      orderBy: { field: "createdAt", direction: "desc" },
    },
  );
  return photos.items.map((photo) => photoToView(photo.did, photo));
}

function getActorGalleries(handleOrDid: string, ctx: BffContext) {
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
    orderBy: { field: "createdAt", direction: "desc" },
  });
  const galleryPhotosMap = getGalleryItemsAndPhotos(ctx, galleries);
  const creator = getActorProfile(did, ctx);
  if (!creator) return [];
  return galleries.map((gallery) =>
    galleryToView(gallery, creator, galleryPhotosMap.get(gallery.uri) ?? [])
  );
}

function getGallery(handleOrDid: string, rkey: string, ctx: BffContext) {
  let did: string;
  if (handleOrDid.includes("did:")) {
    did = handleOrDid;
  } else {
    const actor = ctx.indexService.getActorByHandle(handleOrDid);
    if (!actor) return null;
    did = actor.did;
  }
  const gallery = ctx.indexService.getRecord<WithBffMeta<Gallery>>(
    `at://${did}/social.grain.gallery/${rkey}`,
  );
  if (!gallery) return null;
  const galleryPhotosMap = getGalleryItemsAndPhotos(ctx, [gallery]);
  const profile = getActorProfile(did, ctx);
  if (!profile) return null;
  return galleryToView(
    gallery,
    profile,
    galleryPhotosMap.get(gallery.uri) ?? [],
  );
}

async function deleteGallery(uri: string, ctx: BffContext) {
  await ctx.deleteRecord(uri);
  const { items: galleryItems } = ctx.indexService.getRecords<
    WithBffMeta<GalleryItem>
  >("social.grain.gallery.item", {
    where: [{ field: "gallery", equals: uri }],
  });
  for (const item of galleryItems) {
    await ctx.deleteRecord(item.uri);
  }
  const { items: favs } = ctx.indexService.getRecords<WithBffMeta<Favorite>>(
    "social.grain.favorite",
    {
      where: [{ field: "subject", equals: uri }],
    },
  );
  for (const fav of favs) {
    await ctx.deleteRecord(fav.uri);
  }
}

function getGalleryFavs(galleryUri: string, ctx: BffContext) {
  const atUri = new AtUri(galleryUri);
  const results = ctx.indexService.getRecords<WithBffMeta<Favorite>>(
    "social.grain.favorite",
    {
      where: [
        {
          field: "subject",
          equals: `at://${atUri.hostname}/social.grain.gallery/${atUri.rkey}`,
        },
      ],
    },
  );
  return results.items;
}

function getPageMeta(pageUrl: string): MetaDescriptor[] {
  return [
    {
      tagName: "link",
      property: "canonical",
      href: `${PUBLIC_URL}${pageUrl}`,
    },
    { property: "og:site_name", content: "Grain Social" },
  ];
}

function getGalleryMeta(gallery: GalleryView): MetaDescriptor[] {
  return [
    // { property: "og:type", content: "website" },
    {
      property: "og:url",
      content: `${PUBLIC_URL}/profile/${gallery.creator.handle}/${
        new AtUri(gallery.uri).rkey
      }`,
    },
    { property: "og:title", content: (gallery.record as Gallery).title },
    {
      property: "og:description",
      content: (gallery.record as Gallery).description,
    },
    {
      property: "og:image",
      content: gallery?.items?.filter(isPhotoView)?.[0]?.thumb,
    },
  ];
}

function Root(props: Readonly<RootProps<State>>) {
  const profile = props.ctx.state.profile;
  const scripts = props.ctx.state.scripts;
  return (
    <html lang="en" class="w-full h-full">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <Meta meta={props.ctx.state.meta} />
        {GOATCOUNTER_URL
          ? (
            <script
              data-goatcounter={GOATCOUNTER_URL}
              async
              src="//gc.zgo.at/count.js"
            />
          )
          : null}
        <script src="https://unpkg.com/htmx.org@1.9.10" />
        <script src="https://unpkg.com/hyperscript.org@0.9.14" />
        <script src="https://unpkg.com/sortablejs@1.15.6" />
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <link rel="stylesheet" href={`/static/styles.css?${cssContentHash}`} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Jersey+20&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://unpkg.com/@fortawesome/fontawesome-free@6.7.2/css/all.min.css"
          preload
        />
        {scripts?.map((file) => <script key={file} src={`/static/${file}`} />)}
      </head>
      <body class="h-full w-full dark:bg-zinc-950 dark:text-white">
        <Layout id="layout" class="dark:border-zinc-800">
          <Layout.Nav
            heading={
              <h1 class="font-['Jersey_20'] text-4xl text-zinc-900 dark:text-white">
                grain
                <sub class="bottom-[0.75rem] text-[1rem]">beta</sub>
              </h1>
            }
            profile={profile}
            class="dark:border-zinc-800"
          />
          <Layout.Content>{props.children}</Layout.Content>
        </Layout>
      </body>
    </html>
  );
}

function Header({
  children,
  class: classProp,
  ...props
}: Readonly<
  JSX.HTMLAttributes<HTMLHeadingElement> & { children: ComponentChildren }
>) {
  return (
    <h1 class={cn("text-xl font-semibold", classProp)} {...props}>
      {children}
    </h1>
  );
}

function AvatarButton({
  profile,
}: Readonly<{ profile: Un$Typed<ProfileView> }>) {
  return (
    <button
      type="button"
      class="cursor-pointer"
      hx-get={`/dialogs/avatar/${profile.handle}`}
      hx-trigger="click"
      hx-target="body"
      hx-swap="afterbegin"
    >
      <img
        src={profile.avatar}
        alt={profile.handle}
        class="rounded-full object-cover size-16"
      />
    </button>
  );
}

function AvatarDialog({
  profile,
}: Readonly<{ profile: Un$Typed<ProfileView> }>) {
  return (
    <Dialog>
      <div
        class="w-[400px] h-[400px] flex flex-col p-4 z-10"
        _={Dialog._closeOnClick}
      >
        <img
          src={profile.avatar}
          alt={profile.handle}
          class="rounded-full w-full h-full object-cover"
        />
      </div>
    </Dialog>
  );
}

function Timeline({ items }: Readonly<{ items: TimelineItem[] }>) {
  return (
    <div class="px-4 mb-4">
      <div class="my-4">
        <Header>Timeline</Header>
      </div>
      <ul class="space-y-4 relative">
        {items.map((item) => <TimelineItem item={item} key={item.itemUri} />)}
      </ul>
    </div>
  );
}

function TimelineItem({ item }: Readonly<{ item: TimelineItem }>) {
  return (
    <li class="space-y-2">
      <div class="bg-zinc-100 dark:bg-zinc-900 w-fit p-2">
        <a
          href={profileLink(item.actor.handle)}
          class="font-semibold hover:underline"
        >
          @{item.actor.handle}
        </a>{" "}
        {item.itemType === "favorite" ? "favorited" : "created"}{" "}
        <a
          href={galleryLink(
            item.gallery.creator.handle,
            new AtUri(item.gallery.uri).rkey,
          )}
          class="font-semibold hover:underline"
        >
          {(item.gallery.record as Gallery).title}
        </a>
        <span class="ml-1">
          {formatDistanceStrict(item.createdAt, new Date(), {
            addSuffix: true,
          })}
        </span>
      </div>
      <a
        href={galleryLink(
          item.gallery.creator.handle,
          new AtUri(item.gallery.uri).rkey,
        )}
        class="w-fit flex"
      >
        {item.gallery.items?.filter(isPhotoView).length
          ? (
            <div class="flex w-full max-w-md mx-auto aspect-[3/2] overflow-hidden gap-2">
              <div class="w-2/3 h-full">
                <img
                  src={item.gallery.items?.filter(isPhotoView)[0].thumb}
                  alt={item.gallery.items?.filter(isPhotoView)[0].alt}
                  class="w-full h-full object-cover"
                />
              </div>
              <div class="w-1/3 flex flex-col h-full gap-2">
                <div class="h-1/2">
                  {item.gallery.items?.filter(isPhotoView)?.[1]
                    ? (
                      <img
                        src={item.gallery.items?.filter(isPhotoView)?.[1]
                          ?.thumb}
                        alt={item.gallery.items?.filter(isPhotoView)?.[1]?.alt}
                        class="w-full h-full object-cover"
                      />
                    )
                    : (
                      <div className="w-full h-full bg-zinc-200 dark:bg-zinc-900" />
                    )}
                </div>
                <div class="h-1/2">
                  {item.gallery.items?.filter(isPhotoView)?.[2]
                    ? (
                      <img
                        src={item.gallery.items?.filter(isPhotoView)?.[2]
                          ?.thumb}
                        alt={item.gallery.items?.filter(isPhotoView)?.[2]?.alt}
                        class="w-full h-full object-cover"
                      />
                    )
                    : (
                      <div className="w-full h-full bg-zinc-200 dark:bg-zinc-900" />
                    )}
                </div>
              </div>
            </div>
          )
          : null}
      </a>
    </li>
  );
}

function FollowButton({
  followeeDid,
  followUri,
}: Readonly<{ followeeDid: string; load?: boolean; followUri?: string }>) {
  const isFollowing = followUri;
  return (
    <Button
      variant="primary"
      class={cn(
        "w-full sm:w-fit",
        isFollowing &&
          "bg-zinc-200 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-800",
      )}
      {...(isFollowing
        ? {
          children: "Following",
          "hx-delete": `/follow/${followeeDid}/${new AtUri(followUri).rkey}`,
        }
        : {
          children: (
            <>
              <i class="fa-solid fa-plus mr-2" />Follow
            </>
          ),
          "hx-post": `/follow/${followeeDid}`,
        })}
      hx-trigger="click"
      hx-target="this"
      hx-swap="outerHTML"
    />
  );
}

function ProfilePage({
  followUri,
  loggedInUserDid,
  timelineItems,
  profile,
  selectedTab,
  galleries,
}: Readonly<{
  followUri?: string;
  loggedInUserDid?: string;
  timelineItems: TimelineItem[];
  profile: Un$Typed<ProfileView>;
  selectedTab?: string;
  galleries?: GalleryView[];
}>) {
  const isCreator = loggedInUserDid === profile.did;
  return (
    <div class="px-4 mb-4" id="profile-page">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between my-4">
        <div class="flex flex-col">
          <AvatarButton profile={profile} />
          <p class="text-2xl font-bold">{profile.displayName}</p>
          <p class="text-zinc-600 dark:text-zinc-500">@{profile.handle}</p>
          <p class="my-2">{profile.description}</p>
        </div>
        {!isCreator && loggedInUserDid
          ? (
            <div class="flex self-start gap-2 w-full sm:w-fit flex-col sm:flex-row">
              <FollowButton followeeDid={profile.did} followUri={followUri} />
            </div>
          )
          : null}
        {isCreator
          ? (
            <div class="flex self-start gap-2 w-full sm:w-fit flex-col sm:flex-row">
              <Button variant="primary" class="w-full sm:w-fit" asChild>
                <a href="/upload">
                  <i class="fa-solid fa-upload mr-2" />
                  Upload
                </a>
              </Button>
              <Button
                variant="primary"
                type="button"
                hx-get="/dialogs/profile"
                hx-target="#layout"
                hx-swap="afterbegin"
                class="w-full sm:w-fit"
              >
                Edit Profile
              </Button>
              <Button
                variant="primary"
                type="button"
                class="w-full sm:w-fit"
                hx-get="/dialogs/gallery/new"
                hx-target="#layout"
                hx-swap="afterbegin"
              >
                Create Gallery
              </Button>
            </div>
          )
          : null}
      </div>
      <div class="my-4 space-x-2 w-full flex sm:w-fit" role="tablist">
        <button
          type="button"
          hx-get={profileLink(profile.handle)}
          hx-target="body"
          hx-swap="outerHTML"
          class={cn(
            "flex-1 py-2 px-4 cursor-pointer font-semibold",
            !selectedTab && "bg-zinc-100 dark:bg-zinc-800 font-semibold",
          )}
          role="tab"
          aria-selected="true"
          aria-controls="tab-content"
        >
          Activity
        </button>
        <button
          type="button"
          hx-get={profileLink(profile.handle) + "?tab=galleries"}
          hx-target="#profile-page"
          hx-swap="outerHTML"
          class={cn(
            "flex-1 py-2 px-4 cursor-pointer font-semibold",
            selectedTab === "galleries" && "bg-zinc-100 dark:bg-zinc-800",
          )}
          role="tab"
          aria-selected="false"
          aria-controls="tab-content"
        >
          Galleries
        </button>
      </div>
      <div id="tab-content" role="tabpanel">
        {!selectedTab
          ? (
            <ul class="space-y-4 relative">
              {timelineItems.length
                ? (
                  timelineItems.map((item) => (
                    <TimelineItem item={item} key={item.itemUri} />
                  ))
                )
                : <li>No activity yet.</li>}
            </ul>
          )
          : null}
        {selectedTab === "galleries"
          ? (
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              {galleries?.length
                ? (
                  galleries.map((gallery) => (
                    <a
                      href={galleryLink(
                        gallery.creator.handle,
                        new AtUri(gallery.uri).rkey,
                      )}
                      class="cursor-pointer relative aspect-square"
                    >
                      {gallery.items?.length
                        ? (
                          <img
                            src={gallery.items?.filter(isPhotoView)?.[0]?.thumb}
                            alt={gallery.items?.filter(isPhotoView)?.[0]?.alt}
                            class="w-full h-full object-cover"
                          />
                        )
                        : (
                          <div class="w-full h-full bg-zinc-200 dark:bg-zinc-900" />
                        )}
                      <div class="absolute bottom-0 left-0 bg-black/80 text-white p-2">
                        {(gallery.record as Gallery).title}
                      </div>
                    </a>
                  ))
                )
                : <p>No galleries yet.</p>}
            </div>
          )
          : null}
      </div>
    </div>
  );
}

function UploadPage(
  { handle, photos, returnTo }: Readonly<
    { handle: string; photos: PhotoView[]; returnTo?: string }
  >,
) {
  return (
    <div class="flex flex-col px-4 pt-4 mb-4 space-y-4">
      <div class="flex">
        <div class="flex-1">
          {returnTo
            ? (
              <a
                href={returnTo}
                class="hover:underline"
              >
                <i class="fa-solid fa-arrow-left mr-2" />
                Back to gallery
              </a>
            )
            : (
              <a href={profileLink(handle)} class="hover:underline">
                <i class="fa-solid fa-arrow-left mr-2" />
                Back to profile
              </a>
            )}
        </div>
        <div>10/100 photos</div>
      </div>
      <Button variant="primary" class="mb-4" asChild>
        <label class="w-fit">
          <i class="fa fa-plus"></i> Add photos
          <input
            class="hidden"
            type="file"
            multiple
            accept="image/*"
            _="on change
                set fileList to me.files
                if fileList.length > 10
                  alert('You can only upload 10 photos at a time')
                  halt
                end
                for file in fileList
                  make a FormData called fd
                  fd.append('file', file)
                  fetch /actions/photo/upload-start with { method:'POST', body:fd }
                  then put it at the start of #image-preview
                  then call htmx.process(#image-preview)
                end
                set me.value to ''"
          />
        </label>
      </Button>
      <div
        id="image-preview"
        class="w-full h-full grid grid-cols-2 sm:grid-cols-5 gap-2"
      >
        {photos.map((photo) => (
          <PhotoPreview key={photo.cid} src={photo.thumb} uri={photo.uri} />
        ))}
      </div>
    </div>
  );
}

function ProfileDialog({
  profile,
  avatarCid,
}: Readonly<{
  profile: ProfileView;
  avatarCid?: string;
}>) {
  return (
    <Dialog>
      <Dialog.Content class="dark:bg-zinc-950">
        <Dialog.Title>Edit my profile</Dialog.Title>
        <div>
          <AvatarForm src={profile.avatar} alt={profile.handle} />
        </div>
        <form
          hx-post="/actions/profile/update"
          hx-swap="none"
          _="on htmx:afterOnLoad trigger closeModal"
        >
          <div id="image-input">
            <input type="hidden" name="avatarCid" value={avatarCid} />
          </div>
          <div class="mb-4 relative">
            <label htmlFor="displayName">Display Name</label>
            <Input
              type="text"
              required
              id="displayName"
              name="displayName"
              class="dark:bg-zinc-800 dark:text-white"
              value={profile.displayName}
            />
          </div>
          <div class="mb-4 relative">
            <label htmlFor="description">Description</label>
            <Textarea
              id="description"
              name="description"
              rows={4}
              class="dark:bg-zinc-800 dark:text-white"
            >
              {profile.description}
            </Textarea>
          </div>
          <Button type="submit" variant="primary" class="w-full">
            Update
          </Button>
          <Button
            variant="secondary"
            type="button"
            class="w-full"
            _={Dialog._closeOnClick}
          >
            Cancel
          </Button>
        </form>
      </Dialog.Content>
    </Dialog>
  );
}

function AvatarForm({ src, alt }: Readonly<{ src?: string; alt?: string }>) {
  return (
    <form
      id="avatar-file-form"
      hx-post="/actions/avatar/upload-start"
      hx-target="#image-preview"
      hx-swap="innerHTML"
      hx-encoding="multipart/form-data"
      hx-trigger="change from:#file"
    >
      <label htmlFor="file">
        <span class="sr-only">Upload avatar</span>
        <div class="border rounded-full border-zinc-900 w-16 h-16 mx-auto mb-2 relative my-2 cursor-pointer">
          <div class="absolute bottom-0 right-0 bg-zinc-800 rounded-full w-5 h-5 flex items-center justify-center z-10">
            <i class="fa-solid fa-camera text-white text-xs"></i>
          </div>
          <div id="image-preview" class="w-full h-full">
            {src
              ? (
                <img
                  src={src}
                  alt={alt}
                  className="rounded-full w-full h-full object-cover"
                />
              )
              : null}
          </div>
        </div>
        <input
          class="hidden"
          type="file"
          id="file"
          name="file"
          accept="image/*"
        />
      </label>
    </form>
  );
}

function GalleryPage({
  gallery,
  favs = [],
  currentUserDid,
}: Readonly<{
  gallery: GalleryView;
  favs: WithBffMeta<Favorite>[];
  currentUserDid?: string;
}>) {
  const isCreator = currentUserDid === gallery.creator.did;
  const isLoggedIn = !!currentUserDid;
  return (
    <div class="px-4">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between my-4">
        <div class="flex flex-col space-y-1 mb-4">
          <h1 class="font-bold text-2xl">
            {(gallery.record as Gallery).title}
          </h1>
          <div>
            Gallery by{" "}
            <a
              href={profileLink(gallery.creator.handle)}
              class="hover:underline"
            >
              <span class="font-semibold">{gallery.creator.displayName}</span>
              {" "}
              <span class="text-zinc-600 dark:text-zinc-500">
                @{gallery.creator.handle}
              </span>
            </a>
          </div>
          <p>{(gallery.record as Gallery).description}</p>
        </div>
        {isLoggedIn && isCreator
          ? (
            <div class="flex self-start gap-2 w-full sm:w-fit flex-col sm:flex-row">
              <Button
                hx-get={`/dialogs/photo-select/${new AtUri(gallery.uri).rkey}`}
                hx-target="#layout"
                hx-swap="afterbegin"
                variant="primary"
                class="self-start w-full sm:w-fit"
              >
                Add photos
              </Button>
              <Button
                variant="primary"
                class="self-start w-full sm:w-fit"
                hx-get={`/dialogs/gallery/${new AtUri(gallery.uri).rkey}`}
                hx-target="#layout"
                hx-swap="afterbegin"
              >
                Change Sort
              </Button>
              <Button
                variant="primary"
                class="self-start w-full sm:w-fit"
                hx-get={`/dialogs/gallery/${new AtUri(gallery.uri).rkey}`}
                hx-target="#layout"
                hx-swap="afterbegin"
              >
                Edit
              </Button>
            </div>
          )
          : null}
        {!isCreator
          ? (
            <FavoriteButton
              currentUserDid={currentUserDid}
              favs={favs}
              galleryUri={gallery.uri}
            />
          )
          : null}
      </div>
      <SortableGrid gallery={gallery} />
      {
        /* <div
        id="masonry-container"
        class="h-0 overflow-hidden relative mx-auto w-full"
        _="on load or htmx:afterSettle call computeMasonry()"
      >
        {gallery.items?.filter(isPhotoView)?.length
          ? gallery?.items
            ?.filter(isPhotoView)
            ?.map((photo) => (
              <PhotoButton
                key={photo.cid}
                photo={photo}
                gallery={gallery}
                isCreator={isCreator}
                isLoggedIn={isLoggedIn}
              />
            ))
          : null}
      </div> */
      }
    </div>
  );
}

function PhotoButton({
  photo,
  gallery,
  isCreator,
  isLoggedIn,
}: Readonly<{
  photo: PhotoView;
  gallery: GalleryView;
  isCreator: boolean;
  isLoggedIn: boolean;
}>) {
  return (
    <button
      id={`photo-${new AtUri(photo.uri).rkey}`}
      type="button"
      hx-get={photoDialogLink(gallery, photo)}
      hx-trigger="click"
      hx-target="#layout"
      hx-swap="afterbegin"
      class="masonry-tile absolute cursor-pointer"
      data-width={photo.aspectRatio?.width}
      data-height={photo.aspectRatio?.height}
    >
      {isLoggedIn && isCreator
        ? <AltTextButton galleryUri={gallery.uri} cid={photo.cid} />
        : null}
      <img
        src={photo.fullsize}
        alt={photo.alt}
        class="w-full h-full object-cover"
      />
      {!isCreator && photo.alt
        ? (
          <div class="absolute bg-zinc-950 dark:bg-zinc-900 bottom-1 right-1 sm:bottom-1 sm:right-1 text-xs text-white font-semibold py-[1px] px-[3px]">
            ALT
          </div>
        )
        : null}
    </button>
  );
}

function SortableGrid({
  gallery,
}: Readonly<{ gallery: GalleryView }>) {
  return (
    <form
      id="masonry-container"
      class="sortable h-0 overflow-hidden relative mx-auto w-full"
      _="on load or htmx:afterSettle call computeMasonry()"
      // hx-post="/actions/sort-end"
      // hx-trigger="end"
      // hx-swap="none"
    >
      <div class="htmx-indicator">Updating...</div>
      {gallery?.items?.filter(isPhotoView).map((item) => (
        <div
          key={item.cid}
          class="masonry-tile absolute cursor-pointer"
          data-width={item.aspectRatio?.width}
          data-height={item.aspectRatio?.height}
        >
          <input type="hidden" name="item" value={item.uri} />
          <img
            src={item.fullsize}
            alt={item.alt}
            class="w-full h-full object-cover"
          />
        </div>
      ))}
    </form>
  );
}

function FavoriteButton({
  currentUserDid,
  favs = [],
  galleryUri,
}: Readonly<{
  currentUserDid?: string;
  favs: WithBffMeta<Favorite>[];
  galleryUri: string;
}>) {
  const favUri = favs.find((s) => currentUserDid === s.did)?.uri;
  return (
    <Button
      variant="primary"
      class="self-start w-full sm:w-fit"
      type="button"
      hx-post={`/actions/favorite?galleryUri=${galleryUri}${
        favUri ? "&favUri=" + favUri : ""
      }`}
      hx-target="this"
      hx-swap="outerHTML"
    >
      <i class={cn("fa-heart", favUri ? "fa-solid" : "fa-regular")}></i>{" "}
      {favs.length}
    </Button>
  );
}

function GalleryCreateEditDialog({
  gallery,
}: Readonly<{ gallery?: GalleryView | null }>) {
  return (
    <Dialog id="gallery-dialog" class="z-30">
      <Dialog.Content class="dark:bg-zinc-950">
        <Dialog.Title>
          {gallery ? "Edit gallery" : "Create a new gallery"}
        </Dialog.Title>
        <form
          id="gallery-form"
          class="max-w-xl"
          hx-post={`/actions/create-edit${
            gallery ? "?uri=" + gallery?.uri : ""
          }`}
          hx-swap="none"
          _="on htmx:afterOnLoad
            if event.detail.xhr.status != 200
              alert('Error: ' + event.detail.xhr.responseText)"
        >
          <div class="mb-4 relative">
            <label htmlFor="title">Gallery name</label>
            <Input
              type="text"
              id="title"
              name="title"
              class="dark:bg-zinc-800 dark:text-white"
              required
              value={(gallery?.record as Gallery)?.title}
              autofocus
            />
          </div>
          <div class="mb-2 relative">
            <label htmlFor="description">Description</label>
            <Textarea
              id="description"
              name="description"
              rows={4}
              class="dark:bg-zinc-800 dark:text-white"
            >
              {(gallery?.record as Gallery)?.description}
            </Textarea>
          </div>
        </form>
        <div class="max-w-xl">
          <input
            type="button"
            name="galleryUri"
            value={gallery?.uri}
            class="hidden"
          />
        </div>
        <form
          id="delete-form"
          hx-post={`/actions/gallery/delete?uri=${gallery?.uri}`}
        >
          <input type="hidden" name="uri" value={gallery?.uri} />
        </form>
        <div class="flex flex-col gap-2 mt-2">
          <Button
            variant="primary"
            form="gallery-form"
            type="submit"
            class="w-full"
          >
            {gallery ? "Update gallery" : "Create gallery"}
          </Button>
          {gallery
            ? (
              <Button
                variant="destructive"
                form="delete-form"
                type="submit"
                class="w-full"
              >
                Delete gallery
              </Button>
            )
            : null}
          <Button
            variant="secondary"
            type="button"
            class="w-full"
            _={Dialog._closeOnClick}
          >
            Cancel
          </Button>
        </div>
      </Dialog.Content>
    </Dialog>
  );
}

function PhotoPreview({
  src,
  uri,
}: Readonly<{
  src: string;
  uri?: string;
}>) {
  return (
    <div class="relative aspect-square bg-zinc-200 dark:bg-zinc-900">
      {uri
        ? (
          <button
            type="button"
            hx-delete={`/actions/photo/${new AtUri(uri).rkey}`}
            class="bg-zinc-950 z-10 absolute top-2 right-2 cursor-pointer size-4 flex items-center justify-center"
            _="on htmx:afterOnLoad remove me.parentNode"
          >
            <i class="fas fa-close text-white"></i>
          </button>
        )
        : null}
      <img
        src={src}
        alt=""
        data-state={uri ? "complete" : "pending"}
        class="absolute inset-0 w-full h-full object-contain data-[state=pending]:opacity-50"
      />
    </div>
  );
}

function AltTextButton({
  galleryUri,
  cid,
}: Readonly<{ galleryUri: string; cid: string }>) {
  return (
    <div
      class="bg-zinc-950 dark:bg-zinc-900 py-[1px] px-[3px] absolute top-1 left-1 sm:top-1 sm:left-1 cursor-pointer flex items-center justify-center text-xs text-white font-semibold z-10"
      hx-get={`/dialogs/image-alt?galleryUri=${galleryUri}&imageCid=${cid}`}
      hx-trigger="click"
      hx-target="#layout"
      hx-swap="afterbegin"
      _="on click halt"
    >
      <i class="fas fa-plus text-[10px] mr-1"></i> ALT
    </div>
  );
}

function PhotoDialog({
  gallery,
  image,
  nextImage,
  prevImage,
}: Readonly<{
  gallery: GalleryView;
  image: PhotoView;
  nextImage?: PhotoView;
  prevImage?: PhotoView;
}>) {
  return (
    <Dialog id="photo-dialog" class="bg-zinc-950 z-30">
      {nextImage
        ? (
          <div
            hx-get={photoDialogLink(gallery, nextImage)}
            hx-trigger="keyup[key=='ArrowRight'] from:body, swipeleft from:body"
            hx-target="#photo-dialog"
            hx-swap="innerHTML"
          />
        )
        : null}
      {prevImage
        ? (
          <div
            hx-get={photoDialogLink(gallery, prevImage)}
            hx-trigger="keyup[key=='ArrowLeft'] from:body, swiperight from:body"
            hx-target="#photo-dialog"
            hx-swap="innerHTML"
          />
        )
        : null}
      <div
        class="flex flex-col w-5xl h-[calc(100vh-100px)] sm:h-screen z-20"
        _={Dialog._closeOnClick}
      >
        <div class="flex flex-col p-4 z-20 flex-1 relative">
          <img
            src={image.fullsize}
            alt={image.alt}
            class="absolute inset-0 w-full h-full object-contain"
          />
        </div>
        {image.alt
          ? (
            <div class="px-4 sm:px-0 py-4 bg-black text-white text-left">
              {image.alt}
            </div>
          )
          : null}
      </div>
    </Dialog>
  );
}

function PhotoAltDialog({
  photo,
  galleryUri,
}: Readonly<{
  photo: PhotoView;
  galleryUri: string;
}>) {
  return (
    <Dialog id="photo-alt-dialog" class="z-30">
      <Dialog.Content class="dark:bg-zinc-950">
        <Dialog.Title>Add alt text</Dialog.Title>
        <div class="aspect-square relative">
          <img
            src={photo.fullsize}
            alt={photo.alt}
            class="absolute inset-0 w-full h-full object-contain"
          />
        </div>
        <form
          hx-put={`/actions/photo/${new AtUri(photo.uri).rkey}`}
          _="on htmx:afterOnLoad trigger closeDialog"
        >
          <input type="hidden" name="galleryUri" value={galleryUri} />
          <input type="hidden" name="cid" value={photo.cid} />
          <div class="my-2">
            <label htmlFor="alt">Descriptive alt text</label>
            <Textarea
              id="alt"
              name="alt"
              rows={4}
              defaultValue={photo.alt}
              placeholder="Alt text"
              autoFocus
              class="dark:bg-zinc-800 dark:text-white"
            />
          </div>
          <div class="w-full flex flex-col gap-2 mt-2">
            <Button type="submit" variant="primary" class="w-full">
              Save
            </Button>
            <Dialog.Close class="w-full">Cancel</Dialog.Close>
          </div>
        </form>
      </Dialog.Content>
    </Dialog>
  );
}

function PhotoSelectDialog({
  galleryUri,
  itemUris,
  photos,
}: Readonly<{
  galleryUri: string;
  itemUris: string[];
  photos: PhotoView[];
}>) {
  return (
    <Dialog id="photo-select-dialog" class="z-30">
      <Dialog.Content class="w-full max-w-5xl dark:bg-zinc-950 sm:min-h-screen flex flex-col">
        <Dialog.Title>Add photos</Dialog.Title>
        {photos.length
          ? (
            <p class="my-2 text-center">
              Choose photos to add/remove from your gallery. Click close when
              done.
            </p>
          )
          : null}
        {photos.length
          ? (
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 my-4 flex-1">
              {photos.map((photo) => (
                <PhotoSelectButton
                  key={photo.cid}
                  galleryUri={galleryUri}
                  itemUris={itemUris}
                  photo={photo}
                />
              ))}
            </div>
          )
          : (
            <div class="flex-1 flex justify-center items-center my-30">
              <p>
                No photos yet.{" "}
                <a
                  href={`/upload?returnTo=${new AtUri(galleryUri).rkey}`}
                  class="hover:underline font-semibold text-sky-500"
                >
                  Upload
                </a>{" "}
                photos and return to add.
              </p>
            </div>
          )}
        <div class="w-full flex flex-col gap-2 mt-2">
          <Dialog.Close class="w-full">Close</Dialog.Close>
        </div>
      </Dialog.Content>
    </Dialog>
  );
}

function PhotoSelectButton({
  galleryUri,
  itemUris,
  photo,
}: Readonly<{
  galleryUri: string;
  itemUris: string[];
  photo: PhotoView;
}>) {
  return (
    <button
      hx-put={`/actions/gallery/${new AtUri(galleryUri).rkey}/${
        itemUris.includes(photo.uri) ? "remove-photo" : "add-photo"
      }/${new AtUri(photo.uri).rkey}`}
      hx-swap="outerHTML"
      type="button"
      data-added={itemUris.includes(photo.uri) ? "true" : "false"}
      class="group cursor-pointer relative aspect-square data-[added=true]:ring-2 ring-sky-500 disabled:opacity-50"
      _={`on htmx:beforeRequest add @disabled to me
     then on htmx:afterOnLoad
       remove @disabled from me
       if @data-added == 'true'
         set @data-added to 'false' 
         remove #photo-${new AtUri(photo.uri).rkey}
       else
         set @data-added to 'true'
       end`}
    >
      <div class="hidden group-data-[added=true]:block absolute top-2 right-2">
        <i class="fa-check fa-solid text-sky-500 z-10" />
      </div>
      <img
        src={photo.fullsize}
        alt={photo.alt}
        class="absolute inset-0 w-full h-full object-contain"
      />
    </button>
  );
}

function getActorProfile(did: string, ctx: BffContext) {
  const actor = ctx.indexService.getActor(did);
  if (!actor) return null;
  const profileRecord = ctx.indexService.getRecord<WithBffMeta<Profile>>(
    `at://${did}/social.grain.actor.profile/self`,
  );
  return profileRecord ? profileToView(profileRecord, actor.handle) : null;
}

function galleryToView(
  record: WithBffMeta<Gallery>,
  creator: Un$Typed<ProfileView>,
  items: Photo[],
): Un$Typed<GalleryView> {
  return {
    uri: record.uri,
    cid: record.cid,
    creator,
    record,
    items: items
      ?.map((item) => itemToView(record.did, item))
      .filter(isPhotoView),
    indexedAt: record.indexedAt,
  };
}

function itemToView(
  did: string,
  item:
    | WithBffMeta<Photo>
    | {
      $type: string;
    },
): Un$Typed<PhotoView> | undefined {
  if (isPhoto(item)) {
    return photoToView(did, item);
  }
  return undefined;
}

function photoToView(
  did: string,
  photo: WithBffMeta<Photo>,
): $Typed<PhotoView> {
  return {
    $type: "social.grain.photo.defs#photoView",
    uri: photo.uri,
    cid: photo.photo.ref.toString(),
    thumb:
      `https://cdn.bsky.app/img/feed_thumbnail/plain/${did}/${photo.photo.ref.toString()}@webp`,
    fullsize:
      `https://cdn.bsky.app/img/feed_fullsize/plain/${did}/${photo.photo.ref.toString()}@webp`,
    alt: photo.alt,
    aspectRatio: photo.aspectRatio,
  };
}

function profileToView(
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

function profileLink(handle: string) {
  return `/profile/${handle}`;
}

function galleryLink(handle: string, galleryRkey: string) {
  return `/profile/${handle}/${galleryRkey}`;
}

function photoDialogLink(gallery: GalleryView, image: PhotoView) {
  return `/dialogs/image?galleryUri=${gallery.uri}&imageCid=${image.cid}`;
}

async function onSignedIn({ actor, ctx }: onSignedInArgs) {
  await ctx.backfillCollections(
    [actor.did],
    [
      ...ctx.cfg.collections!,
      "app.bsky.actor.profile",
      "app.bsky.graph.follow",
    ],
  );

  const profileResults = ctx.indexService.getRecords<Profile>(
    "social.grain.actor.profile",
    {
      where: [{ field: "did", equals: actor.did }],
    },
  );

  const profile = profileResults.items[0];

  if (profile) {
    console.log("Profile already exists");
    return `/profile/${actor.handle}`;
  }

  const bskyProfileResults = ctx.indexService.getRecords<BskyProfile>(
    "app.bsky.actor.profile",
    {
      where: [{ field: "did", equals: actor.did }],
    },
  );

  const bskyProfile = bskyProfileResults.items[0];

  if (!bskyProfile) {
    console.error("Failed to get profile");
    return;
  }

  await ctx.createRecord<Profile>(
    "social.grain.actor.profile",
    {
      displayName: bskyProfile.displayName ?? undefined,
      description: bskyProfile.description ?? undefined,
      avatar: bskyProfile.avatar ?? undefined,
      createdAt: new Date().toISOString(),
    },
    true,
  );

  return "/onboard";
}

function uploadStart(
  routePrefix: string,
  cb: (params: { uploadId: string; dataUrl?: string; cid?: string }) => VNode,
): RouteHandler {
  return async (req, _params, ctx) => {
    requireAuth(ctx);
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return new Response("No file", { status: 400 });
    }
    const dataUrl = await compressImageForPreview(file);
    const uploadId = ctx.uploadBlob({
      file,
      dataUrl,
    });
    return ctx.html(
      <div
        id={`upload-id-${uploadId}`}
        hx-trigger="done"
        hx-get={`/actions/${routePrefix}/upload-done?uploadId=${uploadId}`}
        hx-target="this"
        hx-swap="outerHTML"
        class="h-full w-full"
      >
        <div
          hx-get={`/actions/${routePrefix}/upload-check-status?uploadId=${uploadId}`}
          hx-trigger="every 600ms"
          hx-target="this"
          hx-swap="innerHTML"
          class="h-full w-full"
        >
          {cb({ uploadId, dataUrl })}
        </div>
      </div>,
    );
  };
}

function uploadCheckStatus(
  cb: (params: { uploadId: string; dataUrl: string; cid?: string }) => VNode,
): RouteHandler {
  return (req, _params, ctx) => {
    requireAuth(ctx);
    const url = new URL(req.url);
    const searchParams = new URLSearchParams(url.search);
    const uploadId = searchParams.get("uploadId");
    if (!uploadId) return ctx.next();
    const meta = ctx.blobMetaCache.get(uploadId);
    if (!meta?.dataUrl) return ctx.next();
    return ctx.html(
      cb({ uploadId, dataUrl: meta.dataUrl }),
      meta.blobRef ? { "HX-Trigger": "done" } : undefined,
    );
  };
}

function avatarUploadDone(
  cb: (params: { dataUrl: string; cid: string }) => VNode,
): RouteHandler {
  return (req, _params, ctx) => {
    requireAuth(ctx);
    const url = new URL(req.url);
    const searchParams = new URLSearchParams(url.search);
    const uploadId = searchParams.get("uploadId");
    if (!uploadId) return ctx.next();
    const meta = ctx.blobMetaCache.get(uploadId);
    if (!meta?.dataUrl || !meta?.blobRef) return ctx.next();
    return ctx.html(
      cb({ dataUrl: meta.dataUrl, cid: meta.blobRef.ref.toString() }),
    );
  };
}

function photoUploadDone(
  cb: (params: { dataUrl: string; uri: string }) => VNode,
): RouteHandler {
  return async (req, _params, ctx) => {
    requireAuth(ctx);
    const url = new URL(req.url);
    const searchParams = new URLSearchParams(url.search);
    const uploadId = searchParams.get("uploadId");
    if (!uploadId) return ctx.next();
    const meta = ctx.blobMetaCache.get(uploadId);
    if (!meta?.dataUrl || !meta?.blobRef) return ctx.next();
    const photoUri = await ctx.createRecord<Photo>("social.grain.photo", {
      photo: meta.blobRef,
      aspectRatio: meta.dimensions?.width && meta.dimensions?.height
        ? {
          width: meta.dimensions.width,
          height: meta.dimensions.height,
        }
        : undefined,
      alt: "",
      createdAt: new Date().toISOString(),
    });
    return ctx.html(cb({ dataUrl: meta.dataUrl, uri: photoUri }));
  };
}

function photoUploadRoutes(): BffMiddleware[] {
  return [
    route(
      `/actions/photo/upload-start`,
      ["POST"],
      uploadStart(
        "photo",
        ({ dataUrl }) => <PhotoPreview src={dataUrl ?? ""} />,
      ),
    ),
    route(
      `/actions/photo/upload-check-status`,
      ["GET"],
      uploadCheckStatus(({ uploadId, dataUrl }) => (
        <>
          <input type="hidden" name="uploadId" value={uploadId} />
          <PhotoPreview src={dataUrl} />
        </>
      )),
    ),
    route(
      `/actions/photo/upload-done`,
      ["GET"],
      photoUploadDone(({ dataUrl, uri }) => (
        <PhotoPreview src={dataUrl} uri={uri} />
      )),
    ),
  ];
}

function avatarUploadRoutes(): BffMiddleware[] {
  return [
    route(
      `/actions/avatar/upload-start`,
      ["POST"],
      uploadStart("avatar", ({ dataUrl }) => (
        <img
          src={dataUrl}
          alt=""
          data-state="pending"
          class="rounded-full w-full h-full object-cover data-[state=pending]:opacity-50"
        />
      )),
    ),
    route(
      `/actions/avatar/upload-check-status`,
      ["GET"],
      uploadCheckStatus(({ uploadId, dataUrl, cid }) => (
        <>
          <input type="hidden" name="uploadId" value={uploadId} />
          <img
            src={dataUrl}
            alt=""
            data-state={cid ? "complete" : "pending"}
            class="rounded-full w-full h-full object-cover data-[state=pending]:opacity-50"
          />
        </>
      )),
    ),
    route(
      `/actions/avatar/upload-done`,
      ["GET"],
      avatarUploadDone(({ dataUrl, cid }) => (
        <>
          <div hx-swap-oob="innerHTML:#image-input">
            <input type="hidden" name="avatarCid" value={cid} />
          </div>
          <img
            src={dataUrl}
            alt=""
            class="rounded-full w-full h-full object-cover"
          />
        </>
      )),
    ),
  ];
}
