import { ProfileView } from "$lexicon/types/dev/fly/bffbasic/defs.ts";
import { CSS, RootProps } from "@bigmoves/bff";
import { Layout } from "@bigmoves/bff/components";

export type State = {
  profile?: ProfileView;
};

export function Root(props: RootProps<State>) {
  return (
    <html lang="en" class="w-full h-full">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link
          rel="stylesheet"
          href="https://unpkg.com/@fortawesome/fontawesome-free@6.7.2/css/all.min.css"
          preload
        />
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <link
          rel="stylesheet"
          href={`/build/styles.css?${
            props.ctx.fileFingerprints.get(
              "styles.css",
            )
          }`}
        />
        <script
          type="module"
          src={`/build/app.esm.js?${
            props.ctx.fileFingerprints.get("app.esm.js")
          }`}
        />
      </head>
      <body>
        <Layout>
          <Layout.Nav
            heading={
              <h1 class="text-2xl font-semibold">
                <span className="text-sky-600">@</span> bff
              </h1>
            }
            profile={props.ctx.state.profile}
          />
          <Layout.Content>
            {props.children}
          </Layout.Content>
        </Layout>
      </body>
    </html>
  );
}
