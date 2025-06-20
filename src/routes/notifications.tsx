import { Record as Comment } from "$lexicon/types/social/grain/comment.ts";
import { Record as Favorite } from "$lexicon/types/social/grain/favorite.ts";
import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { NotificationView } from "$lexicon/types/social/grain/notification/defs.ts";
import { PhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { Un$Typed } from "$lexicon/util.ts";
import { BffContext, RouteHandler } from "@bigmoves/bff";
import { NotificationsPage } from "../components/NotificationsPage.tsx";
import { getGalleriesBulk } from "../lib/gallery.ts";
import { getPhotosBulk } from "../lib/photo.ts";
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
  return ctx.render(
    <NotificationsPage
      photosMap={photosMap}
      galleriesMap={galleriesMap}
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
