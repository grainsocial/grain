import { Record as Favorite } from "$lexicon/types/social/grain/favorite.ts";
import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { NotificationView } from "$lexicon/types/social/grain/notification/defs.ts";
import { Un$Typed } from "$lexicon/util.ts";
import { formatRelativeTime, profileLink } from "../utils.ts";
import { ActorAvatar } from "./ActorAvatar.tsx";
import { GalleryPreviewLink } from "./GalleryPreviewLink.tsx";
import { Header } from "./Header.tsx";

export function NotificationsPage(
  { galleriesMap, notifications }: Readonly<
    {
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
                    favorited your gallery · {formatRelativeTime(
                      new Date((notification.record as Favorite).createdAt),
                    )}
                  </span>
                </div>
                {galleriesMap.get(
                    (notification.record as Favorite).subject,
                  )
                  ? (
                    <div class="w-[200px]">
                      <GalleryPreviewLink
                        gallery={galleriesMap.get(
                          (notification.record as Favorite).subject,
                        ) as Un$Typed<GalleryView>}
                        size="small"
                      />
                    </div>
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
