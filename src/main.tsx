import { lexicons } from "$lexicon/lexicons.ts";
import { bff, BffContext, JETSTREAM, oauth, route } from "@bigmoves/bff";
import { Root } from "./app.tsx";
import { LoginPage } from "./components/LoginPage.tsx";
import { PDS_HOST_URL } from "./env.ts";
import { onError } from "./lib/errors.ts";
import * as actionHandlers from "./routes/actions.tsx";
import { handler as communityGuidelinesHandler } from "./routes/community_guidelines.tsx";
import * as dialogHandlers from "./routes/dialogs.tsx";
import { handler as exploreHandler } from "./routes/explore.tsx";
import { handler as followersHandler } from "./routes/followers.tsx";
import { handler as followsHandler } from "./routes/follows.tsx";
import { handler as galleryHandler } from "./routes/gallery.tsx";
import * as legalHandlers from "./routes/legal.tsx";
import { handler as notificationsHandler } from "./routes/notifications.tsx";
import { handler as onboardHandler } from "./routes/onboard.tsx";
import { handler as profileHandler } from "./routes/profile.tsx";
import { handler as recordHandler } from "./routes/record.ts";
import { handler as supportHandler } from "./routes/support.tsx";
import { handler as timelineHandler } from "./routes/timeline.tsx";
import { handler as uploadHandler } from "./routes/upload.tsx";
import { appStateMiddleware, type State } from "./state.ts";
import { onSignedIn } from "./utils.ts";

bff({
  appName: "Grain Social",
  appLabelers: ["did:plc:nd45zozo34cr4pvxqu4rtr7e"],
  appLabelerCollection: "social.grain.labeler.service",
  collections: [
    "social.grain.actor.profile",
    "social.grain.gallery",
    "social.grain.gallery.item",
    "social.grain.photo",
    "social.grain.photo.exif",
    "social.grain.favorite",
    "social.grain.graph.follow",
  ],
  externalCollections: [
    "app.bsky.actor.profile",
    "app.bsky.graph.follow",
    "sh.tangled.actor.profile",
    "sh.tangled.graph.follow",
  ],
  jetstreamUrl: JETSTREAM.WEST_1,
  lexicons,
  rootElement: Root,
  onError,
  middlewares: [
    (_req, ctx: BffContext<State>) => {
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
    route("/profile/:handle/followers", followersHandler),
    route("/profile/:handle/follows", followsHandler),
    route("/profile/:handle/gallery/:rkey", galleryHandler),
    route("/upload", uploadHandler),
    route("/onboard", onboardHandler),
    route("/support", supportHandler),
    route("/support/privacy", legalHandlers.privacyHandler),
    route("/support/terms", legalHandlers.termsHandler),
    route("/support/copyright", legalHandlers.copyrightHandler),
    route("/support/community-guidelines", communityGuidelinesHandler),
    route("/dialogs/create-account", dialogHandlers.createAccount),
    route("/dialogs/gallery/new", dialogHandlers.createGallery),
    route("/dialogs/gallery/:rkey", dialogHandlers.editGallery),
    route("/dialogs/gallery/:rkey/sort", dialogHandlers.sortGallery),
    route("/dialogs/label/:src/:val", dialogHandlers.labelValueDefinition),
    route("/dialogs/profile", dialogHandlers.editProfile),
    route("/dialogs/avatar/:handle", dialogHandlers.avatar),
    route("/dialogs/image", dialogHandlers.image),
    route("/dialogs/photo/:rkey/alt", dialogHandlers.photoAlt),
    route(
      "/dialogs/photo/:rkey/exif",
      dialogHandlers.photoExif,
    ),
    route(
      "/dialogs/photo/:rkey/exif-overlay",
      dialogHandlers.photoExifOverlay,
    ),
    route(
      "/dialogs/exif-info",
      dialogHandlers.exifInfo,
    ),
    route(
      "/dialogs/photo-select/:galleryRkey",
      dialogHandlers.galleryPhotoSelect,
    ),
    route("/actions/update-seen", ["POST"], actionHandlers.updateSeen),
    route("/actions/follow/:followeeDid", ["POST"], actionHandlers.follow),
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
    route("/actions/photo", ["POST"], actionHandlers.uploadPhoto),
    route("/actions/favorite", ["POST"], actionHandlers.galleryFavorite),
    route("/actions/profile", ["PUT"], actionHandlers.profileUpdate),
    route(
      "/actions/gallery/:rkey/sort",
      ["POST"],
      actionHandlers.gallerySort,
    ),
    route("/actions/get-blob", ["GET"], actionHandlers.getBlob),
    route("/:did/:collection/:rkey", recordHandler),
  ],
});
