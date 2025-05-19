import { CSS, RootProps } from "@bigmoves/bff";
import { Layout, Meta } from "@bigmoves/bff/components";
import { GOATCOUNTER_URL } from "./env.ts";
import type { State } from "./state.ts";

export function Root(props: Readonly<RootProps<State>>) {
  const profile = props.ctx.state.profile;
  const scripts = props.ctx.state.scripts;
  const hasNotifications =
    props.ctx.state.notifications?.find((n) => n.isRead === false) !==
      undefined;
  const staticFilesHash = props.ctx.state.staticFilesHash;
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
        <link
          rel="stylesheet"
          href={`/static/styles.css?${staticFilesHash?.get("styles.css")}`}
        />
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
        {scripts?.map((file) => (
          <script
            key={file}
            src={`/static/${file}?${staticFilesHash?.get(file)}`}
          />
        ))}
      </head>
      <body class="h-full w-full dark:bg-zinc-950 dark:text-white">
        <Layout id="layout" class="border-zinc-200 dark:border-zinc-800">
          <Layout.Nav
            heading={
              <h1 class="font-['Jersey_20'] text-4xl text-zinc-900 dark:text-white">
                grain
                <sub class="bottom-[0.75rem] text-[1rem]">beta</sub>
              </h1>
            }
            profile={profile}
            hasNotifications={hasNotifications}
            class="border-zinc-200 dark:border-zinc-800"
          />
          <Layout.Content>{props.children}</Layout.Content>
        </Layout>
      </body>
    </html>
  );
}
