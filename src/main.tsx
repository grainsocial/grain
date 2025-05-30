import { lexicons } from "$lexicon/lexicons.ts";
import { bff, BffContext, JETSTREAM, oauth, route } from "@bigmoves/bff";
import { Root } from "./app.tsx";
import { LoginPage } from "./components/LoginPage.tsx";
import { PDS_HOST_URL } from "./env.ts";
import { onError } from "./lib/errors.ts";
import * as actionHandlers from "./routes/actions.tsx";
import * as dialogHandlers from "./routes/dialogs.tsx";
import { handler as exploreHandler } from "./routes/explore.tsx";
import { handler as galleryHandler } from "./routes/gallery.tsx";
import { handler as notificationsHandler } from "./routes/notifications.tsx";
import { handler as onboardHandler } from "./routes/onboard.tsx";
import { handler as profileHandler } from "./routes/profile.tsx";
import { handler as recordHandler } from "./routes/record.ts";
import { handler as timelineHandler } from "./routes/timeline.tsx";
import { handler as uploadHandler } from "./routes/upload.tsx";
import { appStateMiddleware, type State } from "./state.ts";
import { generateStaticFilesHash, onSignedIn } from "./utils.ts";

let staticFilesHash = new Map<string, string>();

bff({
  appName: "Grain Social",
  collections: [
    "social.grain.gallery",
    "social.grain.actor.profile",
    "social.grain.photo",
    "social.grain.favorite",
    "social.grain.gallery.item",
  ],
  externalCollections: [
    "app.bsky.actor.profile",
    "app.bsky.graph.follow",
  ],
  jetstreamUrl: JETSTREAM.WEST_1,
  lexicons,
  rootElement: Root,
  onListen: async () => {
    staticFilesHash = await generateStaticFilesHash();
  },
  onError,
  middlewares: [
    (_req, ctx: BffContext<State>) => {
      ctx.state.staticFilesHash = staticFilesHash;
      return ctx.next();
    },
    appStateMiddleware,
    oauth({
      onSignedIn,
      LoginComponent: LoginPage,
      createAccountPdsHost: PDS_HOST_URL,
    }),
    route("/", timelineHandler),
    route("/explore", exploreHandler),
    route("/notifications", notificationsHandler),
    route("/profile/:handle", profileHandler),
    route("/profile/:handle/gallery/:rkey", galleryHandler),
    route("/upload", uploadHandler),
    route("/onboard", onboardHandler),
    route("/dialogs/gallery/new", dialogHandlers.createGallery),
    route("/dialogs/gallery/:rkey", dialogHandlers.editGallery),
    route("/dialogs/gallery/:rkey/sort", dialogHandlers.sortGallery),
    route("/dialogs/profile", dialogHandlers.editProfile),
    route("/dialogs/avatar/:handle", dialogHandlers.avatar),
    route("/dialogs/image", dialogHandlers.image),
    route("/dialogs/photo/:rkey/alt", dialogHandlers.photoAlt),
    route(
      "/dialogs/photo-select/:galleryRkey",
      dialogHandlers.galleryPhotoSelect,
    ),
    route("/actions/update-seen", ["POST"], actionHandlers.updateSeen),
    route("/actions/follow/:did", ["POST"], actionHandlers.follow),
    route(
      "/actions/follow/:followeeDid/:rkey",
      ["DELETE"],
      actionHandlers.unfollow,
    ),
    route("/actions/create-edit", ["POST"], actionHandlers.galleryCreateEdit),
    route("/actions/gallery/delete", ["POST"], actionHandlers.galleryDelete),
    route(
      "/actions/gallery/:galleryRkey/add-photo/:photoRkey",
      ["PUT"],
      actionHandlers.galleryAddPhoto,
    ),
    route(
      "/actions/gallery/:galleryRkey/remove-photo/:photoRkey",
      ["PUT"],
      actionHandlers.galleryRemovePhoto,
    ),
    route("/actions/photo/:rkey", ["PUT"], actionHandlers.photoEdit),
    route("/actions/photo/:rkey", ["DELETE"], actionHandlers.photoDelete),
    route("/actions/favorite", ["POST"], actionHandlers.galleryFavorite),
    route("/actions/profile/update", ["POST"], actionHandlers.profileUpdate),
    route(
      "/actions/gallery/:rkey/sort",
      ["POST"],
      actionHandlers.gallerySort,
    ),
    route("/actions/get-blob", ["GET"], actionHandlers.getBlob),
    route("/actions/photo/upload", ["POST"], actionHandlers.uploadPhoto),
    route("/:did/:collection/:rkey", recordHandler),
  ],
});
