import { ProfileView } from "$lexicon/types/social/grain/actor/defs.ts";
import { Record as Comment } from "$lexicon/types/social/grain/comment.ts";
import { Record as Favorite } from "$lexicon/types/social/grain/favorite.ts";
import { Record as Follow } from "$lexicon/types/social/grain/graph/follow.ts";
import { NotificationView } from "$lexicon/types/social/grain/notification/defs.ts";
import { Un$Typed } from "$lexicon/util.ts";
import { ActorTable, BffContext, WithBffMeta } from "@bigmoves/bff";
import { getActorProfile } from "./actor.ts";

export type NotificationRecords = WithBffMeta<Favorite | Follow | Comment>;

export function getNotifications(
  currentUser: ActorTable,
  ctx: BffContext,
) {
  const { lastSeenNotifs } = currentUser;
  const notifications = ctx.getNotifications<NotificationRecords>();
  return notifications
    .filter(
      (notification) =>
        notification.$type === "social.grain.favorite" ||
        notification.$type === "social.grain.graph.follow" ||
        notification.$type === "social.grain.comment",
    )
    .map((notification) => {
      const actor = ctx.indexService.getActor(notification.did);
      const authorProfile = getActorProfile(notification.did, ctx);
      if (!actor || !authorProfile) return null;
      return notificationToView(
        notification,
        authorProfile,
        lastSeenNotifs,
      );
    })
    .filter((view): view is Un$Typed<NotificationView> => Boolean(view));
}

export function notificationToView(
  record: NotificationRecords,
  author: Un$Typed<ProfileView>,
  lastSeenNotifs: string | undefined,
): Un$Typed<NotificationView> {
  let reason: string;
  if (record.$type === "social.grain.favorite") {
    reason = "gallery-favorite";
  } else if (record.$type === "social.grain.graph.follow") {
    reason = "follow";
  } else if (record.$type === "social.grain.comment") {
    reason = "gallery-comment";
  } else {
    reason = "unknown";
  }
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
