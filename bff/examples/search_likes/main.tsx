import { lexicons } from "$lexicon/lexicons.ts";
import { ProfileViewBasic } from "$lexicon/types/app/bsky/actor/defs.ts";
import { Record as Profile } from "$lexicon/types/app/bsky/actor/profile.ts";
import { isMain as isImages } from "$lexicon/types/app/bsky/embed/images.ts";
import { Record as Like } from "$lexicon/types/app/bsky/feed/like.ts";
import { Record as Post } from "$lexicon/types/app/bsky/feed/post.ts";
import { Un$Typed } from "$lexicon/util.ts";
import { AtUri } from "@atproto/syntax";
import {
  bff,
  BffContext,
  CSS,
  oauth,
  onSignedInArgs,
  RootProps,
  route,
  WithBffMeta,
} from "@bigmoves/bff";
import { Button, Input, Layout, Login } from "@bigmoves/bff/components";

// NOTE: More of a proof of concept. Expensive to gather all related post records across the network.
// Though you only need to pull the post records once, and then you can query the index service.
bff({
  appName: "AT Protocol | Search Bsky Likes App",
  databaseUrl: "likes.db",
  lexicons,
  rootElement: Root,
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
      LoginComponent: ({ error }) => (
        <div id="login" class="flex justify-center items-center w-full h-full">
          <Login hx-target="#login" error={error} />
        </div>
      ),
      onSignedIn: async ({ actor, ctx }: onSignedInArgs) => {
        await ctx.backfillCollections({
          repos: [actor.did],
          collections: [],
          externalCollections: ["app.bsky.feed.like", "app.bsky.actor.profile"],
        });
        const { items: likes } = ctx.indexService.getRecords<WithBffMeta<Like>>(
          "app.bsky.feed.like",
        );
        // posts
        await ctx.backfillUris(
          likes.map((l) => l.subject.uri.toString()),
        );
        // profiles
        await ctx.backfillUris(
          likes.map((l) =>
            `at://${
              new AtUri(l.subject.uri).hostname
            }/app.bsky.actor.profile/self`
          ),
        );
        return "/";
      },
    }),
    route("/likes", (req, _params, ctx) => {
      const url = new URL(req.url);
      const search = url.searchParams.get("search");
      const did = ctx.currentUser?.did;
      if (!did) {
        return ctx.redirect("/login");
      }

      const { items: likes } = ctx.indexService.getRecords<WithBffMeta<Like>>(
        "app.bsky.feed.like",
        {
          orderBy: [{ field: "createdAt", direction: "desc" }],
          where: [{ field: "did", contains: did }],
        },
      );

      const { items: profiles } = ctx.indexService.getRecords<
        WithBffMeta<Profile>
      >(
        "app.bsky.actor.profile",
        {
          where: [{
            field: "did",
            in: likes.map((l) => new AtUri(l.subject.uri).hostname),
          }],
        },
      );

      const postUris = likes.map((l) => l.subject.uri.toString());

      let posts: WithBffMeta<Post>[] = [];

      if (search) {
        const results = ctx.indexService.getRecords<WithBffMeta<Post>>(
          "app.bsky.feed.post",
          {
            where: [
              { field: "uri", in: postUris },
              { field: "text", contains: search },
            ],
          },
        );
        posts = results.items;
      } else {
        const results = ctx.indexService.getRecords<WithBffMeta<Post>>(
          "app.bsky.feed.post",
          {
            where: [{ field: "uri", in: postUris }],
          },
        );
        posts = results.items;
      }

      const profilesByDid = new Map(
        profiles.map((profile) => [profile.did, profile]),
      );
      const profileMap = new Map(
        posts.map((post) => {
          const did = new AtUri(post.uri).hostname;
          const profile = profilesByDid.get(did);
          return [post.uri, profile];
        }),
      );
      const handleMap = new Map(
        posts.map((post) => {
          const did = new AtUri(post.uri).hostname;
          const actor = ctx.indexService.getActor(did);
          return [post.uri, actor?.handle ?? ""];
        }),
      );

      const postAuthor = (post: WithBffMeta<Post>) => {
        const profile = profileMap.get(post.uri);
        if (profile) {
          return (
            <img
              src={`https://cdn.bsky.app/img/feed_thumbnail/plain/${profile.did}/${profile?.avatar?.ref.toString()}`}
              alt=""
              title={profile.displayName}
              class="w-8 h-8 rounded-full mr-2"
            />
          );
        }
        return null;
      };

      const postEmbed = (post: WithBffMeta<Post>) => {
        const embed = post.embed;
        if (embed?.$type === "app.bsky.embed.images" && isImages(embed)) {
          return (
            <div class="flex items-center gap-2">
              {embed.images.map((i) => (
                <img
                  src={imageThumb(
                    post.did,
                    i.image.ref.toString(),
                  )}
                  alt=""
                  class="w-16 h-16 object-cover"
                />
              ))}
            </div>
          );
        }
        return null;
      };

      const postsByUri = new Map(posts.map((post) => [post.uri, post]));
      const orderedPosts = postUris
        .map((uri) => postsByUri.get(uri))
        .filter((post): post is WithBffMeta<Post> => post !== undefined);

      return ctx.html(
        <ul class="space-y-2">
          {orderedPosts.map((p) => (
            <li key={p.uri}>
              <a
                class="flex"
                href={postLink(p, handleMap.get(p.uri) ?? "")}
              >
                {postAuthor(p)}
                <div>
                  <p>{p.text}</p>
                  <p>{postEmbed(p)}</p>
                </div>
              </a>
            </li>
          ))}
        </ul>,
      );
    }),
    route("/", (_req, _params, ctx) => {
      const did = ctx.currentUser?.did;
      if (!did) {
        return ctx.redirect("/login");
      }
      return ctx.render(
        <>
          <form hx-get="/likes" hx-target="#likes" class="mb-4 flex gap-2">
            <Input
              type="text"
              name="search"
              placeholder="Search posts..."
              class="w-[300px]"
            />
            <Button variant="primary" type="submit">Search</Button>
          </form>
          <div id="likes" hx-get="/likes" hx-target="this" hx-trigger="load" />
        </>,
      );
    }),
  ],
});

export type State = {
  profile?: ProfileViewBasic;
};

function Root(props: Readonly<RootProps<State>>) {
  const profile = props.ctx.state.profile;
  return (
    <html lang="en" class="w-full h-full">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <script src="https://unpkg.com/htmx.org@1.9.10"></script>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <link rel="stylesheet" href="/build/styles.css" />
      </head>
      <body class="h-full w-full">
        <Layout>
          <Layout.Nav
            heading={
              <h1 class="text-2xl font-semibold">
                <span className="text-sky-600">@</span> likes
              </h1>
            }
            profile={profile}
          />
          <Layout.Content class="p-4">
            {props.children}
          </Layout.Content>
        </Layout>
      </body>
    </html>
  );
}

function getActorProfile(did: string, ctx: BffContext) {
  const actor = ctx.indexService.getActor(did);
  if (!actor) return null;
  const profileRecord = ctx.indexService.getRecord<WithBffMeta<Profile>>(
    `at://${did}/app.bsky.actor.profile/self`,
  );
  return profileRecord ? profileToView(profileRecord, actor.handle) : null;
}

function profileToView(
  record: WithBffMeta<Profile>,
  handle: string,
): Un$Typed<ProfileViewBasic> {
  return {
    did: record.did,
    handle,
    displayName: record.displayName,
    avatar: record?.avatar
      ? `https://cdn.bsky.app/img/feed_thumbnail/plain/${record.did}/${record.avatar.ref.toString()}`
      : undefined,
  };
}

function postLink(
  post: WithBffMeta<Post>,
  handle: string,
) {
  return `https://bsky.app/profile/${handle}/post/${new AtUri(post.uri).rkey}`;
}

function imageThumb(
  did: string,
  cid: string,
) {
  return `https://cdn.bsky.app/img/feed_thumbnail/plain/${did}/${cid}@jpeg`;
}
