import { Record as Comment } from "$lexicon/types/social/grain/comment.ts";
import { Record as Favorite } from "$lexicon/types/social/grain/favorite.ts";
import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { Record as Follow } from "$lexicon/types/social/grain/graph/follow.ts";
import { NotificationView } from "$lexicon/types/social/grain/notification/defs.ts";
import { PhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { Un$Typed } from "$lexicon/util.ts";
import { formatRelativeTime, profileLink } from "../utils.ts";
import { ActorAvatar } from "./ActorAvatar.tsx";
import { GalleryPreviewLink } from "./GalleryPreviewLink.tsx";
import { Header } from "./Header.tsx";

export function NotificationsPage(
  { photosMap, galleriesMap, notifications }: Readonly<
    {
      photosMap: Map<string, Un$Typed<PhotoView>>;
      galleriesMap: Map<string, Un$Typed<GalleryView>>;
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
                <div class="flex flex-wrap items-center gap-2">
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
                {notification.reason === "gallery-favorite" && galleriesMap.get(
                    (notification.record as Favorite).subject,
                  )
                  ? (
                    <div class="w-[200px]">
                      <GalleryPreviewLink
                        gallery={galleriesMap.get(
                          (notification.record as Favorite).subject,
                        ) as GalleryView}
                        size="small"
                      />
                    </div>
                  )
                  : null}
                {(notification.reason === "gallery-comment" ||
                    notification.reason === "reply") && galleriesMap.get(
                      (notification.record as Comment).subject,
                    )
                  ? (
                    <>
                      {(notification.record as Comment).text}
                      {(notification.record as Comment).focus
                        ? (
                          <div class="w-[200px] pointer-events-none">
                            <img
                              src={photosMap.get(
                                (notification.record as Comment).focus ?? "",
                              )?.thumb}
                              alt={photosMap.get(
                                (notification.record as Comment).focus ?? "",
                              )?.alt}
                              class="rounded-md"
                            />
                          </div>
                        )
                        : (
                          <div class="w-[200px]">
                            <GalleryPreviewLink
                              gallery={galleriesMap.get(
                                (notification.record as Favorite).subject,
                              ) as GalleryView}
                              size="small"
                            />
                          </div>
                        )}
                    </>
                  )
                  : null}
              </li>
            ))
          )
          : <li>No notifications yet.</li>}
      </ul>
    </div>
  );
}
