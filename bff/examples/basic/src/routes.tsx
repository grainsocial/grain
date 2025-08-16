import { BffMiddleware, route } from "@bigmoves/bff";
import { NotFoundPage } from "./components/NotFoundPage.tsx";
import { handler as dialogsAvatar } from "./routes/dialogs_avatar.tsx";
import { handler as dialogsProfile } from "./routes/dialogs_profile.tsx";
import { handler as index } from "./routes/index.tsx";
import { handler as onboard } from "./routes/onboard.tsx";
import { handler as profile } from "./routes/profile.tsx";
import { handler as profileUpdate } from "./routes/profile_update.tsx";

export const routes: BffMiddleware[] = [
  // pages
  route("/", index),
  route("/profile/:handle", profile),
  route("/onboard", onboard),

  // handlers
  route("/profile", ["PUT"], profileUpdate),

  // ui
  route("/dialogs/profile", dialogsProfile),
  route("/dialogs/avatar/:handle", dialogsAvatar),

  // not found
  route("*", ["GET"], (req, _params, ctx) => {
    const { pathname } = new URL(req.url);
    if (pathname.startsWith("/build/")) {
      return ctx.next();
    }
    return ctx.render(
      <NotFoundPage />,
    );
  }),
];
