import { Record as Gallery } from "$lexicon/types/social/grain/gallery.ts";
import { isPhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { AtUri } from "@atproto/syntax";
import { type TimelineItem } from "../timeline.ts";
import { formatRelativeTime, galleryLink } from "../utils.ts";
import { ActorInfo } from "./ActorInfo.tsx";
import { GalleryPreviewLink } from "./GalleryPreviewLink.tsx";

export function TimelineItem({ item }: Readonly<{ item: TimelineItem }>) {
  return (
    <li>
      <div class="w-fit flex flex-col gap-4 pb-4">
        <div class="flex items-center justify-between gap-2 w-full">
          <ActorInfo profile={item.actor} />
          <span class="shrink-0">
            {formatRelativeTime(new Date(item.createdAt))}
          </span>
        </div>
        {item.gallery.items?.filter(isPhotoView).length
          ? (
            <GalleryPreviewLink
              gallery={item.gallery}
            />
          )
          : null}
        <div class="flex items-baseline gap-1">
          {item.itemType === "favorite" ? "Favorited" : "Created"}
          <a
            href={galleryLink(
              item.gallery.creator.handle,
              new AtUri(item.gallery.uri).rkey,
            )}
            class="inline-block max-w-[350px] truncate font-semibold hover:underline"
          >
            {(item.gallery.record as Gallery).title}
          </a>
        </div>
      </div>
    </li>
  );
}
