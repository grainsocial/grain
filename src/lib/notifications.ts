import { ProfileView } from "$lexicon/types/social/grain/actor/defs.ts";
import { Record as Favorite } from "$lexicon/types/social/grain/favorite.ts";
import { NotificationView } from "$lexicon/types/social/grain/notification/defs.ts";
import { Un$Typed } from "$lexicon/util.ts";
import { ActorTable, BffContext, WithBffMeta } from "@bigmoves/bff";
import { getActorProfile } from "./actor.ts";

export type NotificationRecords = WithBffMeta<Favorite>;

export function getNotifications(
  currentUser: ActorTable,
  ctx: BffContext,
) {
  const { lastSeenNotifs } = currentUser;
  const notifications = ctx.getNotifications<NotificationRecords>();
  return notifications.map((notification) => {
    const actor = ctx.indexService.getActor(notification.did);
    const authorProfile = getActorProfile(notification.did, ctx);
    if (!actor || !authorProfile) return null;
    return notificationToView(
      notification,
      authorProfile,
      lastSeenNotifs,
    );
  }).filter((view): view is Un$Typed<NotificationView> => Boolean(view));
}

export function notificationToView(
  record: NotificationRecords,
  author: Un$Typed<ProfileView>,
  lastSeenNotifs: string | undefined,
): Un$Typed<NotificationView> {
  const reason = record.$type === "social.grain.favorite"
    ? "gallery-favorite"
    : "unknown";
  const reasonSubject = record.$type === "social.grain.favorite"
    ? record.subject
    : undefined;
  const isRead = lastSeenNotifs ? record.createdAt <= lastSeenNotifs : false;
  return {
    uri: record.uri,
    cid: record.cid,
    author,
    record,
    reason,
    reasonSubject,
    isRead,
    indexedAt: record.indexedAt,
  };
}
