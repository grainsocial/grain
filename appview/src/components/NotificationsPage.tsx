import { Record as Comment } from "$lexicon/types/social/grain/comment.ts";
import { CommentView } from "$lexicon/types/social/grain/comment/defs.ts";
import { Record as Favorite } from "$lexicon/types/social/grain/favorite.ts";
import { Record as Gallery } from "$lexicon/types/social/grain/gallery.ts";
import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { Record as Follow } from "$lexicon/types/social/grain/graph/follow.ts";
import { NotificationView } from "$lexicon/types/social/grain/notification/defs.ts";
import {
  isPhotoView,
  PhotoView,
} from "$lexicon/types/social/grain/photo/defs.ts";
import { Un$Typed } from "$lexicon/util.ts";
import { AtUri } from "@atproto/syntax";
import { WithBffMeta } from "@bigmoves/bff";
import { formatRelativeTime, galleryLink, profileLink } from "../utils.ts";
import { ActorAvatar } from "./ActorAvatar.tsx";
import { GalleryPreviewLink } from "./GalleryPreviewLink.tsx";
import { Header } from "./Header.tsx";
import { RenderFacetedText } from "./RenderFacetedText.tsx";

export function NotificationsPage(
  { photosMap, galleriesMap, notifications, commentsMap }: Readonly<
    {
      photosMap: Map<string, Un$Typed<PhotoView>>;
      galleriesMap: Map<string, Un$Typed<GalleryView>>;
      commentsMap: Map<string, Un$Typed<CommentView>>;
      notifications: Un$Typed<NotificationView>[];
    }
  >,
) {
  return (
    <div class="px-4 mb-4">
      <div hx-post="/actions/update-seen" hx-trigger="load delay:1s" />
      <div class="my-4">
        <Header>Notifications</Header>
      </div>
      <ul class="space-y-4 relative divide-zinc-200 dark:divide-zinc-800 divide-y">
        {notifications.length
          ? (
            notifications.map((notification) => (
              <li
                key={notification.uri}
                class="flex flex-col gap-4 pb-4"
              >
                <div class="flex flex-wrap items-center gap-1">
                  <a
                    href={profileLink(notification.author.handle)}
                    class="flex items-center gap-2 hover:underline"
                  >
                    <ActorAvatar
                      profile={notification.author}
                      size={32}
                    />
                    <span class="font-semibold break-words">
                      {notification.author.displayName ||
                        notification.author.handle}
                    </span>
                  </a>
                  <span class="break-words">
                    {notification.reason === "gallery-favorite" && (
                      <>
                        favorited your gallery · {formatRelativeTime(
                          new Date((notification.record as Favorite).createdAt),
                        )}
                      </>
                    )}
                    {notification.reason === "gallery-comment" && (
                      <>
                        commented on your gallery · {formatRelativeTime(
                          new Date((notification.record as Comment).createdAt),
                        )}
                      </>
                    )}
                    {(notification.reason === "gallery-mention" ||
                      notification.reason === "gallery-comment-mention") && (
                      <>
                        mentioned you in a gallery · {formatRelativeTime(
                          new Date(
                            (notification.record as Comment).createdAt,
                          ),
                        )}
                      </>
                    )}
                    {notification.reason === "reply" && (
                      <>
                        replied to your comment · {formatRelativeTime(
                          new Date((notification.record as Comment).createdAt),
                        )}
                      </>
                    )}
                    {notification.reason === "follow" && (
                      <>
                        followed you · {formatRelativeTime(
                          new Date((notification.record as Follow).createdAt),
                        )}
                      </>
                    )}
                  </span>
                </div>
                {notification.reason === "gallery-favorite" &&
                  (
                    <GalleryFavoriteNotification
                      notification={notification}
                      galleriesMap={galleriesMap}
                    />
                  )}
                {notification.reason === "gallery-comment" &&
                  (
                    <GalleryCommentNotification
                      notification={notification}
                      galleriesMap={galleriesMap}
                      photosMap={photosMap}
                    />
                  )}
                {notification.reason === "gallery-comment-mention" &&
                  (
                    <GalleryCommentNotification
                      notification={notification}
                      galleriesMap={galleriesMap}
                      photosMap={photosMap}
                    />
                  )}
                {notification.reason === "reply" &&
                  (
                    <ReplyNotification
                      notification={notification}
                      galleriesMap={galleriesMap}
                      photosMap={photosMap}
                      commentsMap={commentsMap}
                    />
                  )}
                {notification.reason === "gallery-mention" &&
                  (
                    <GalleryMentionNotification
                      notification={notification}
                      galleriesMap={galleriesMap}
                    />
                  )}
              </li>
            ))
          )
          : <li>No notifications yet.</li>}
      </ul>
    </div>
  );
}

function GalleryCommentNotification(
  { notification, galleriesMap, photosMap }: Readonly<{
    notification: NotificationView;
    galleriesMap: Map<string, GalleryView>;
    photosMap: Map<string, PhotoView>;
  }>,
) {
  const comment = notification.record as Comment;
  const gallery = galleriesMap.get(comment.subject) as GalleryView | undefined;
  if (!gallery) return null;
  return (
    <>
      {<RenderFacetedText text={comment.text} facets={comment.facets} />}
      {comment.focus
        ? (
          <a
            href={galleryLink(
              gallery.creator.handle,
              new AtUri(gallery.uri).rkey,
            )}
            class="w-[200px]"
          >
            <img
              src={photosMap.get(comment.focus ?? "")?.thumb}
              alt={photosMap.get(comment.focus ?? "")?.alt}
              class="rounded-md"
            />
          </a>
        )
        : (
          <div class="w-[200px]">
            <GalleryPreviewLink
              gallery={gallery}
              size="small"
            />
          </div>
        )}
    </>
  );
}

function ReplyNotification(
  { notification, galleriesMap, photosMap, commentsMap }: Readonly<{
    notification: NotificationView;
    galleriesMap: Map<string, GalleryView>;
    photosMap: Map<string, PhotoView>;
    commentsMap: Map<string, CommentView>;
  }>,
) {
  const comment = notification.record as Comment;
  const gallery = galleriesMap.get(comment.subject) as GalleryView | undefined;
  let replyToComment: CommentView | undefined = undefined;
  if (comment.replyTo) {
    replyToComment = commentsMap.get(comment.replyTo);
  }
  if (!gallery) return null;
  return (
    <>
      {replyToComment && (
        <div class="text-sm border-l-2 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-500 pl-2">
          <RenderFacetedText
            text={replyToComment.text}
            facets={(replyToComment.record as Comment).facets}
          />
          {isPhotoView(replyToComment?.focus)
            ? (
              <a
                class="block mt-2 max-w-[200px]"
                href={galleryLink(
                  gallery.creator.handle,
                  new AtUri(gallery.uri).rkey,
                )}
              >
                <img
                  src={photosMap.get(replyToComment.focus.uri)?.thumb}
                  alt={photosMap.get(replyToComment.focus.uri)?.alt}
                  class="rounded-md"
                />
              </a>
            )
            : (
              <div class="mt-2 max-w-[200px]">
                <GalleryPreviewLink
                  class="mt-2"
                  gallery={gallery}
                  size="small"
                />
              </div>
            )}
        </div>
      )}
      <RenderFacetedText text={comment.text} facets={comment.facets} />
      {comment.focus
        ? (
          <a
            href={galleryLink(
              gallery.creator.handle,
              new AtUri(gallery.uri).rkey,
            )}
            class="max-w-[200px]"
          >
            <img
              src={photosMap.get(comment.focus ?? "")?.thumb}
              alt={photosMap.get(comment.focus ?? "")?.alt}
              class="rounded-md"
            />
          </a>
        )
        : !replyToComment
        ? (
          <div class="w-[200px]">
            <GalleryPreviewLink
              gallery={gallery}
              size="small"
            />
          </div>
        )
        : null}
    </>
  );
}

function GalleryFavoriteNotification(
  { notification, galleriesMap }: Readonly<{
    notification: NotificationView;
    galleriesMap: Map<string, GalleryView>;
  }>,
) {
  const favorite = notification.record as Favorite;
  const gallery = galleriesMap.get(favorite.subject) as GalleryView | undefined;
  if (!gallery) return null;
  return (
    <div class="w-[200px]">
      <GalleryPreviewLink
        gallery={gallery}
        size="small"
      />
    </div>
  );
}

function GalleryMentionNotification(
  { notification, galleriesMap }: Readonly<{
    notification: NotificationView;
    galleriesMap: Map<string, GalleryView>;
  }>,
) {
  const galleryRecord = notification.record as WithBffMeta<Gallery>;
  const gallery = galleriesMap.get(galleryRecord.uri) as
    | GalleryView
    | undefined;
  if (!gallery) return null;
  return (
    <div class="text-sm border-l-2 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-500 pl-2">
      <RenderFacetedText
        text={gallery.description ?? ""}
        facets={galleryRecord.facets}
      />
      <div class="mt-2 max-w-[200px]">
        <GalleryPreviewLink
          gallery={gallery}
          size="small"
        />
      </div>
    </div>
  );
}
