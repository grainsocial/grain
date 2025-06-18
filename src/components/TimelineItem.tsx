import { Record as Gallery } from "$lexicon/types/social/grain/gallery.ts";
import { isPhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { type TimelineItem } from "../lib/timeline.ts";
import { formatRelativeTime } from "../utils.ts";
import { ActorInfo } from "./ActorInfo.tsx";
import { FavoriteButton } from "./FavoriteButton.tsx";
import { GalleryPreviewLink } from "./GalleryPreviewLink.tsx";
import { ModerationWrapper } from "./ModerationWrapper.tsx";

export function TimelineItem({ item }: Readonly<{ item: TimelineItem }>) {
  const title = (item.gallery.record as Gallery).title;
  const description = (item.gallery.record as Gallery).description;
  return (
    <li>
      <div class="flex flex-col pb-4 max-w-md">
        <div class="flex items-center justify-between gap-2 w-full mb-4">
          <ActorInfo profile={item.actor} />
          <span class="shrink-0">
            {formatRelativeTime(new Date(item.createdAt))}
          </span>
        </div>
        {item.gallery.items?.length && item.gallery.items?.length > 0
          ? (
            <div class="mb-4">
              {item.gallery.items?.filter(isPhotoView).length
                ? (
                  <ModerationWrapper
                    moderationDecision={item.modDecision}
                    class="gap-2 sm:min-w-md"
                  >
                    <GalleryPreviewLink
                      gallery={item.gallery}
                    />
                  </ModerationWrapper>
                )
                : null}
            </div>
          )
          : null}
        {title && (
          <p class="font-semibold">
            {title}
          </p>
        )}
        {description && (
          <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-500">
            {description}
          </p>
        )}
        <FavoriteButton
          gallery={item.gallery}
          variant="icon-button"
        />
      </div>
    </li>
  );
}
