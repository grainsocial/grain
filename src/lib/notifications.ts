import {
  isMention,
  type Main as Facet,
} from "$lexicon/types/app/bsky/richtext/facet.ts";
import { ProfileView } from "$lexicon/types/social/grain/actor/defs.ts";
import {
  isRecord as isComment,
  Record as Comment,
} from "$lexicon/types/social/grain/comment.ts";
import {
  isRecord as isFavorite,
  Record as Favorite,
} from "$lexicon/types/social/grain/favorite.ts";
import {
  isRecord as isGallery,
  Record as Gallery,
} from "$lexicon/types/social/grain/gallery.ts";
import {
  isRecord as isFollow,
  Record as Follow,
} from "$lexicon/types/social/grain/graph/follow.ts";
import { NotificationView } from "$lexicon/types/social/grain/notification/defs.ts";
import { Un$Typed } from "$lexicon/util.ts";
import { ActorTable, BffContext, WithBffMeta } from "@bigmoves/bff";
import { getActorProfile } from "./actor.ts";

export type NotificationRecords = WithBffMeta<
  Favorite | Follow | Comment | Gallery
>;

export function getNotifications(
  ctx: BffContext,
) {
  const notifications = ctx.getNotifications<NotificationRecords>();
  return notifications
    .filter(
      (notification) =>
        notification.$type === "social.grain.favorite" ||
        notification.$type === "social.grain.graph.follow" ||
        notification.$type === "social.grain.comment" ||
        notification.$type === "social.grain.gallery",
    )
    .map((notification) => {
      const actor = ctx.indexService.getActor(notification.did);
      const authorProfile = getActorProfile(notification.did, ctx);
      if (!actor || !authorProfile) return null;
      return notificationToView(
        notification,
        authorProfile,
        ctx.currentUser,
      );
    })
    .filter((view): view is Un$Typed<NotificationView> => Boolean(view));
}

export function notificationToView(
  record: NotificationRecords,
  author: Un$Typed<ProfileView>,
  currentUser?: ActorTable,
): Un$Typed<NotificationView> {
  let reason: string;
  if (isFavorite(record)) {
    reason = "gallery-favorite";
  } else if (isFollow(record)) {
    reason = "follow";
  } else if (
    isComment(record) &&
    record.replyTo
  ) {
    if (
      recordHasMentionFacet(
        record,
        currentUser?.did,
      )
    ) {
      reason = "gallery-comment-mention";
    } else {
      reason = "reply";
    }
    // @TODO: check the nsid here if support other types of comments
  } else if (isComment(record)) {
    if (
      recordHasMentionFacet(
        record,
        currentUser?.did,
      )
    ) {
      reason = "gallery-comment-mention";
    } else {
      reason = "gallery-comment";
    }
  } else if (
    isGallery(record) && recordHasMentionFacet(
      record,
      currentUser?.did,
    )
  ) {
    reason = "gallery-mention";
  } else {
    reason = "unknown";
  }
  const reasonSubject = record.$type === "social.grain.favorite"
    ? record.subject
    : undefined;
  const isRead = currentUser?.lastSeenNotifs
    ? record.createdAt <= currentUser.lastSeenNotifs
    : false;
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

function recordHasMentionFacet(
  record: NotificationRecords,
  currentUserDid?: string,
): boolean {
  if (Array.isArray(record.facets)) {
    return record.facets.some((facet) => {
      if (!currentUserDid) return true;
      const features = (facet as Facet).features;
      // Check if facet features contain the current user's DID
      if (Array.isArray(features)) {
        return features.filter(isMention).some(
          (feature) => feature.did === currentUserDid,
        );
      }
      return false;
    });
  }
  return false;
}
