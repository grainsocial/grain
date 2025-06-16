import { lexicons } from "$lexicon/lexicons.ts";
import { bff, oauth, route } from "@bigmoves/bff";
import { Root } from "./app.tsx";
import { LoginPage } from "./components/LoginPage.tsx";
import { PDS_HOST_URL } from "./env.ts";
import { onError } from "./lib/errors.ts";
import * as actions from "./routes/actions.tsx";
import { handler as communityGuidelinesHandler } from "./routes/community_guidelines.tsx";
import * as dialogs from "./routes/dialogs.tsx";
import { handler as exploreHandler } from "./routes/explore.tsx";
import { handler as followersHandler } from "./routes/followers.tsx";
import { handler as followsHandler } from "./routes/follows.tsx";
import { handler as galleryHandler } from "./routes/gallery.tsx";
import * as legal from "./routes/legal.tsx";
import { handler as notificationsHandler } from "./routes/notifications.tsx";
import { handler as onboardHandler } from "./routes/onboard.tsx";
import { handler as profileHandler } from "./routes/profile.tsx";
import { handler as recordHandler } from "./routes/record.ts";
import { handler as supportHandler } from "./routes/support.tsx";
import { handler as timelineHandler } from "./routes/timeline.tsx";
import { handler as uploadHandler } from "./routes/upload.tsx";
import { appStateMiddleware } from "./state.ts";
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
  lexicons,
  rootElement: Root,
  onError,
  middlewares: [
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
    route("/support/privacy", legal.privacyHandler),
    route("/support/terms", legal.termsHandler),
    route("/support/copyright", legal.copyrightHandler),
    route("/support/community-guidelines", communityGuidelinesHandler),
    route("/dialogs/create-account", dialogs.createAccount),
    route("/dialogs/gallery/new", dialogs.createGallery),
    route("/dialogs/gallery/:rkey", dialogs.editGallery),
    route("/dialogs/gallery/:rkey/photos", dialogs.galleryPhotoSelect),
    route("/dialogs/gallery/:rkey/edit", dialogs.editGalleryDetails),
    route("/dialogs/gallery/:rkey/sort", dialogs.sortGallery),
    route("/dialogs/gallery/:rkey/library", dialogs.galleryAddFromLibrary),
    route("/dialogs/gallery/:did/select", dialogs.gallerySelect),
    route("/dialogs/label/:src/:val", dialogs.labelValueDefinition),
    route("/dialogs/profile", dialogs.editProfile),
    route("/dialogs/avatar/:handle", dialogs.avatar),
    route("/dialogs/image", dialogs.image),
    route("/dialogs/photo/:rkey/remove", dialogs.photoRemove),
    route("/dialogs/photo/:rkey/alt", dialogs.photoAlt),
    route("/dialogs/photo/:rkey/exif", dialogs.photoExif),
    route("/dialogs/photo/:did/:rkey/exif-overlay", dialogs.photoExifOverlay),
    route("/dialogs/exif-info", dialogs.exifInfo),
    route("/actions/update-seen", ["POST"], actions.updateSeen),
    route("/actions/follow/:followeeDid", ["POST"], actions.follow),
    route("/actions/follow/:followeeDid/:rkey", ["DELETE"], actions.unfollow),
    route("/actions/create-edit", ["POST"], actions.galleryCreateEdit),
    route("/actions/gallery/delete", ["POST"], actions.galleryDelete),
    route(
      "/actions/gallery/:rkey/add-photos",
      ["PUT"],
      actions.galleryAddPhotos,
    ),
    route(
      "/actions/gallery/:galleryRkey/add-photo/:photoRkey",
      ["PUT"],
      actions.galleryAddPhoto,
    ),
    route(
      "/actions/gallery/:galleryRkey/remove-photo/:photoRkey",
      ["PUT"],
      actions.galleryRemovePhoto,
    ),
    route("/actions/photo/:rkey", ["PUT"], actions.photoEdit),
    route("/actions/photo/:rkey", ["DELETE"], actions.photoDelete),
    route("/actions/photo", ["POST"], actions.uploadPhoto),
    route("/actions/favorite", ["POST"], actions.galleryFavorite),
    route("/actions/profile", ["PUT"], actions.profileUpdate),
    route("/actions/gallery/:rkey/sort", ["POST"], actions.gallerySort),
    route("/actions/get-blob", ["GET"], actions.getBlob),
    route("/:did/:collection/:rkey", recordHandler),
  ],
});
