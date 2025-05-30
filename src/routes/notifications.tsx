import { Record as Favorite } from "$lexicon/types/social/grain/favorite.ts";
import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { NotificationView } from "$lexicon/types/social/grain/notification/defs.ts";
import { Un$Typed } from "$lexicon/util.ts";
import { AtUri } from "@atproto/syntax";
import { BffContext, RouteHandler } from "@bigmoves/bff";
import { NotificationsPage } from "../components/NotificationsPage.tsx";
import { getGallery } from "../lib/gallery.ts";
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
  const galleriesMap = new Map<string, GalleryView>();
  const galleryUris = getGalleriesUrisForNotifications(
    ctx.state.notifications ?? [],
  );
  for (const uri of galleryUris) {
    const gallery = getGallery(
      new AtUri(uri).hostname,
      new AtUri(uri).rkey,
      ctx,
    );
    if (gallery) {
      galleriesMap.set(uri, gallery);
    }
  }
  return ctx.render(
    <NotificationsPage
      galleriesMap={galleriesMap}
      notifications={ctx.state.notifications ?? []}
    />,
  );
};

function getGalleriesUrisForNotifications(
  notifications: Un$Typed<NotificationView>[],
): string[] {
  const uris = notifications
    .filter((n) => n.record.$type === "social.grain.favorite")
    .filter((n) =>
      (n.record as Favorite).subject.includes("social.grain.gallery")
    )
    .map((n) => (n.record as Favorite).subject);
  return uris;
}
