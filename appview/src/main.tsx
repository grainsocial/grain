import { lexicons } from "$lexicon/lexicons.ts";
import { aip, bff, route } from "@bigmoves/bff";
import { middlewares as xrpcApi } from "./api/mod.ts";
import { Root } from "./app.tsx";
import { LoginPage } from "./components/LoginPage.tsx";
import { PDS_HOST_URL } from "./env.ts";
import { onError } from "./lib/errors.ts";
import { middlewares as comments } from "./modules/comments.tsx";
import * as actions from "./routes/actions.tsx";
import { handler as communityGuidelinesHandler } from "./routes/community_guidelines.tsx";
import * as dialogs from "./routes/dialogs.tsx";
import { handler as exploreHandler } from "./routes/explore.tsx";
import { handler as followersHandler } from "./routes/followers.tsx";
import { handler as followsHandler } from "./routes/follows.tsx";
import { handler as galleryHandler } from "./routes/gallery.tsx";
import { handler as hashtagHandler } from "./routes/hashtag.tsx";
import * as legal from "./routes/legal.tsx";
import { handler as notificationsHandler } from "./routes/notifications.tsx";
import { handler as onboardHandler } from "./routes/onboard.tsx";
import { handler as profileHandler } from "./routes/profile.tsx";
import { handler as recordHandler } from "./routes/record.ts";
import { handler as robotsHandler } from "./routes/robots.tsx";
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
    "social.grain.comment",
  ],
  externalCollections: [
    "app.bsky.actor.profile",
    "app.bsky.graph.follow",
    "sh.tangled.actor.profile",
    "sh.tangled.graph.follow",
  ],
  collectionKeyMap: {
    "social.grain.favorite": ["subject"],
    "social.grain.graph.follow": ["subject"],
    "social.grain.gallery.item": ["gallery", "item"],
    "social.grain.photo.exif": ["photo"],
    "social.grain.comment": ["subject"],
  },
  // Used to exchange jwt token with mobile app
  tokenCallbackUrl: "grainflutter://auth/callback",
  lexicons,
  rootElement: Root,
  onError,
  middlewares: [
    (req, ctx) => {
      console.log(`${req.method} ${req.url}`);
      console.log("Headers:", Object.fromEntries(req.headers.entries()));
      return ctx.next();
    },
    aip({
      onSignedIn,
      LoginComponent: LoginPage,
      createAccountPdsHost: PDS_HOST_URL,
    }),
    ...xrpcApi,
    appStateMiddleware,

    // API test endpoints
    route("/api/test/whoami", ["GET"], async (req, _params, ctx) => {
      try {
        const user = await ctx.requireToken(req);
        return new Response(
          JSON.stringify({
            success: true,
            message: "API auth working!",
            user,
          }),
          {
            headers: { "Content-Type": "application/json" },
          },
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Authentication failed",
            message: error instanceof Error ? error.message : String(error),
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }),
    route("/api/test/session", ["GET"], async (req, _params, ctx) => {
      try {
        const user = await ctx.requireToken(req);
        const sessionData = await ctx.getATProtoSession(req);
        return new Response(
          JSON.stringify({
            success: true,
            user: {
              did: user.did,
              handle: user.handle,
              indexedAt: user.indexedAt,
            },
            session: sessionData,
          }),
          {
            headers: { "Content-Type": "application/json" },
          },
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Authentication failed",
            message: error instanceof Error ? error.message : String(error),
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }),
    route("/api/test/public", ["GET"], () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: "This is a public endpoint - no auth required",
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    }),
    route("/", timelineHandler),
    route("/explore", exploreHandler),
    route("/notifications", notificationsHandler),
    route("/profile/:handleOrDid", profileHandler),
    route("/profile/:handle/followers", followersHandler),
    route("/profile/:handle/follows", followsHandler),
    route("/profile/:handle/gallery/:rkey", galleryHandler),
    route("/hashtag/:tag", hashtagHandler),
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
    route("/dialogs/:creatorDid/gallery/:rkey/share", dialogs.galleryShare),
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
    route(
      "/actions/:creatorDid/gallery/:rkey/favorite",
      ["POST"],
      actions.galleryFavorite,
    ),
    route(
      "/actions/:creatorDid/gallery/:rkey/favorite/:favRkey",
      ["DELETE"],
      actions.galleryUnfavorite,
    ),
    route("/actions/profile", ["PUT"], actions.profileUpdate),
    route("/actions/gallery/:rkey/sort", ["POST"], actions.gallerySort),
    route("/actions/get-blob", ["GET"], actions.getBlob),
    ...comments,
    route("/:did/:collection/:rkey", recordHandler),
    route("/robots.txt", robotsHandler),
  ],
});
