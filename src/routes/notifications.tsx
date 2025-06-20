import { Record as Comment } from "$lexicon/types/social/grain/comment.ts";
import { CommentView } from "$lexicon/types/social/grain/comment/defs.ts";
import { Record as Favorite } from "$lexicon/types/social/grain/favorite.ts";
import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { NotificationView } from "$lexicon/types/social/grain/notification/defs.ts";
import {
  isPhotoView,
  PhotoView,
} from "$lexicon/types/social/grain/photo/defs.ts";
import { Un$Typed } from "$lexicon/util.ts";
import { BffContext, RouteHandler } from "@bigmoves/bff";
import { NotificationsPage } from "../components/NotificationsPage.tsx";
import { getGalleriesBulk } from "../lib/gallery.ts";
import { getPhotosBulk } from "../lib/photo.ts";
import { getCommentsBulk } from "../modules/comments.tsx";
import type { State } from "../state.ts";

export const handler: RouteHandler = (
  _req,
  _params,
  ctx: BffContext<State>,
) => {
  ctx.requireAuth();
  ctx.state.meta = [
    { title: "Notifications — Grain" },
  ];
  const galleryUris = getGalleriesUrisForNotifications(
    ctx.state.notifications ?? [],
  );
  const galleries = getGalleriesBulk(galleryUris, ctx);
  const galleriesMap = new Map<string, GalleryView>();
  for (const gallery of galleries) {
    galleriesMap.set(gallery.uri, gallery);
  }
  const photoUris = getPhotoUrisForNotifications(
    ctx.state.notifications ?? [],
  );
  const photos = getPhotosBulk(photoUris, ctx);
  const photosMap = new Map<string, PhotoView>();
  for (const photo of photos) {
    photosMap.set(photo.uri, photo);
  }
  const commentUris = getReplyToUrisForNotifications(
    ctx.state.notifications ?? [],
  );
  const comments = getCommentsBulk(commentUris, ctx);
  const commentsMap = new Map<string, CommentView>();
  for (const comment of comments) {
    commentsMap.set(comment.uri, comment);
    if (isPhotoView(comment.focus)) {
      photosMap.set(comment.focus.uri, comment.focus);
    }
  }
  return ctx.render(
    <NotificationsPage
      photosMap={photosMap}
      galleriesMap={galleriesMap}
      commentsMap={commentsMap}
      notifications={ctx.state.notifications ?? []}
    />,
  );
};

type WithSubject = Favorite | Comment;

function getGalleriesUrisForNotifications(
  notifications: Un$Typed<NotificationView>[],
): string[] {
  const uris = notifications
    .filter((n) =>
      n.record.$type === "social.grain.favorite" ||
      n.record.$type === "social.grain.comment"
    )
    .filter((n) =>
      (n.record as WithSubject).subject.includes("social.grain.gallery")
    )
    .map((n) => (n.record as WithSubject).subject);
  return uris;
}

function getPhotoUrisForNotifications(
  notifications: Un$Typed<NotificationView>[],
): string[] {
  return notifications
    .filter((n) => n.record.$type === "social.grain.comment")
    .map((n) => (n.record as Comment).focus)
    .filter((focus): focus is string => typeof focus === "string" && !!focus);
}

function getReplyToUrisForNotifications(
  notifications: Un$Typed<NotificationView>[],
): string[] {
  return notifications
    .filter((n) => n.record.$type === "social.grain.comment")
    .map((n) => (n.record as Comment).replyTo)
    .filter((replyTo): replyTo is string =>
      typeof replyTo === "string" && !!replyTo
    );
}
