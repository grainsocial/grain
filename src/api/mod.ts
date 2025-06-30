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
  OutputSchema as GetTimelineOutputSchema,
  QueryParams as GetTimelineQueryParams,
} from "$lexicon/types/social/grain/feed/getTimeline.ts";
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
  OutputSchema as GetNotificationsOutputSchema,
} from "$lexicon/types/social/grain/notification/getNotifications.ts";
import { AtUri } from "@atproto/syntax";
import { BffMiddleware, route } from "@bigmoves/bff";
import {
  getActorGalleries,
  getActorGalleryFavs,
  getActorProfileDetailed,
  searchActors,
} from "../lib/actor.ts";
import { BadRequestError } from "../lib/errors.ts";
import { getGallery } from "../lib/gallery.ts";
import { getNotifications } from "../lib/notifications.ts";
import { getTimeline } from "../lib/timeline.ts";
import { getGalleryComments } from "../modules/comments.tsx";

export const middlewares: BffMiddleware[] = [
  route("/oauth/session", async (_req, _params, ctx) => {
    if (!ctx.currentUser) {
      return ctx.json("Unauthorized", 401);
    }
    const did = ctx.currentUser.did;
    const profile = getActorProfileDetailed(did, ctx);
    if (!profile) {
      return ctx.json("Profile not found", 404);
    }
    return ctx.json(profile);
  }),
  route("/xrpc/social.grain.actor.getProfile", (req, _params, ctx) => {
    const url = new URL(req.url);
    const { actor } = getProfileQueryParams(url);
    const profile = getActorProfileDetailed(actor, ctx);
    return ctx.json(profile as GetProfileOutputSchema);
  }),
  route("/xrpc/social.grain.gallery.getActorGalleries", (req, _params, ctx) => {
    const url = new URL(req.url);
    const { actor } = getActorGalleriesQueryParams(url);
    const galleries = getActorGalleries(actor, ctx);
    return ctx.json({ items: galleries } as GetActorGalleriesOutputSchema);
  }),
  route("/xrpc/social.grain.actor.getActorFavs", (req, _params, ctx) => {
    const url = new URL(req.url);
    const { actor } = getActorFavsQueryParams(url);
    const galleries = getActorGalleryFavs(actor, ctx);
    return ctx.json({ items: galleries } as GetActorFavsOutputSchema);
  }),
  route("/xrpc/social.grain.gallery.getGallery", (req, _params, ctx) => {
    const url = new URL(req.url);
    const { uri } = getGalleryQueryParams(url);
    const atUri = new AtUri(uri);
    const did = atUri.hostname;
    const rkey = atUri.rkey;
    const gallery = getGallery(did, rkey, ctx);
    if (!gallery) {
      return ctx.json("Gallery not found", 404);
    }
    return ctx.json(gallery as GetGalleryOutputSchema);
  }),
  route("/xrpc/social.grain.gallery.getGalleryThread", (req, _params, ctx) => {
    const url = new URL(req.url);
    const { uri } = getGalleryThreadQueryParams(url);
    const atUri = new AtUri(uri);
    const did = atUri.hostname;
    const rkey = atUri.rkey;
    const gallery = getGallery(did, rkey, ctx);
    if (!gallery) {
      return ctx.json("Gallery not found", 404);
    }
    const comments = getGalleryComments(uri, ctx);
    return ctx.json({ gallery, comments } as GetGalleryThreadOutputSchema);
  }),
  route("/xrpc/social.grain.feed.getTimeline", async (req, _params, ctx) => {
    const url = new URL(req.url);
    const { algorithm } = getTimelineQueryParams(url);
    const items = await getTimeline(
      ctx,
      algorithm === "following" ? "following" : "timeline",
      "grain",
    );
    return ctx.json(
      { feed: items.map((i) => i.gallery) } as GetTimelineOutputSchema,
    );
  }),
  route(
    "/xrpc/social.grain.notification.getNotifications",
    (_req, _params, ctx) => {
      // @TODO: this redirects, we should have a json response
      ctx.requireAuth();
      const notifications = getNotifications(
        ctx,
      );
      return ctx.json(
        { notifications } as GetNotificationsOutputSchema,
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
        { actors: results } as SearchActorsOutputSchema,
      );
    },
  ),
];

function getProfileQueryParams(url: URL): GetProfileQueryParams {
  const actor = url.searchParams.get("actor");
  if (!actor) throw new BadRequestError("Missing actor parameter");
  return { actor };
}

function getActorGalleriesQueryParams(url: URL): GetActorGalleriesQueryParams {
  const actor = url.searchParams.get("actor");
  if (!actor) throw new BadRequestError("Missing actor parameter");
  const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
  if (isNaN(limit) || limit <= 0) {
    throw new BadRequestError("Invalid limit parameter");
  }
  const cursor = url.searchParams.get("cursor") ?? undefined;
  return { actor, limit, cursor };
}

function getActorFavsQueryParams(url: URL): GetActorFavsQueryParams {
  const actor = url.searchParams.get("actor");
  if (!actor) throw new BadRequestError("Missing actor parameter");
  const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
  if (isNaN(limit) || limit <= 0) {
    throw new BadRequestError("Invalid limit parameter");
  }
  const cursor = url.searchParams.get("cursor") ?? undefined;
  return { actor, limit, cursor };
}

function getGalleryQueryParams(url: URL): GetGalleryQueryParams {
  const uri = url.searchParams.get("uri");
  if (!uri) throw new BadRequestError("Missing uri parameter");
  return { uri };
}

function getGalleryThreadQueryParams(url: URL): GetGalleryThreadQueryParams {
  const uri = url.searchParams.get("uri");
  if (!uri) throw new BadRequestError("Missing uri parameter");
  return { uri };
}

function searchActorsQueryParams(url: URL): SearchActorsQueryParams {
  const q = url.searchParams.get("q");
  if (!q) throw new BadRequestError("Missing q parameter");
  const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
  if (isNaN(limit) || limit <= 0) {
    throw new BadRequestError("Invalid limit parameter");
  }
  const cursor = url.searchParams.get("cursor") ?? undefined;
  return { q, limit, cursor };
}

// function getNotificationsQueryParams(url: URL): GetNotificationsQueryParams {
//   const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
//   if (isNaN(limit) || limit <= 0) {
//     throw new BadRequestError("Invalid limit parameter");
//   }
//   const cursor = url.searchParams.get("cursor") ?? undefined;
//   return { limit, cursor };
// }

function getTimelineQueryParams(url: URL): GetTimelineQueryParams {
  const algorithm = url.searchParams.get("algorithm") ?? undefined;
  const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
  if (isNaN(limit) || limit <= 0) {
    throw new BadRequestError("Invalid limit parameter");
  }
  const cursor = url.searchParams.get("cursor") ?? undefined;
  return { algorithm, limit, cursor };
}
