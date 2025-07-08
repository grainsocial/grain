import { isPhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { type TimelineItem } from "../lib/timeline.ts";
import { CommentsButton } from "../modules/comments.tsx";
import { formatRelativeTime } from "../utils.ts";
import { ActorInfo } from "./ActorInfo.tsx";
import { FavoriteButton } from "./FavoriteButton.tsx";
import { GalleryPreviewLink } from "./GalleryPreviewLink.tsx";
import { ModerationWrapper } from "./ModerationWrapper.tsx";
import { RenderFacetedText } from "./RenderFacetedText.tsx";

export function TimelineItem({ item }: Readonly<{ item: TimelineItem }>) {
  const title = item.gallery.title;
  const description = item.gallery.description;
  const facets = item.gallery.facets;
  return (
    <li>
      <div class="flex flex-col pb-4 max-w-md">
        <div class="flex items-center justify-between gap-2 w-full mb-4">
          <ActorInfo profile={item.actor} class="flex-1" />
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
            {facets && facets.length > 0
              ? <RenderFacetedText text={description} facets={facets} />
              : description}
          </p>
        )}
        <div class="flex gap-4">
          <FavoriteButton
            gallery={item.gallery}
            variant="icon-button"
          />
          <CommentsButton
            gallery={item.gallery}
            variant="icon-button"
          />
        </div>
      </div>
    </li>
  );
}
