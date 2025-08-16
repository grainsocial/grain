import { lexicons } from "$lexicon/lexicons.ts";
import { Record as EntryRecord } from "$lexicon/types/com/whtwnd/blog/entry.ts";
import { AtUri } from "@atproto/syntax";
import {
  backfillCollections,
  bff,
  JETSTREAM,
  onListenArgs,
  RootProps,
  route,
  WithBffMeta,
} from "@bigmoves/bff";
import { CSS, render } from "@deno/gfm";

type Entry = WithBffMeta<EntryRecord>;

const REPO = "did:plc:44ybard66vv44zksje25o7dz";

bff({
  appName: "AT Protocol Blog",
  collections: ["com.whtwnd.blog.entry"],
  jetstreamUrl: JETSTREAM.WEST_1,
  lexicons,
  rootElement: Root,
  onListen: async ({ indexService, cfg }: onListenArgs) => {
    await backfillCollections(
      indexService,
      cfg,
    )({
      repos: [REPO],
      collections: [],
      externalCollections: ["com.whtwnd.blog.entry"],
    });
  },
  middlewares: [
    route("/", (_req, _params, ctx) => {
      const results = ctx.indexService.getRecords<Entry>(
        "com.whtwnd.blog.entry",
        { orderBy: [{ field: "createdAt", direction: "asc" }] },
      );

      const title = "AT Protocol Blog";
      ctx.state.meta = {
        title: title,
        "og:title": title,
        "twitter:title": title,
      };

      return ctx.render(
        <main>
          <h1>Blog</h1>
          {results.items.map((entry) => {
            return (
              <ul key={entry.uri}>
                <li>
                  <a href={`/posts/${new AtUri(entry.uri).rkey}`}>
                    {entry.title}
                  </a>
                </li>
              </ul>
            );
          })}
        </main>,
      );
    }),
    route("/posts/:rkey", async (_req, params, ctx) => {
      const entry = ctx.indexService.getRecord<Entry>(
        `at://${REPO}/com.whtwnd.blog.entry/${params.rkey}`,
      );

      if (!entry) {
        return ctx.next();
      }

      const atpData = await ctx.didResolver.resolveAtprotoData(entry.did);

      const html = render(entry.content);

      ctx.state.meta = {
        title: entry.title,
        "og:title": entry.title,
        "twitter:title": entry.title,
      };

      return ctx.render(
        <main>
          <br />
          <a href="/">
            Back
          </a>
          <h1>{entry.title}</h1>
          {atpData
            ? (
              <p>
                <span class="text-lg font-bold">@{atpData.handle}</span>,
                {entry.createdAt
                  ? <span class="ml-2">{formatDate(entry.createdAt)}</span>
                  : null}
              </p>
            )
            : null}
          <div
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </main>,
      );
    }),
  ],
});

interface State {
  meta?: {
    title?: string;
    "og:title"?: string;
    "twitter:title"?: string;
  };
}

function Root(props: RootProps<State>) {
  const { ctx, children } = props;
  return (
    <html lang="en" data-color-mode="light" data-dark-theme="light">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <MetaTags meta={ctx.state?.meta} />
        <script src="https://unpkg.com/htmx.org@1.9.10"></script>
        <link rel="stylesheet" href="/build/styles.css" />
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </head>
      <body class="markdown-body max-w-4xl mx-auto px-2">
        {children}
      </body>
    </html>
  );
}

function MetaTags({ meta }: Readonly<{ meta: State["meta"] }>) {
  return (
    <>
      {meta?.title ? <title>{meta?.title}</title> : null}
      {meta?.["og:title"]
        ? <meta name="og:title" content={meta?.["og:title"]} />
        : null}
    </>
  );
}

function formatDate(date: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  return formatter.format(new Date(date));
}
