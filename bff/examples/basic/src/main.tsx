import { lexicons } from "$lexicon/lexicons.ts";
import { bff, JETSTREAM, oauth } from "@bigmoves/bff";
import { Login } from "@bigmoves/bff/components";
import { Root } from "./app.tsx";
import { routes } from "./routes.tsx";
import { onSignedIn, profileStateResolver } from "./utils.ts";

bff({
  appName: "AT Protocol App",
  collections: ["dev.fly.bffbasic.profile"],
  jetstreamUrl: JETSTREAM.WEST_1,
  databaseUrl: "basic.db",
  lexicons,
  rootElement: Root,
  middlewares: [
    profileStateResolver,
    oauth({
      onSignedIn,
      LoginComponent: ({ error }) => (
        <div id="login" class="flex justify-center items-center w-full h-full">
          <Login hx-target="#login" error={error} />
        </div>
      ),
    }),
    ...routes,
  ],
});
