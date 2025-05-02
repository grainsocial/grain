import { lexicons } from "$lexicon/lexicons.ts";
import { Record as BskyProfile } from "$lexicon/types/app/bsky/actor/profile.ts";
import { ProfileView } from "$lexicon/types/social/grain/v0/actor/defs.ts";
import { Record as Profile } from "$lexicon/types/social/grain/v0/actor/profile.ts";
import { Record as Gallery } from "$lexicon/types/social/grain/v0/gallery.ts";
import {
  GalleryView,
  Image as GalleryImage,
  ViewImage,
} from "$lexicon/types/social/grain/v0/gallery/defs.ts";
import { Record as Star } from "$lexicon/types/social/grain/v0/gallery/star.ts";
import { Un$Typed } from "$lexicon/util.ts";
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
  type MetaProps,
  Textarea,
} from "@bigmoves/bff/components";
import { createCanvas, Image } from "@gfx/canvas";
import { formatDistanceStrict } from "date-fns";
import { wrap } from "popmotion";
import { ComponentChildren, JSX, VNode } from "preact";

bff({
  appName: "Grain Social",
  collections: ["social.grain.gallery", "social.grain.actor.profile"],
  jetstreamUrl: JETSTREAM.WEST_1,
  lexicons,
  rootElement: Root,
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
            <a href={profileLink("chadtmiller.com")}>@chadtmiller.com</a>
          </div>
        </div>
      ),
    }),
    route("/", (_req, _params, ctx) => {
      const items = getTimeline(ctx);
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
      if (tab) {
        return ctx.html(
          <ProfilePage
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
          loggedInUserDid={ctx.currentUser?.did}
          timelineItems={timelineItems}
          profile={profile}
        />,
      );
    }),
    route("/profile/:handle/:rkey", (_req, params, ctx: BffContext<State>) => {
      const did = ctx.currentUser?.did;
      let stars: WithBffMeta<Star>[] = [];
      const handle = params.handle;
      const rkey = params.rkey;
      const gallery = getGallery(handle, rkey, ctx);
      if (did && gallery) {
        stars = getGalleryStars(gallery.uri, ctx);
      }
      if (!gallery) return ctx.next();
      ctx.state.meta = getGalleryMeta(gallery);
      ctx.state.scripts = ["image_dialog.js"];
      return ctx.render(
        <GalleryPage stars={stars} gallery={gallery} currentUserDid={did} />,
      );
    }),
    route("/profile/:handle/:rkey/edit", (_req, params, ctx) => {
      requireAuth(ctx);
      const handle = params.handle;
      const rkey = params.rkey;
      const gallery = getGallery(handle, rkey, ctx);
      return ctx.render(
        <GalleryCreateEditPage userHandle={handle} gallery={gallery} />,
      );
    }),
    route("/gallery/new", (_req, _params, ctx) => {
      requireAuth(ctx);
      return ctx.render(
        <GalleryCreateEditPage userHandle={ctx.currentUser.handle} />,
      );
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
      if (!gallery?.images) return ctx.next();
      const image = gallery?.images?.find((image) => {
        return image.cid === imageCid;
      });
      const imageAtIndex = gallery.images.findIndex((image) => {
        return image.cid === imageCid;
      });
      const next = wrap(0, gallery.images.length, imageAtIndex + 1);
      const prev = wrap(0, gallery.images.length, imageAtIndex - 1);
      if (!image) return ctx.next();
      return ctx.html(
        <ImageDialog
          gallery={gallery}
          image={image}
          nextImage={gallery.images.at(next)}
          prevImage={gallery.images.at(prev)}
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
      const image = gallery?.images?.find((image) => {
        return image.cid === imageCid;
      });
      if (!image || !gallery) return ctx.next();
      return ctx.html(
        <ImageAltDialog galleryUri={gallery.uri} image={image} />,
      );
    }),
    route("/actions/create-edit", ["POST"], async (req, _params, ctx) => {
      requireAuth(ctx);
      const formData = await req.formData();
      const title = formData.get("title") as string;
      const description = formData.get("description") as string;
      const cids = formData.getAll("cids") as string[];
      const url = new URL(req.url);
      const searchParams = new URLSearchParams(url.search);
      const uri = searchParams.get("uri");
      const handle = ctx.currentUser?.handle;

      let images: GalleryImage[] = [];
      for (const cid of cids) {
        const blobMeta = ctx.blobMetaCache.get(cid);
        if (!blobMeta?.blobRef) {
          continue;
        }
        images.push({
          image: blobMeta.blobRef,
          alt: "",
          aspectRatio: blobMeta.dimensions?.width && blobMeta.dimensions?.height
            ? {
              width: blobMeta.dimensions.width,
              height: blobMeta.dimensions.height,
            }
            : undefined,
        });
      }

      if (uri) {
        const gallery = ctx.indexService.getRecord<WithBffMeta<Gallery>>(uri);
        if (!gallery) return ctx.next();
        images = mergeUniqueImages(gallery.images, images, cids);
        const rkey = new AtUri(uri).rkey;
        try {
          await ctx.updateRecord<Gallery>("social.grain.gallery", rkey, {
            title,
            description,
            images,
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
          images,
          createdAt: new Date().toISOString(),
        },
      );
      return ctx.redirect(galleryLink(handle, new AtUri(createdUri).rkey));
    }),
    route("/actions/delete", ["POST"], async (req, _params, ctx) => {
      requireAuth(ctx);
      const formData = await req.formData();
      const uri = formData.get("uri") as string;
      await ctx.deleteRecord(uri);
      return ctx.redirect("/");
    }),
    route("/actions/image-alt", ["POST"], async (req, _params, ctx) => {
      requireAuth(ctx);
      const formData = await req.formData();
      const alt = formData.get("alt") as string;
      const cid = formData.get("cid") as string;
      const galleryUri = formData.get("galleryUri") as string;
      const gallery = ctx.indexService.getRecord<WithBffMeta<Gallery>>(
        galleryUri,
      );
      if (!gallery) return ctx.next();
      const images = gallery?.images?.map((image) => {
        if (image.image.ref.toString() === cid) {
          return {
            ...image,
            alt,
          };
        }
        return image;
      });
      const rkey = new AtUri(galleryUri).rkey;
      await ctx.updateRecord<Gallery>("social.grain.gallery", rkey, {
        title: gallery.title,
        description: gallery.description,
        images,
        createdAt: gallery.createdAt,
      });
      return new Response(null, { status: 200 });
    }),
    route("/actions/star", ["POST"], async (req, _params, ctx) => {
      requireAuth(ctx);
      const url = new URL(req.url);
      const searchParams = new URLSearchParams(url.search);
      const galleryUri = searchParams.get("galleryUri");
      const starUri = searchParams.get("starUri") ?? undefined;
      if (!galleryUri) return ctx.next();

      if (starUri) {
        await ctx.deleteRecord(starUri);
        const stars = getGalleryStars(galleryUri, ctx);
        return ctx.html(
          <StarButton
            currentUserDid={ctx.currentUser.did}
            stars={stars}
            galleryUri={galleryUri}
          />,
        );
      }

      await ctx.createRecord<WithBffMeta<Star>>(
        "social.grain.gallery.star",
        {
          subject: galleryUri,
          createdAt: new Date().toISOString(),
        },
      );

      const stars = getGalleryStars(galleryUri, ctx);

      return ctx.html(
        <StarButton
          currentUserDid={ctx.currentUser.did}
          galleryUri={galleryUri}
          stars={stars}
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
    ...imageUploadRoutes(),
    ...avatarUploadRoutes(),
  ],
});

type State = {
  profile?: ProfileView;
  scripts?: string[];
  meta?: MetaProps[];
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

type TimelineItemType = "gallery" | "star";

interface TimelineItem {
  createdAt: string;
  itemType: TimelineItemType;
  itemUri: string;
  actor: Un$Typed<ProfileView>;
  gallery: GalleryView;
}

interface TimelineOptions {
  actorDid?: string;
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

  for (const gallery of galleries) {
    const actor = ctx.indexService.getActor(gallery.did);
    if (!actor) continue;
    const profile = getActorProfile(actor.did, ctx);
    if (!profile) continue;

    const galleryView = galleryToView(gallery, profile);
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

  const { items: stars } = ctx.indexService.getRecords<WithBffMeta<Star>>(
    "social.grain.gallery.star",
    {
      orderBy: { field: "createdAt", direction: "desc" },
      where: whereClause,
    },
  );

  for (const star of stars) {
    if (!star.subject) continue;

    try {
      const atUri = new AtUri(star.subject);
      const galleryDid = atUri.hostname;
      const galleryRkey = atUri.rkey;

      const gallery = ctx.indexService.getRecord<WithBffMeta<Gallery>>(
        `at://${galleryDid}/social.grain.gallery/${galleryRkey}`,
      );
      if (!gallery) continue;

      const galleryActor = ctx.indexService.getActor(galleryDid);
      if (!galleryActor) continue;
      const galleryProfile = getActorProfile(galleryActor.did, ctx);
      if (!galleryProfile) continue;

      const starActor = ctx.indexService.getActor(star.did);
      if (!starActor) continue;
      const starProfile = getActorProfile(starActor.did, ctx);
      if (!starProfile) continue;

      const galleryView = galleryToView(gallery, galleryProfile);
      items.push({
        itemType: "star",
        createdAt: star.createdAt,
        itemUri: star.uri,
        actor: starProfile,
        gallery: galleryView,
      });
    } catch (e) {
      console.error("Error processing star:", e);
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
  const starItems = processStars(ctx, options);
  const timelineItems = [...galleryItems, ...starItems];

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

function getActorGalleries(handleOrDid: string, ctx: BffContext) {
  let did: string;
  if (handleOrDid.includes("did:")) {
    did = handleOrDid;
  } else {
    const actor = ctx.indexService.getActorByHandle(handleOrDid);
    if (!actor) return [];
    did = actor.did;
  }
  const galleries = ctx.indexService.getRecords<WithBffMeta<Gallery>>(
    "social.grain.gallery",
    {
      where: [{ field: "did", equals: did }],
      orderBy: { field: "createdAt", direction: "desc" },
    },
  );
  const creator = getActorProfile(did, ctx);
  if (!creator) return [];
  return galleries.items.map((gallery) => galleryToView(gallery, creator));
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
  const profile = getActorProfile(did, ctx);
  if (!profile) return null;
  return galleryToView(gallery, profile);
}

function getGalleryStars(galleryUri: string, ctx: BffContext) {
  const atUri = new AtUri(galleryUri);
  const results = ctx.indexService.getRecords<WithBffMeta<Star>>(
    "social.grain.gallery.star",
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

function getGalleryMeta(gallery: GalleryView): MetaProps[] {
  return [
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "Atproto Image Gallery" },
    {
      property: "og:url",
      content: `${
        Deno.env.get("BFF_PUBLIC_URL") ?? "http://localhost:8080"
      }/profile/${gallery.creator.handle}/${new AtUri(gallery.uri).rkey}`,
    },
    { property: "og:title", content: (gallery.record as Gallery).title },
    {
      property: "og:description",
      content: (gallery.record as Gallery).description,
    },
    { property: "og:image", content: gallery?.images?.[0].thumb },
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
        <script src="https://unpkg.com/htmx.org@1.9.10" />
        <script src="https://unpkg.com/hyperscript.org@0.9.14" />
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <link rel="stylesheet" href="/static/styles.css" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Jersey+20&display=swap"
          rel="stylesheet"
        >
        </link>
        <link
          rel="stylesheet"
          href="https://unpkg.com/@fortawesome/fontawesome-free@6.7.2/css/all.min.css"
          preload
        />
        {scripts?.includes("image_dialog.js")
          ? <script src="/static/image_dialog.js" />
          : null}
      </head>
      <body class="h-full w-full">
        <Layout id="layout">
          <Layout.Nav
            title={
              <h1 class="font-['Jersey_20'] text-4xl text-gray-900">
                grain
                <sub class="bottom-[0.75rem] text-[1rem]">beta</sub>
              </h1>
            }
            profile={profile}
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
      <div class="bg-gray-100 w-fit p-2">
        <a
          href={profileLink(item.actor.handle)}
          class="font-semibold hover:underline"
        >
          @{item.actor.handle}
        </a>{" "}
        {item.itemType === "star" ? "starred" : "created"}{" "}
        <a
          href={galleryLink(
            item.gallery.creator.handle,
            new AtUri(item.gallery.uri).rkey,
          )}
          class="font-semibold"
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
        {item.gallery.images?.length
          ? (
            <div class="flex w-full max-w-md mx-auto aspect-[3/2] overflow-hidden gap-2">
              <div class="w-2/3 h-full">
                <img
                  src={item.gallery.images[0].thumb}
                  alt={item.gallery.images[0].alt}
                  class="w-full h-full object-cover"
                />
              </div>
              <div class="w-1/3 flex flex-col h-full gap-2">
                <div class="h-1/2">
                  {item.gallery.images?.[1]
                    ? (
                      <img
                        src={item.gallery.images?.[1]?.thumb}
                        alt={item.gallery.images?.[1]?.alt}
                        class="w-full h-full object-cover"
                      />
                    )
                    : <div className="w-full h-full bg-gray-200" />}
                </div>
                <div class="h-1/2">
                  {item.gallery.images?.[2]
                    ? (
                      <img
                        src={item.gallery.images?.[2]?.thumb}
                        alt={item.gallery.images?.[2]?.alt}
                        class="w-full h-full object-cover"
                      />
                    )
                    : <div className="w-full h-full bg-gray-200" />}
                </div>
              </div>
            </div>
          )
          : null}
      </a>
    </li>
  );
}

function ProfilePage({
  loggedInUserDid,
  timelineItems,
  profile,
  selectedTab,
  galleries,
}: Readonly<{
  loggedInUserDid?: string;
  timelineItems: TimelineItem[];
  profile: Un$Typed<ProfileView>;
  selectedTab?: string;
  galleries?: GalleryView[];
}>) {
  return (
    <div class="px-4 mb-4" id="profile-page">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between my-4">
        <div class="flex flex-col">
          <AvatarButton profile={profile} />
          <p class="text-2xl font-bold">{profile.displayName}</p>
          <p class="text-gray-600">@{profile.handle}</p>
          <p class="my-2">{profile.description}</p>
        </div>
        {loggedInUserDid === profile.did
          ? (
            <div class="flex self-start gap-2 w-full sm:w-fit flex-col sm:flex-row">
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
              <Button variant="primary" class="w-full sm:w-fit" asChild>
                <a href="/gallery/new">Create Gallery</a>
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
            !selectedTab && "bg-gray-100 font-semibold",
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
            selectedTab === "galleries" && "bg-gray-100",
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
              {timelineItems.map((item) => (
                <TimelineItem item={item} key={item.itemUri} />
              ))}
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
                      <img
                        src={gallery.images?.[0]?.thumb}
                        alt={gallery.images?.[0]?.alt}
                        class="w-full h-full object-cover"
                      />
                      <div class="absolute bottom-0 left-0 bg-black/80 text-white p-2">
                        {(gallery.record as Gallery).title}
                      </div>
                    </a>
                  ))
                )
                : <p>No galleries found</p>}
            </div>
          )
          : null}
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
      <Dialog.Content>
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
              class="input"
              value={profile.displayName}
            />
          </div>
          <div class="mb-4 relative">
            <label htmlFor="description">Description</label>
            <Textarea
              id="description"
              name="description"
              rows={4}
              class="input"
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
        <div class="border rounded-full border-slate-900 w-16 h-16 mx-auto mb-2 relative my-2 cursor-pointer">
          <div class="absolute bottom-0 right-0 bg-slate-800 rounded-full w-5 h-5 flex items-center justify-center z-10">
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
  stars = [],
  currentUserDid,
}: Readonly<{
  gallery: GalleryView;
  stars: WithBffMeta<Star>[];
  currentUserDid?: string;
}>) {
  const isCreator = currentUserDid === gallery.creator.did;
  const isLoggedIn = !!currentUserDid;
  return (
    <div class="px-4">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between my-4 gap-2">
        <div>
          <div>
            <h1 class="font-bold text-2xl">
              {(gallery.record as Gallery).title}
            </h1>
            Gallery by{" "}
            <a
              href={profileLink(gallery.creator.handle)}
              class="hover:underline"
            >
              <span class="font-semibold">{gallery.creator.displayName}</span>
              {" "}
              <span class="text-gray-600">@{gallery.creator.handle}</span>
            </a>
          </div>
          {(gallery.record as Gallery).description}
        </div>
        {isLoggedIn && isCreator
          ? (
            <Button
              variant="primary"
              class="self-start w-full sm:w-fit"
              asChild
            >
              <a
                href={`${
                  galleryLink(
                    gallery.creator.handle,
                    new AtUri(gallery.uri).rkey,
                  )
                }/edit`}
              >
                Edit
              </a>
            </Button>
          )
          : null}
        {!isCreator
          ? (
            <StarButton
              currentUserDid={currentUserDid}
              stars={stars}
              galleryUri={gallery.uri}
            />
          )
          : null}
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        {gallery.images?.length
          ? gallery?.images?.map((image) => (
            <button
              key={image.fullsize}
              type="button"
              hx-get={imageDialogLink(gallery, image)}
              hx-trigger="click"
              hx-target="#layout"
              hx-swap="afterbegin"
              class="cursor-pointer relative sm:aspect-square"
            >
              {isLoggedIn && isCreator
                ? <AltTextButton galleryUri={gallery.uri} cid={image.cid} />
                : null}
              <img
                src={image.fullsize}
                alt={image.alt}
                class="sm:absolute sm:inset-0 w-full h-full sm:object-contain"
              />
              {!isCreator && image.alt
                ? (
                  <div class="absolute bg-black/80 bottom-2 right-2 sm:bottom-0 sm:right-0 text-xs text-white font-semibold py-[1px] px-[3px]">
                    ALT
                  </div>
                )
                : null}
            </button>
          ))
          : null}
      </div>
    </div>
  );
}

function StarButton({
  currentUserDid,
  stars = [],
  galleryUri,
}: Readonly<{
  currentUserDid?: string;
  stars: WithBffMeta<Star>[];
  galleryUri: string;
}>) {
  const starUri = stars.find((s) => currentUserDid === s.did)?.uri;
  return (
    <Button
      variant="primary"
      class="self-start w-full sm:w-fit"
      type="button"
      hx-post={`/actions/star?galleryUri=${galleryUri}${
        starUri ? "&starUri=" + starUri : ""
      }`}
      hx-trigger="click"
      hx-target="this"
      hx-swap="outerHTML"
    >
      <i class={cn("fa-star", starUri ? "fa-solid" : "fa-regular")}></i>{" "}
      {stars.length}
    </Button>
  );
}

function BackBtn({ href }: Readonly<{ href: string }>) {
  return (
    <a href={href} class="w-fit flex items-center gap-1 mb-2">
      <i class="fas fa-arrow-left"></i> Back
    </a>
  );
}

function GalleryCreateEditPage({
  userHandle,
  gallery,
}: Readonly<{ userHandle: string; gallery?: GalleryView | null }>) {
  return (
    <div class="p-4">
      <BackBtn
        href={gallery
          ? galleryLink(gallery.creator.handle, new AtUri(gallery.uri).rkey)
          : profileLink(userHandle)}
      />
      <Header class="mb-2">
        {gallery ? "Edit gallery" : "Create a new gallery"}
      </Header>
      <form
        id="gallery-form"
        class="max-w-xl"
        hx-post={`/actions/create-edit${gallery ? "?uri=" + gallery?.uri : ""}`}
        hx-swap="none"
        _="on htmx:afterOnLoad
            if event.detail.xhr.status != 200
              alert('Error: ' + event.detail.xhr.responseText)"
      >
        <div id="image-cids">
          {(gallery?.record as Gallery).images?.map((image) => (
            <input
              type="hidden"
              name="cids"
              value={image.image.ref.toString()}
            />
          ))}
        </div>
        <div class="mb-4 relative">
          <label htmlFor="title">Gallery name</label>
          <Input
            type="text"
            id="title"
            name="title"
            class="input"
            required
            value={(gallery?.record as Gallery)?.title}
          />
        </div>
        <div class="mb-2 relative">
          <label htmlFor="description">Description</label>
          <Textarea id="description" name="description" rows={4} class="input">
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
        <Button variant="primary" class="mb-2" asChild>
          <label class="w-fit">
            <i class="fa fa-plus"></i> Add images
            <input
              class="hidden"
              type="file"
              multiple
              accept="image/*"
              _="on change
                set fileList to me.files
                if fileList.length > 10
                  alert('You can only upload 10 images')
                  halt
                end
                for file in fileList
                  make a FormData called fd
                  fd.append('file', file)
                  fetch /actions/images/upload-start with { method:'POST', body:fd }
                  then put it at the end of #image-preview
                  then call htmx.process(#image-preview)
                end
                set me.value to ''"
            />
          </label>
        </Button>
        <div id="image-preview" class="w-full h-full grid grid-cols-5 gap-2">
          {gallery?.images?.map((image) => (
            <ImagePreview key={image.cid} src={image.thumb} cid={image.cid} />
          ))}
        </div>
      </div>
      <form id="delete-form" hx-post={`/actions/delete?uri=${gallery?.uri}`}>
        <input type="hidden" name="uri" value={gallery?.uri} />
      </form>
      <div class="flex flex-col gap-2 mt-2">
        <Button
          variant="primary"
          form="gallery-form"
          type="submit"
          class="w-fit"
        >
          {gallery ? "Update gallery" : "Create gallery"}
        </Button>

        {gallery
          ? (
            <Button
              variant="destructive"
              form="delete-form"
              type="submit"
              class="w-fit"
            >
              Delete gallery
            </Button>
          )
          : null}
      </div>
    </div>
  );
}

function ImagePreview({
  src,
  cid,
}: Readonly<{
  src: string;
  cid?: string;
}>) {
  return (
    <div class="relative">
      {cid
        ? (
          <button
            type="button"
            class="bg-black/80 z-10 absolute top-2 right-2 cursor-pointer size-4 flex items-center justify-center"
            _={`on click
              set input to <input[value='${cid}']/>
              if input exists
                remove input
              end
              remove me.parentNode
              halt
            `}
          >
            <i class="fas fa-close text-white"></i>
          </button>
        )
        : null}
      <img
        src={src}
        alt=""
        data-state={cid ? "complete" : "pending"}
        class="w-full h-full object-cover aspect-square data-[state=pending]:opacity-50"
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
      class="bg-black/80 py-[1px] px-[3px] absolute top-2 left-2 sm:top-0 sm:left-0 cursor-pointer flex items-center justify-center text-xs text-white font-semibold z-10"
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

function ImageDialog({
  gallery,
  image,
  nextImage,
  prevImage,
}: Readonly<{
  gallery: GalleryView;
  image: ViewImage;
  nextImage?: ViewImage;
  prevImage?: ViewImage;
}>) {
  return (
    <Dialog id="image-dialog" class="bg-black z-30">
      {nextImage
        ? (
          <div
            hx-get={imageDialogLink(gallery, nextImage)}
            hx-trigger="keyup[key=='ArrowRight'] from:body, swipeleft from:body"
            hx-target="#image-dialog"
            hx-swap="innerHTML"
          />
        )
        : null}
      {prevImage
        ? (
          <div
            hx-get={imageDialogLink(gallery, prevImage)}
            hx-trigger="keyup[key=='ArrowLeft'] from:body, swiperight from:body"
            hx-target="#image-dialog"
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

function ImageAltDialog({
  image,
  galleryUri,
}: Readonly<{
  image: ViewImage;
  galleryUri: string;
}>) {
  return (
    <Dialog id="image-alt-dialog" class="z-30">
      <Dialog.Content>
        <Dialog.Title>Add alt text</Dialog.Title>
        <div class="aspect-square relative bg-gray-100">
          <img
            src={image.fullsize}
            alt={image.alt}
            class="absolute inset-0 w-full h-full object-contain"
          />
        </div>
        <form
          hx-post="/actions/image-alt"
          _="on htmx:afterOnLoad[successful] trigger closeDialog"
        >
          <input type="hidden" name="galleryUri" value={galleryUri} />
          <input type="hidden" name="cid" value={image.cid} />
          <div class="my-2">
            <label htmlFor="alt">Descriptive alt text</label>
            <Textarea
              id="alt"
              name="alt"
              rows={4}
              defaultValue={image.alt}
              placeholder="Alt text"
            />
          </div>
          <div class="w-full flex flex-col gap-2 mt-2">
            <Button type="submit" variant="primary" class="w-full">
              Save
            </Button>
            <Dialog.Close class="w-full">
              Cancel
            </Dialog.Close>
          </div>
        </form>
      </Dialog.Content>
    </Dialog>
  );
}

function UploadOob({ cid }: Readonly<{ cid: string }>) {
  return (
    <div hx-swap-oob="beforeend:#image-cids">
      {cid ? <input key={cid} type="hidden" name="cids" value={cid} /> : null}
    </div>
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
): Un$Typed<GalleryView> {
  return {
    uri: record.uri,
    cid: record.cid,
    creator,
    record,
    images: record?.images?.map((image) =>
      imageToView(new AtUri(record.uri).hostname, image)
    ),
    indexedAt: record.indexedAt,
  };
}

function imageToView(did: string, image: GalleryImage): Un$Typed<ViewImage> {
  return {
    cid: image.image.ref.toString(),
    thumb:
      `https://cdn.bsky.app/img/feed_thumbnail/plain/${did}/${image.image.ref.toString()}@webp`,
    fullsize:
      `https://cdn.bsky.app/img/feed_fullsize/plain/${did}/${image.image.ref.toString()}@webp`,
    alt: image.alt,
    aspectRatio: image.aspectRatio,
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

function imageDialogLink(gallery: GalleryView, image: ViewImage) {
  return `/dialogs/image?galleryUri=${gallery.uri}&imageCid=${image.cid}`;
}

function mergeUniqueImages(
  existingImages: GalleryImage[] | undefined,
  newImages: GalleryImage[],
  validCids?: string[],
): GalleryImage[] {
  if (!existingImages || existingImages.length === 0) {
    return validCids
      ? newImages.filter((img) => validCids.includes(img.image.ref.toString()))
      : newImages;
  }
  const uniqueImagesMap = new Map<string, GalleryImage>();
  existingImages.forEach((img) => {
    const key = img.image.ref.toString();
    uniqueImagesMap.set(key, img);
  });
  newImages.forEach((img) => {
    const key = img.image.ref.toString();
    uniqueImagesMap.set(key, img);
  });
  const mergedImages = [...uniqueImagesMap.values()];
  return validCids
    ? mergedImages.filter((img) => validCids.includes(img.image.ref.toString()))
    : mergedImages;
}

async function onSignedIn({ actor, ctx }: onSignedInArgs) {
  await ctx.backfillCollections(
    [actor.did],
    [...ctx.cfg.collections!, "app.bsky.actor.profile"],
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

function uploadDone(
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

function imageUploadRoutes(): BffMiddleware[] {
  return [
    route(
      `/actions/images/upload-start`,
      ["POST"],
      uploadStart(
        "images",
        ({ dataUrl }) => <ImagePreview src={dataUrl ?? ""} />,
      ),
    ),
    route(
      `/actions/images/upload-check-status`,
      ["GET"],
      uploadCheckStatus(({ uploadId, dataUrl }) => (
        <>
          <input type="hidden" name="uploadId" value={uploadId} />
          <ImagePreview src={dataUrl} />
        </>
      )),
    ),
    route(
      `/actions/images/upload-done`,
      ["GET"],
      uploadDone(({ dataUrl, cid }) => (
        <>
          <UploadOob cid={cid} />
          <ImagePreview src={dataUrl} cid={cid} />
        </>
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
      uploadDone(({ dataUrl, cid }) => (
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
