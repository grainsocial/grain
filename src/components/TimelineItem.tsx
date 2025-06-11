import { Record as Gallery } from "$lexicon/types/social/grain/gallery.ts";
import { isPhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { AtUri } from "@atproto/syntax";
import { type TimelineItem } from "../lib/timeline.ts";
import { formatRelativeTime, galleryLink } from "../utils.ts";
import { ActorInfo } from "./ActorInfo.tsx";
import { GalleryPreviewLink } from "./GalleryPreviewLink.tsx";
import { ModerationWrapper } from "./ModerationWrapper.tsx";

export function TimelineItem({ item }: Readonly<{ item: TimelineItem }>) {
  return (
    <li>
      <div class="flex flex-col gap-4 pb-4 max-w-md">
        <div class="flex items-center justify-between gap-2 w-full">
          <ActorInfo profile={item.actor} />
          <span class="shrink-0">
            {formatRelativeTime(new Date(item.createdAt))}
          </span>
        </div>
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
        <p class="w-full flex items-baseline gap-1">
          Created{" "}
          <a
            href={galleryLink(
              item.gallery.creator.handle,
              new AtUri(item.gallery.uri).rkey,
            )}
            class="inline-block truncate max-w-[200px] overflow-hidden font-semibold hover:underline"
          >
            {(item.gallery.record as Gallery).title}
          </a>
        </p>
      </div>
    </li>
  );
}
