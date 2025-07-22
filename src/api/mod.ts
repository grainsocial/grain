import { ProfileView } from "$lexicon/types/social/grain/actor/defs.ts";
import {
  OutputSchema as GetActorFavsOutputSchema,
  QueryParams as GetActorFavsQueryParams,
} from "$lexicon/types/social/grain/actor/getActorFavs.ts";
import {
  OutputSchema as GetProfileOutputSchema,
  QueryParams as GetProfileQueryParams,
} from "$lexicon/types/social/grain/actor/getProfile.ts";
import {
  OutputSchema as SearchActorsOutputSchema,
  QueryParams as SearchActorsQueryParams,
} from "$lexicon/types/social/grain/actor/searchActors.ts";
import {
  OutputSchema as UpdateAvatarOutputSchema,
} from "$lexicon/types/social/grain/actor/updateAvatar.ts";
import {
  InputSchema as UpdateProfileInputSchema,
  OutputSchema as UpdateProfileOutputSchema,
} from "$lexicon/types/social/grain/actor/updateProfile.ts";
import {
  InputSchema as CreateCommentInputSchema,
  OutputSchema as CreateCommentOutputSchema,
} from "$lexicon/types/social/grain/comment/createComment.ts";
import {
  InputSchema as DeleteCommentInputSchema,
  OutputSchema as DeleteCommentOutputSchema,
} from "$lexicon/types/social/grain/comment/deleteComment.ts";
import {
  InputSchema as CreateFavoriteInputSchema,
  OutputSchema as CreateFavoriteOutputSchema,
} from "$lexicon/types/social/grain/favorite/createFavorite.ts";
import {
  InputSchema as DeleteFavoriteInputSchema,
  OutputSchema as DeleteFavoriteOutputSchema,
} from "$lexicon/types/social/grain/favorite/deleteFavorite.ts";
import {
  OutputSchema as GetTimelineOutputSchema,
  QueryParams as GetTimelineQueryParams,
} from "$lexicon/types/social/grain/feed/getTimeline.ts";
import {
  InputSchema as ApplySortInputSchema,
  OutputSchema as ApplySortOutputSchema,
} from "$lexicon/types/social/grain/gallery/applySort.ts";
import {
  InputSchema as CreateGalleryInputSchema,
  OutputSchema as CreateGalleryOutputSchema,
} from "$lexicon/types/social/grain/gallery/createGallery.ts";
import {
  InputSchema as CreateGalleryItemInputSchema,
  OutputSchema as CreateGalleryItemOutputSchema,
} from "$lexicon/types/social/grain/gallery/createItem.ts";
import {
  InputSchema as DeleteGalleryInputSchema,
  OutputSchema as DeleteGalleryOutputSchema,
} from "$lexicon/types/social/grain/gallery/deleteGallery.ts";
import {
  InputSchema as DeleteGalleryItemInputSchema,
  OutputSchema as DeleteGalleryItemOutputSchema,
} from "$lexicon/types/social/grain/gallery/deleteItem.ts";
import {
  OutputSchema as GetActorGalleriesOutputSchema,
  QueryParams as GetActorGalleriesQueryParams,
} from "$lexicon/types/social/grain/gallery/getActorGalleries.ts";
import {
  OutputSchema as GetGalleryOutputSchema,
  QueryParams as GetGalleryQueryParams,
} from "$lexicon/types/social/grain/gallery/getGallery.ts";
import {
  OutputSchema as GetGalleryThreadOutputSchema,
  QueryParams as GetGalleryThreadQueryParams,
} from "$lexicon/types/social/grain/gallery/getGalleryThread.ts";
import {
  InputSchema as UpdateGalleryInputSchema,
  OutputSchema as UpdateGalleryOutputSchema,
} from "$lexicon/types/social/grain/gallery/updateGallery.ts";
import {
  InputSchema as CreateFollowInputSchema,
  OutputSchema as CreateFollowOutputSchema,
} from "$lexicon/types/social/grain/graph/createFollow.ts";
import {
  InputSchema as DeleteFollowInputSchema,
  OutputSchema as DeleteFollowOutputSchema,
} from "$lexicon/types/social/grain/graph/deleteFollow.ts";
import {
  OutputSchema as GetFollowersOutputSchema,
  QueryParams as GetFollowersQueryParams,
} from "$lexicon/types/social/grain/graph/getFollowers.ts";
import {
  OutputSchema as GetFollowsOutputSchema,
  QueryParams as GetFollowsQueryParams,
} from "$lexicon/types/social/grain/graph/getFollows.ts";
import {
  OutputSchema as GetNotificationsOutputSchema,
} from "$lexicon/types/social/grain/notification/getNotifications.ts";
import {
  InputSchema as ApplyAltsInputSchema,
  OutputSchema as ApplyAltsOutputSchema,
} from "$lexicon/types/social/grain/photo/applyAlts.ts";
import {
  InputSchema as DeletePhotoInputSchema,
  OutputSchema as DeletePhotoOutputSchema,
} from "$lexicon/types/social/grain/photo/deletePhoto.ts";
import {
  OutputSchema as GetActorPhotosOutputSchema,
  QueryParams as GetActorPhotosQueryParams,
} from "$lexicon/types/social/grain/photo/getActorPhotos.ts";
import {
  OutputSchema as UploadPhotoOutputSchema,
} from "$lexicon/types/social/grain/photo/uploadPhoto.ts";
import { AtUri } from "@atproto/syntax";
import { BffMiddleware, route } from "@bigmoves/bff";
import { imageSize } from "image-size";
import { Buffer } from "node:buffer";
import {
  getActorGalleries,
  getActorGalleryFavs,
  getActorPhotos,
  getActorProfile,
  getActorProfileDetailed,
  searchActors,
  updateActorProfile,
} from "../lib/actor.ts";
import { XRPCError } from "../lib/errors.ts";
import { createFavorite } from "../lib/favs.ts";
import {
  applySort,
  createGallery,
  createGalleryItem,
  deleteGallery,
  getGalleriesByHashtag,
  getGallery,
  updateGallery,
} from "../lib/gallery.ts";
import {
  createFollow,
  getFollowersWithProfiles,
  getFollowingWithProfiles,
} from "../lib/graph.ts";
import { getNotificationsDetailed } from "../lib/notifications.ts";
import { applyAlts, createExif, createPhoto } from "../lib/photo.ts";
import { getTimeline } from "../lib/timeline.ts";
import { createComment, getGalleryComments } from "../modules/comments.tsx";

export const middlewares: BffMiddleware[] = [
  route(
    "/xrpc/social.grain.gallery.createGallery",
    ["POST"],
    async (req, _params, ctx) => {
      ctx.requireAuth();
      const { title, description } = await parseCreateGalleryInputs(req);

      try {
        const galleryUri = await createGallery(ctx, { title, description });
        return ctx.json({ galleryUri } satisfies CreateGalleryOutputSchema);
      } catch (error) {
        console.error("Error creating gallery:", error);
        throw new XRPCError("InternalServerError", "Failed to create gallery");
      }
    },
  ),
  route(
    "/xrpc/social.grain.gallery.updateGallery",
    ["POST"],
    async (req, _params, ctx) => {
      ctx.requireAuth();
      const { galleryUri, title, description } = await parseUpdateGalleryInputs(
        req,
      );
      const success = await updateGallery(ctx, galleryUri, {
        title,
        description,
      });
      return ctx.json(
        { success } satisfies UpdateGalleryOutputSchema,
      );
    },
  ),
  route(
    "/xrpc/social.grain.gallery.deleteGallery",
    ["POST"],
    async (req, _params, ctx) => {
      ctx.requireAuth();
      const { uri } = await parseDeleteGalleryInputs(
        req,
      );
      const success = await deleteGallery(uri, ctx);
      return ctx.json({ success } satisfies DeleteGalleryOutputSchema);
    },
  ),
  route(
    "/xrpc/social.grain.gallery.createItem",
    ["POST"],
    async (req, _params, ctx) => {
      ctx.requireAuth();
      const { galleryUri, photoUri } = await parseCreateGalleryItemInputs(req);
      const createdItemUri = await createGalleryItem(
        ctx,
        galleryUri,
        photoUri,
      );
      if (!createdItemUri) {
        return ctx.json(
          { message: "Failed to create gallery item" },
          400,
        );
      }
      return ctx.json(
        { itemUri: createdItemUri } satisfies CreateGalleryItemOutputSchema,
      );
    },
  ),
  route(
    "/xrpc/social.grain.gallery.deleteItem",
    ["POST"],
    async (req, _params, ctx) => {
      ctx.requireAuth();
      const { uri } = await parseDeleteGalleryItemInputs(req);
      try {
        await ctx.deleteRecord(uri);
      } catch (error) {
        console.error("Error deleting gallery item:", error);
        return ctx.json(
          { success: false } satisfies DeleteGalleryItemOutputSchema,
        );
      }
      return ctx.json(
        { success: true } satisfies DeleteGalleryItemOutputSchema,
      );
    },
  ),
  route(
    "/xrpc/social.grain.photo.uploadPhoto",
    ["POST"],
    async (req, _params, ctx) => {
      ctx.requireAuth();
      if (!ctx.agent) {
        return ctx.json(
          { message: "Unauthorized" },
          401,
        );
      }

      const bytes = await req.arrayBuffer();
      if (!bytes || bytes.byteLength === 0) {
        throw new XRPCError("InvalidRequest", "Missing blob");
      }
      const MAX_SIZE = 1024 * 1024; // 1MB
      if (bytes.byteLength > MAX_SIZE) {
        throw new XRPCError(
          "PayloadTooLarge",
          "request entity too large",
        );
      }
      const { width, height } = imageSize(Buffer.from(bytes));
      const res = await ctx.agent.uploadBlob(new Uint8Array(bytes));
      if (!res.success) {
        return ctx.json(
          { message: "Failed to upload photo" },
          500,
        );
      }
      const blobRef = res.data.blob;
      const photoUri = await createPhoto(
        {
          photo: blobRef,
          alt: "", // @TODO: make this optional
          aspectRatio: {
            width,
            height,
          },
        },
        ctx,
      );
      return ctx.json({ photoUri } as UploadPhotoOutputSchema);
    },
  ),
  route(
    "/xrpc/social.grain.photo.createExif",
    ["POST"],
    async (req, _params, ctx) => {
      ctx.requireAuth();
      const exifData = await parseExifInputs(req);
      const exifUri = await createExif(
        exifData,
        ctx,
      );
      if (!exifUri) {
        return ctx.json(
          { message: "Failed to create EXIF data" },
          500,
        );
      }
      return ctx.json({ exifUri });
    },
  ),
  route(
    "/xrpc/social.grain.photo.deletePhoto",
    ["POST"],
    async (req, _params, ctx) => {
      ctx.requireAuth();
      const { uri } = await parseDeletePhotoInputs(req);
      try {
        await ctx.deleteRecord(uri);
        return ctx.json({ success: true } satisfies DeletePhotoOutputSchema);
      } catch (error) {
        console.error("Error deleting photo:", error);
        return ctx.json({ success: false } satisfies DeletePhotoOutputSchema);
      }
    },
  ),
  route(
    "/xrpc/social.grain.graph.createFollow",
    ["POST"],
    async (req, _params, ctx) => {
      const { did } = ctx.requireAuth();
      const { subject } = await parseCreateFollowInputs(req);
      if (!subject) {
        throw new XRPCError("InvalidRequest", "Missing subject input");
      }
      try {
        const followUri = await createFollow(did, subject, ctx);
        return ctx.json({ followUri } satisfies CreateFollowOutputSchema);
      } catch (error) {
        console.error("Error creating follow:", error);
        throw new XRPCError("InternalServerError", "Failed to create follow");
      }
    },
  ),
  route(
    "/xrpc/social.grain.graph.deleteFollow",
    ["POST"],
    async (req, _params, ctx) => {
      ctx.requireAuth();
      const { uri } = await parseDeleteFollowInputs(req);
      try {
        await ctx.deleteRecord(uri);
        return ctx.json({ success: true } satisfies DeleteFollowOutputSchema);
      } catch (error) {
        console.error("Error deleting follow:", error);
        return ctx.json({ success: false } satisfies DeleteFollowOutputSchema);
      }
    },
  ),
  route(
    "/xrpc/social.grain.favorite.createFavorite",
    ["POST"],
    async (req, _params, ctx) => {
      ctx.requireAuth();
      const { subject } = await parseCreateFavoriteInputs(req);
      try {
        const favoriteUri = await createFavorite(subject, ctx);
        return ctx.json({ favoriteUri } as CreateFavoriteOutputSchema);
      } catch (error) {
        console.error("Error creating favorite:", error);
        throw new XRPCError("InternalServerError", "Failed to create favorite");
      }
    },
  ),
  route(
    "/xrpc/social.grain.favorite.deleteFavorite",
    ["POST"],
    async (req, _params, ctx) => {
      ctx.requireAuth();
      const { uri } = await parseDeleteFavoriteInputs(req);
      try {
        await ctx.deleteRecord(uri);
        return ctx.json({ success: true });
      } catch (error) {
        console.error("Error deleting favorite:", error);
        return ctx.json({ success: false } as DeleteFavoriteOutputSchema);
      }
    },
  ),
  route(
    "/xrpc/social.grain.comment.createComment",
    ["POST"],
    async (req, _params, ctx) => {
      ctx.requireAuth();
      const { text, subject, focus, replyTo } = await parseCreateCommentInputs(
        req,
      );
      try {
        const commentUri = await createComment(
          {
            text,
            subject,
            focus,
            replyTo,
          },
          ctx,
        );
        return ctx.json({ commentUri } satisfies CreateCommentOutputSchema);
      } catch (error) {
        console.error("Error creating comment:", error);
        throw new XRPCError("InternalServerError", "Failed to create comment");
      }
    },
  ),
  route(
    "/xrpc/social.grain.comment.deleteComment",
    ["POST"],
    async (req, _params, ctx) => {
      ctx.requireAuth();
      const { uri } = await parseDeleteCommentInputs(req);
      try {
        await ctx.deleteRecord(uri);
        return ctx.json({ success: true } satisfies DeleteCommentOutputSchema);
      } catch (error) {
        console.error("Error deleting comment:", error);
        return ctx.json({ success: false } satisfies DeleteCommentOutputSchema);
      }
    },
  ),
  route(
    "/xrpc/social.grain.actor.updateProfile",
    ["POST"],
    async (req, _params, ctx) => {
      const { did } = ctx.requireAuth();
      const { displayName, description } = await parseUpdateProfileInputs(req);
      try {
        await updateActorProfile(did, ctx, { displayName, description });
      } catch (error) {
        console.error("Error updating profile:", error);
        ctx.json({ success: false } satisfies UpdateProfileOutputSchema);
      }
      return ctx.json({ success: true } satisfies UpdateProfileOutputSchema);
    },
  ),
  route(
    "/xrpc/social.grain.actor.updateAvatar",
    ["POST"],
    async (req, _params, ctx) => {
      const { did } = ctx.requireAuth();
      const bytes = await req.arrayBuffer();
      if (!bytes || bytes.byteLength === 0) {
        throw new XRPCError("InvalidRequest", "Missing avatar blob");
      }
      const MAX_SIZE = 1024 * 1024; // 1MB
      if (bytes.byteLength > MAX_SIZE) {
        throw new XRPCError(
          "PayloadTooLarge",
          "request entity too large",
        );
      }
      if (!ctx.agent) {
        throw new XRPCError("AuthenticationRequired");
      }
      const res = await ctx.agent.uploadBlob(new Uint8Array(bytes));
      if (!res.success) {
        throw new XRPCError("InternalServerError", "Failed to upload avatar");
      }
      const avatarBlob = res.data.blob;
      try {
        await updateActorProfile(did, ctx, { avatar: avatarBlob });
      } catch (error) {
        console.error("Error updating profile:", error);
        throw new XRPCError("InternalServerError", "Failed to update profile");
      }
      return ctx.json({ success: true } satisfies UpdateAvatarOutputSchema);
    },
  ),
  route(
    "/xrpc/social.grain.photo.applyAlts",
    ["POST"],
    async (req, _params, ctx) => {
      ctx.requireAuth();
      const { writes } = await parseApplyAltsInputs(req);
      const success = await applyAlts(writes, ctx);
      return ctx.json({ success } satisfies ApplyAltsOutputSchema);
    },
  ),
  route(
    "/xrpc/social.grain.gallery.applySort",
    ["POST"],
    async (req, _params, ctx) => {
      ctx.requireAuth();
      const { writes } = await parseApplySortInputs(req);
      const success = await applySort(writes, ctx);
      return ctx.json({ success } satisfies ApplySortOutputSchema);
    },
  ),
  route("/xrpc/social.grain.actor.getProfile", (req, _params, ctx) => {
    const url = new URL(req.url);
    const { actor } = getProfileQueryParams(url);
    const profile = getActorProfileDetailed(actor, ctx);
    if (!profile) {
      throw new XRPCError("NotFound", "Profile not found");
    }
    return ctx.json(profile satisfies GetProfileOutputSchema);
  }),
  route("/xrpc/social.grain.gallery.getActorGalleries", (req, _params, ctx) => {
    const url = new URL(req.url);
    const { actor } = getActorGalleriesQueryParams(url);
    const galleries = getActorGalleries(actor, ctx);
    return ctx.json(
      { items: galleries } satisfies GetActorGalleriesOutputSchema,
    );
  }),
  route("/xrpc/social.grain.actor.getActorFavs", (req, _params, ctx) => {
    const url = new URL(req.url);
    const { actor } = getActorFavsQueryParams(url);
    const galleries = getActorGalleryFavs(actor, ctx);
    return ctx.json({ items: galleries } satisfies GetActorFavsOutputSchema);
  }),
  route("/xrpc/social.grain.photo.getActorPhotos", (req, _params, ctx) => {
    const url = new URL(req.url);
    const { actor } = getActorPhotosQueryParams(url);
    const photos = getActorPhotos(actor, ctx);
    return ctx.json({ items: photos } satisfies GetActorPhotosOutputSchema);
  }),
  route("/xrpc/social.grain.gallery.getGallery", (req, _params, ctx) => {
    const url = new URL(req.url);
    const { uri } = getGalleryQueryParams(url);
    const atUri = new AtUri(uri);
    const did = atUri.hostname;
    const rkey = atUri.rkey;
    const gallery = getGallery(did, rkey, ctx);
    if (!gallery) {
      throw new XRPCError("NotFound", "Gallery not found");
    }
    return ctx.json(gallery satisfies GetGalleryOutputSchema);
  }),
  route("/xrpc/social.grain.gallery.getGalleryThread", (req, _params, ctx) => {
    const url = new URL(req.url);
    const { uri } = getGalleryThreadQueryParams(url);
    const atUri = new AtUri(uri);
    const did = atUri.hostname;
    const rkey = atUri.rkey;
    const gallery = getGallery(did, rkey, ctx);
    if (!gallery) {
      throw new XRPCError("NotFound", "Gallery not found");
    }
    const comments = getGalleryComments(uri, ctx);
    return ctx.json(
      { gallery, comments } satisfies GetGalleryThreadOutputSchema,
    );
  }),
  route("/xrpc/social.grain.feed.getTimeline", async (req, _params, ctx) => {
    const url = new URL(req.url);
    const { algorithm } = getTimelineQueryParams(url);

    if (algorithm?.includes("hashtag")) {
      const tag = algorithm.split("hashtag_")[1];

      const galleries = getGalleriesByHashtag(tag, ctx);

      return ctx.json(
        { feed: galleries } satisfies GetTimelineOutputSchema,
      );
    }

    const items = await getTimeline(
      ctx,
      algorithm === "following" ? "following" : "timeline",
      "grain",
    );
    return ctx.json(
      { feed: items.map((i) => i.gallery) } satisfies GetTimelineOutputSchema,
    );
  }),
  route(
    "/xrpc/social.grain.notification.getNotifications",
    (_req, _params, ctx) => {
      // @TODO: this redirects, we should have a json response
      ctx.requireAuth();
      const notifications = getNotificationsDetailed(
        ctx,
      );
      return ctx.json(
        { notifications } satisfies GetNotificationsOutputSchema,
      );
    },
  ),
  route(
    "/xrpc/social.grain.actor.searchActors",
    (req, _params, ctx) => {
      const url = new URL(req.url);
      const { q } = searchActorsQueryParams(url);
      let results: ProfileView[] = [];
      if (!q) {
        results = [];
      } else {
        results = searchActors(
          q,
          ctx,
        );
      }
      return ctx.json(
        { actors: results } satisfies SearchActorsOutputSchema,
      );
    },
  ),
  route("/xrpc/social.grain.graph.getFollows", (req, _params, ctx) => {
    const url = new URL(req.url);
    const { actor } = getFollowsQueryParams(url);
    const subject = getActorProfile(actor, ctx);
    if (!subject) {
      throw new XRPCError("NotFound", "Actor not found");
    }
    const follows = getFollowingWithProfiles(actor, ctx);
    return ctx.json(
      {
        subject,
        follows,
      } satisfies GetFollowsOutputSchema,
    );
  }),
  route("/xrpc/social.grain.graph.getFollowers", (req, _params, ctx) => {
    const url = new URL(req.url);
    const { actor } = getFollowersQueryParams(url);
    const subject = getActorProfile(actor, ctx);
    if (!subject) {
      throw new XRPCError("NotFound", "Subject not found");
    }
    const followers = getFollowersWithProfiles(actor, ctx);
    return ctx.json(
      {
        subject,
        followers,
      } satisfies GetFollowersOutputSchema,
    );
  }),
  route(
    "/xrpc/social.grain.notification.updateSeen",
    ["POST"],
    async (req, _params, ctx) => {
      ctx.requireAuth();
      const json = await req.json();
      const seenAt = json.seenAt satisfies string ?? undefined;
      if (!seenAt) {
        throw new XRPCError("InvalidRequest", "Missing seenAt input");
      }
      ctx.updateSeen(seenAt);
      return ctx.json(null);
    },
  ),
];

function getProfileQueryParams(url: URL): GetProfileQueryParams {
  const actor = url.searchParams.get("actor");
  if (!actor) throw new XRPCError("InvalidRequest", "Missing actor parameter");
  return { actor };
}

function getActorGalleriesQueryParams(url: URL): GetActorGalleriesQueryParams {
  const actor = url.searchParams.get("actor");
  if (!actor) throw new XRPCError("InvalidRequest", "Missing actor parameter");
  const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
  if (isNaN(limit) || limit <= 0) {
    throw new XRPCError("InvalidRequest", "Invalid limit parameter");
  }
  const cursor = url.searchParams.get("cursor") ?? undefined;
  return { actor, limit, cursor };
}

function getActorFavsQueryParams(url: URL): GetActorFavsQueryParams {
  const actor = url.searchParams.get("actor");
  if (!actor) throw new XRPCError("InvalidRequest", "Missing actor parameter");
  const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
  if (isNaN(limit) || limit <= 0) {
    throw new XRPCError("InvalidRequest", "Invalid limit parameter");
  }
  const cursor = url.searchParams.get("cursor") ?? undefined;
  return { actor, limit, cursor };
}

function getActorPhotosQueryParams(url: URL): GetActorPhotosQueryParams {
  const actor = url.searchParams.get("actor");
  if (!actor) throw new XRPCError("InvalidRequest", "Missing actor parameter");
  const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
  if (isNaN(limit) || limit <= 0) {
    throw new XRPCError("InvalidRequest", "Invalid limit parameter");
  }
  const cursor = url.searchParams.get("cursor") ?? undefined;
  return { actor, limit, cursor };
}

function getGalleryQueryParams(url: URL): GetGalleryQueryParams {
  const uri = url.searchParams.get("uri");
  if (!uri) throw new XRPCError("InvalidRequest", "Missing uri parameter");
  return { uri };
}

function getGalleryThreadQueryParams(url: URL): GetGalleryThreadQueryParams {
  const uri = url.searchParams.get("uri");
  if (!uri) throw new XRPCError("InvalidRequest", "Missing uri parameter");
  return { uri };
}

function searchActorsQueryParams(url: URL): SearchActorsQueryParams {
  const q = url.searchParams.get("q");
  if (!q) throw new XRPCError("InvalidRequest", "Missing q parameter");
  const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
  if (isNaN(limit) || limit <= 0) {
    throw new XRPCError("InvalidRequest", "Invalid limit parameter");
  }
  const cursor = url.searchParams.get("cursor") ?? undefined;
  return { q, limit, cursor };
}

function getFollowsQueryParams(url: URL): GetFollowsQueryParams {
  const actor = url.searchParams.get("actor");
  if (!actor) throw new XRPCError("InvalidRequest", "Missing actor parameter");
  const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
  if (isNaN(limit) || limit <= 0) {
    throw new XRPCError("InvalidRequest", "Invalid limit parameter");
  }
  const cursor = url.searchParams.get("cursor") ?? undefined;
  return { actor, limit, cursor };
}

function getFollowersQueryParams(url: URL): GetFollowersQueryParams {
  const actor = url.searchParams.get("actor");
  if (!actor) throw new XRPCError("InvalidRequest", "Missing actor parameter");
  const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
  if (isNaN(limit) || limit <= 0) {
    throw new XRPCError("InvalidRequest", "Invalid limit parameter");
  }
  const cursor = url.searchParams.get("cursor") ?? undefined;
  return { actor, limit, cursor };
}

function getTimelineQueryParams(url: URL): GetTimelineQueryParams {
  const algorithm = url.searchParams.get("algorithm") ?? undefined;
  const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
  if (isNaN(limit) || limit <= 0) {
    throw new XRPCError("InvalidRequest", "Invalid limit parameter");
  }
  const cursor = url.searchParams.get("cursor") ?? undefined;
  return { algorithm, limit, cursor };
}

async function parseCreateGalleryInputs(
  req: Request,
): Promise<CreateGalleryInputSchema> {
  const body = await req.json();
  const title = typeof body.title === "string" ? body.title : undefined;
  if (!title) {
    throw new XRPCError("InvalidRequest", "Missing title input");
  }
  const description = typeof body.description === "string"
    ? body.description
    : undefined;
  return { title, description };
}

async function parseUpdateGalleryInputs(
  req: Request,
): Promise<UpdateGalleryInputSchema> {
  const body = await req.json();
  const title = typeof body.title === "string" ? body.title : undefined;
  if (!title) {
    throw new XRPCError("InvalidRequest", "Missing title input");
  }
  const description = typeof body.description === "string"
    ? body.description
    : undefined;
  const galleryUri = typeof body.galleryUri === "string"
    ? body.galleryUri
    : undefined;
  if (!galleryUri) {
    throw new XRPCError("InvalidRequest", "Missing galleryUri input");
  }
  return { title, description, galleryUri };
}

async function parseDeleteGalleryInputs(
  req: Request,
): Promise<DeleteGalleryInputSchema> {
  const body = await req.json();
  const uri = typeof body.uri === "string" ? body.uri : undefined;
  if (!uri) {
    throw new XRPCError("InvalidRequest", "Missing uri input");
  }
  return { uri };
}

async function parseCreateGalleryItemInputs(
  req: Request,
): Promise<CreateGalleryItemInputSchema> {
  const body = await req.json();
  const galleryUri = typeof body.galleryUri === "string"
    ? body.galleryUri
    : undefined;
  if (!galleryUri) {
    throw new XRPCError("InvalidRequest", "Missing galleryUri input");
  }
  const photoUri = typeof body.photoUri === "string"
    ? body.photoUri
    : undefined;
  if (!photoUri) {
    throw new XRPCError("InvalidRequest", "Missing photoUri input");
  }
  const position = typeof body.position === "number"
    ? body.position
    : undefined;
  if (position === undefined) {
    throw new XRPCError("InvalidRequest", "Missing position input");
  }
  return { galleryUri, photoUri, position };
}

async function parseDeleteGalleryItemInputs(
  req: Request,
): Promise<DeleteGalleryItemInputSchema> {
  const body = await req.json();
  const uri = typeof body.uri === "string" ? body.uri : undefined;
  if (!uri) {
    throw new XRPCError("InvalidRequest", "Missing uri input");
  }
  return { uri };
}

async function parseDeletePhotoInputs(
  req: Request,
): Promise<DeletePhotoInputSchema> {
  const body = await req.json();
  const uri = typeof body.uri === "string" ? body.uri : undefined;
  if (!uri) {
    throw new XRPCError("InvalidRequest", "Missing uri input");
  }
  return { uri };
}

async function parseCreateFollowInputs(
  req: Request,
): Promise<CreateFollowInputSchema> {
  const body = await req.json();
  const subject = typeof body.subject === "string" ? body.subject : undefined;
  if (!subject) {
    throw new XRPCError("InvalidRequest", "Missing subject input");
  }
  return { subject };
}

async function parseDeleteFollowInputs(
  req: Request,
): Promise<DeleteFollowInputSchema> {
  const body = await req.json();
  const uri = typeof body.uri === "string" ? body.uri : undefined;
  if (!uri) {
    throw new XRPCError("InvalidRequest", "Missing uri input");
  }
  return { uri };
}

async function parseCreateFavoriteInputs(
  req: Request,
): Promise<CreateFavoriteInputSchema> {
  const body = await req.json();
  const subject = typeof body.subject === "string" ? body.subject : undefined;
  if (!subject) {
    throw new XRPCError("InvalidRequest", "Missing subject input");
  }
  return { subject };
}

async function parseDeleteFavoriteInputs(
  req: Request,
): Promise<DeleteFavoriteInputSchema> {
  const body = await req.json();
  const uri = typeof body.uri === "string" ? body.uri : undefined;
  if (!uri) {
    throw new XRPCError("InvalidRequest", "Missing uri input");
  }
  return { uri };
}

async function parseCreateCommentInputs(
  req: Request,
): Promise<CreateCommentInputSchema> {
  const body = await req.json();
  const text = typeof body.text === "string" ? body.text : undefined;
  if (!text) {
    throw new XRPCError("InvalidRequest", "Missing text input");
  }
  const subject = typeof body.subject === "string" ? body.subject : undefined;
  if (!subject) {
    throw new XRPCError("InvalidRequest", "Missing subject input");
  }
  const focus = typeof body.focus === "string" ? body.focus : undefined;
  const replyTo = typeof body.replyTo === "string" ? body.replyTo : undefined;
  return { text, subject, focus, replyTo };
}

async function parseDeleteCommentInputs(
  req: Request,
): Promise<DeleteCommentInputSchema> {
  const body = await req.json();
  const uri = typeof body.uri === "string" ? body.uri : undefined;
  if (!uri) {
    throw new XRPCError("InvalidRequest", "Missing uri input");
  }
  return { uri };
}

async function parseUpdateProfileInputs(
  req: Request,
): Promise<UpdateProfileInputSchema> {
  const body = await req.json();
  const displayName = typeof body.displayName === "string"
    ? body.displayName
    : undefined;
  if (!displayName) {
    throw new XRPCError("InvalidRequest", "Missing displayName input");
  }
  const description = typeof body.description === "string"
    ? body.description
    : undefined;
  return { displayName, description };
}

async function parseApplyAltsInputs(
  req: Request,
): Promise<ApplyAltsInputSchema> {
  const body = await req.json();
  if (!body || typeof body !== "object" || !Array.isArray(body.writes)) {
    throw new XRPCError("InvalidRequest", "Missing or invalid writes array");
  }
  const writes = Array.isArray(body.writes)
    ? body.writes.filter(
      (item: unknown): item is { photoUri: string; alt: string } =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { photoUri?: unknown }).photoUri === "string" &&
        typeof (item as { alt?: unknown }).alt === "string",
    )
    : [];
  return { writes };
}

async function parseApplySortInputs(
  req: Request,
): Promise<ApplySortInputSchema> {
  const body = await req.json();
  const writes = Array.isArray(body.writes) && body.writes.every(
      (item: unknown): item is { itemUri: string; position: number } =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { itemUri?: unknown }).itemUri === "string" &&
        typeof (item as { position?: unknown }).position === "number",
    )
    ? body.writes
    : [];
  return { writes };
}

async function parseExifInputs(
  req: Request,
): Promise<{
  photo: string;
  dateTimeOriginal?: string;
  exposureTime?: number;
  fNumber?: number;
  flash?: string;
  focalLengthIn35mmFormat?: number;
  iSO?: number;
  lensMake?: string;
  lensModel?: string;
  make?: string;
  model?: string;
}> {
  const body = await req.json();
  const photo = typeof body.photo === "string" ? body.photo : undefined;
  if (!photo) {
    throw new XRPCError("InvalidRequest", "Missing photo input");
  }
  const dateTimeOriginal = typeof body.dateTimeOriginal === "string"
    ? body.dateTimeOriginal
    : undefined;
  const exposureTime = typeof body.exposureTime === "number"
    ? body.exposureTime
    : undefined;
  const fNumber = typeof body.fNumber === "number" ? body.fNumber : undefined;
  const flash = typeof body.flash === "string" ? body.flash : undefined;
  const focalLengthIn35mmFormat =
    typeof body.focalLengthIn35mmFormat === "number"
      ? body.focalLengthIn35mmFormat
      : undefined;
  const iSO = typeof body.iSO === "number" ? body.iSO : undefined;
  const lensMake = typeof body.lensMake === "string"
    ? body.lensMake
    : undefined;
  const lensModel = typeof body.lensModel === "string"
    ? body.lensModel
    : undefined;
  const make = typeof body.make === "string" ? body.make : undefined;
  const model = typeof body.model === "string" ? body.model : undefined;

  return {
    photo,
    dateTimeOriginal,
    exposureTime,
    fNumber,
    flash,
    focalLengthIn35mmFormat,
    iSO,
    lensMake,
    lensModel,
    make,
    model,
  };
}
