import { CSS, RootProps } from "@bigmoves/bff";
import { Meta } from "@bigmoves/bff/components";
import { Layout } from "./components/Layout.tsx";
import { GOATCOUNTER_URL } from "./env.ts";
import type { State } from "./state.ts";

export function Root(props: Readonly<RootProps<State>>) {
  const profile = props.ctx.state.profile;
  const hasNotifications =
    props.ctx.state.notifications?.find((n) => n.isRead === false) !==
      undefined;
  return (
    <html lang="en" class="h-full">
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
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <link
          rel="stylesheet"
          href={`/build/styles.css?${
            props.ctx.fileFingerprints.get("styles.css")
          }`}
        />
        <link
          rel="stylesheet"
          href="https://unpkg.com/@fortawesome/fontawesome-free@6.7.2/css/all.min.css"
          preload
        />
        <script
          type="module"
          key="app.esm.js"
          src={`/build/app.esm.js?${
            props.ctx.fileFingerprints.get("app.esm.js")
          }`}
        />
      </head>
      <body class="h-full dark:bg-zinc-950 dark:text-white">
        <Layout id="layout">
          <Layout.Nav
            heading={
              <h1 class="font-['Jersey_20'] text-4xl text-zinc-900 dark:text-white">
                grain
                <sub class="bottom-[0.75rem] text-[1rem]">beta</sub>
              </h1>
            }
            profile={profile}
            hasNotifications={hasNotifications}
          />
          <Layout.Content>{props.children}</Layout.Content>
        </Layout>
      </body>
    </html>
  );
}
