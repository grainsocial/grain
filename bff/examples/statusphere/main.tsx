import { lexicons } from "$lexicon/lexicons.ts";
import { Record as StatusRecord } from "$lexicon/types/xyz/statusphere/status.ts";
import { Un$Typed } from "$lexicon/util.ts";
import {
  bff,
  JETSTREAM,
  oauth,
  OAUTH_ROUTES,
  RootProps,
  route,
  UnauthorizedError,
  WithBffMeta,
} from "@bigmoves/bff";

type Status = WithBffMeta<StatusRecord>;

bff({
  appName: "Statusphere",
  collections: ["xyz.statusphere.status"],
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
    oauth({
      LoginComponent: Login,
    }),
    route("/", async (_req, _params, ctx) => {
      let profile = undefined;
      const currentUser = ctx.currentUser;
      const { items: statuses } = ctx.indexService.getRecords<Status>(
        "xyz.statusphere.status",
      );

      if (currentUser?.did) {
        const response = await ctx.agent?.getProfile({
          actor: currentUser.did,
        });
        profile = { displayName: response?.data?.displayName };
      }

      const didHandleMap: Record<string, string> = {};
      for (const status of statuses) {
        if (status.did) {
          const atpData = await ctx.didResolver.resolveAtprotoData(
            status.did,
          );
          if (!atpData) {
            console.error(`Failed to resolve handle for DID: ${status.did}`);
            continue;
          }
          didHandleMap[status.did] = atpData.handle;
        }
      }

      return ctx.render(
        <Home
          statuses={statuses}
          didHandleMap={didHandleMap}
          profile={profile}
        />,
      );
    }),
    route("/status", ["POST"], async (req, _params, ctx) => {
      ctx.requireAuth();
      const formData = await req.formData();
      const status = formData.get("status") as string;

      await ctx.createRecord<Un$Typed<StatusRecord>>(
        "xyz.statusphere.status",
        {
          status,
          createdAt: new Date().toISOString(),
        },
      );

      return new Response(null, {
        status: 303,
        headers: {
          "HX-Redirect": "/",
        },
      });
    }),
  ],
});

function Root(props: RootProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <script src="https://unpkg.com/htmx.org@1.9.10"></script>
        <link rel="stylesheet" href="/build/styles.css" />
      </head>
      <body>{props.children}</body>
    </html>
  );
}

function Login({ error }: Readonly<{ error?: string }>) {
  return (
    <div id="root">
      <div id="header">
        <h1>Statusphere</h1>
        <p>Set your status on the Atmosphere.</p>
      </div>
      <div class="container">
        <form
          hx-post={OAUTH_ROUTES.login}
          hx-target="#root"
          hx-swap="outerHTML"
          class="login-form"
        >
          <input
            type="text"
            name="handle"
            placeholder="Enter your handle (eg alice.bsky.social)"
            required
          />
          <button type="submit">Log in</button>
          {error
            ? (
              <p>
                Error: <i>{error}</i>
              </p>
            )
            : undefined}
        </form>
        <div class="signup-cta">
          Don't have an account on the Atmosphere?{" "}
          <a href="https://bsky.app">Sign up for Bluesky</a> to create one now!
        </div>
      </div>
    </div>
  );
}

function Home({ statuses, didHandleMap, profile, myStatus }: Readonly<{
  statuses: Status[];
  didHandleMap: Record<string, string>;
  profile?: { displayName?: string };
  myStatus?: Status;
}>) {
  return (
    <div id="root">
      <div class="error"></div>
      <div id="header">
        <h1>Statusphere</h1>
        <p>Set your status on the Atmosphere.</p>
      </div>
      <div class="container">
        <div class="card">
          {profile
            ? (
              <form
                hx-post={OAUTH_ROUTES.logout}
                hx-swap="none"
                class="session-form"
              >
                <div>
                  Hi,{" "}
                  <strong>{profile.displayName || "friend"}</strong>. What's
                  your status today?
                </div>
                <div>
                  <button type="submit">Log out</button>
                </div>
              </form>
            )
            : (
              <div class="session-form">
                <div>
                  <a href={OAUTH_ROUTES.loginPage}>
                    Log in
                  </a>{" "}
                  to set your status!
                </div>
                <div>
                  <a
                    href={OAUTH_ROUTES.loginPage}
                    class="button"
                  >
                    Log in
                  </a>
                </div>
              </div>
            )}
        </div>
        <form hx-post="/status" class="status-options">
          {STATUS_OPTIONS.map((status) => (
            <button
              type="submit"
              class={myStatus?.status === status
                ? "status-option selected"
                : "status-option"}
              name="status"
              value={status}
            >
              {status}
            </button>
          ))}
        </form>
        {statuses.map((status, i) => {
          const handle = didHandleMap[status.did] || status.did;
          const date = ts(status);
          return (
            <div class={i === 0 ? "status-line no-line" : "status-line"}>
              <div>
                <div class="status">{status.status}</div>
              </div>
              <div class="desc">
                <a class="author" href={toBskyLink(handle)}>
                  @{handle}
                </a>{" "}
                {date === TODAY
                  ? `is feeling ${status.status} today`
                  : `was feeling ${status.status} on ${date}`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const TODAY = new Date().toDateString();

const STATUS_OPTIONS = [
  "👍",
  "👎",
  "💙",
  "🥹",
  "😧",
  "😤",
  "🙃",
  "😉",
  "😎",
  "🤓",
  "🤨",
  "🥳",
  "😭",
  "😤",
  "🤯",
  "🫡",
  "💀",
  "✊",
  "🤘",
  "👀",
  "🧠",
  "👩‍💻",
  "🧑‍💻",
  "🥷",
  "🧌",
  "🦋",
  "🚀",
];

function toBskyLink(did: string) {
  return `https://bsky.app/profile/${did}`;
}

function ts(status: Status) {
  const createdAt = new Date(status.createdAt);
  const indexedAt = new Date(status.indexedAt);
  if (createdAt < indexedAt) return createdAt.toDateString();
  return indexedAt.toDateString();
}
