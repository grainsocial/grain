import { Record as Profile } from "$lexicon/types/social/grain/actor/profile.ts";
import { Record as Favorite } from "$lexicon/types/social/grain/favorite.ts";
import { Record as Gallery } from "$lexicon/types/social/grain/gallery.ts";
import { Record as GalleryItem } from "$lexicon/types/social/grain/gallery/item.ts";
import { Record as Photo } from "$lexicon/types/social/grain/photo.ts";
import { AtUri } from "@atproto/syntax";
import { BffContext, RouteHandler, WithBffMeta } from "@bigmoves/bff";
import { BadRequestError, NotFoundError, ServerError } from "../lib/errors.ts";
import type { State } from "../state.ts";
import { galleryLink } from "../utils.ts";

export const handler: RouteHandler = (
  req,
  params,
  ctx: BffContext<State>,
) => {
  const url = new URL(req.url);
  const { did, collection, rkey } = params;

  if (url.pathname.includes("/build/")) {
    return ctx.next(); // ignore build assets
  }

  if (!did || !collection || !rkey) {
    throw new BadRequestError("Invalid parameters for record handler");
  }

  if (!did.startsWith("did:")) {
    throw new NotFoundError();
  }

  const actor = ctx.indexService.getActor(did);
  if (!actor) {
    throw new NotFoundError(
      `Actor not found or missing handle for did: ${did}`,
    );
  }

  switch (collection) {
    case "social.grain.actor.profile": {
      if (rkey !== "self") {
        throw new NotFoundError(`Invalid rkey for actor profile: ${rkey}`);
      }
      const profile = ctx.indexService.getRecord<WithBffMeta<Profile>>(
        `at://${did}/social.grain.actor.profile/${rkey}`,
      );
      if (!profile) {
        throw new NotFoundError(
          `Profile not found for did: ${did}, rkey: ${rkey}`,
        );
      }
      return ctx.redirect(`/profile/${actor.handle}`);
    }

    case "social.grain.gallery": {
      const gallery = ctx.indexService.getRecord<WithBffMeta<Gallery>>(
        `at://${did}/social.grain.gallery/${rkey}`,
      );
      if (!gallery) {
        throw new NotFoundError(
          `Gallery not found for did: ${did}, rkey: ${rkey}`,
        );
      }
      return ctx.redirect(galleryLink(
        actor.handle,
        new AtUri(gallery.uri).rkey,
      ));
    }

    case "social.grain.gallery.item": {
      const galleryItem = ctx.indexService.getRecord<WithBffMeta<GalleryItem>>(
        `at://${did}/social.grain.gallery.item/${rkey}`,
      );
      if (!galleryItem) {
        throw new NotFoundError(
          `Gallery item not found for did: ${did}, rkey: ${rkey}`,
        );
      }
      const photo = ctx.indexService.getRecord<WithBffMeta<Photo>>(
        galleryItem.item,
      );
      if (!photo) {
        throw new NotFoundError(
          `Photo not found for gallery item: ${galleryItem.item}`,
        );
      }
      return ctx.redirect(
        `/actions/get-blob?did=${did}&cid=${photo.photo.ref.toString()}`,
      );
    }

    case "social.grain.photo": {
      const photo = ctx.indexService.getRecord<WithBffMeta<Photo>>(
        `at://${did}/social.grain.photo/${rkey}`,
      );
      if (!photo) {
        throw new NotFoundError(
          `Photo not found for did: ${did}, rkey: ${rkey}`,
        );
      }
      return ctx.redirect(
        `/actions/get-blob?did=${did}&cid=${photo.photo.ref.toString()}`,
      );
    }

    case "social.grain.favorite": {
      const favorite = ctx.indexService.getRecord<WithBffMeta<Favorite>>(
        `at://${did}/social.grain.favorite/${rkey}`,
      );
      if (!favorite) {
        throw new NotFoundError(
          `Favorite not found for did: ${did}, rkey: ${rkey}`,
        );
      }
      const subjectActor = ctx.indexService.getActor(
        new AtUri(favorite.subject).hostname,
      );
      if (!subjectActor) {
        throw new NotFoundError(
          `Subject actor not found or missing handle for subject: ${favorite.subject}`,
        );
      }
      return ctx.redirect(
        galleryLink(subjectActor.handle, new AtUri(favorite.subject).rkey),
      );
    }

    default:
      throw new ServerError(`Unsupported collection: ${collection}`);
  }
};
