import { Record as Favorite } from "$lexicon/types/social/grain/favorite.ts";
import { Record as Gallery } from "$lexicon/types/social/grain/gallery.ts";
import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { isPhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { AtUri } from "@atproto/syntax";
import { WithBffMeta } from "@bigmoves/bff";
import { Button } from "@bigmoves/bff/components";
import { ActorInfo } from "./ActorInfo.tsx";
import { FavoriteButton } from "./FavoriteButton.tsx";
import { PhotoButton } from "./PhotoButton.tsx";
import { ShareGalleryButton } from "./ShareGalleryButton.tsx";

export function GalleryPage({
  gallery,
  favs = [],
  currentUserDid,
}: Readonly<{
  gallery: GalleryView;
  favs: WithBffMeta<Favorite>[];
  currentUserDid?: string;
}>) {
  const isCreator = currentUserDid === gallery.creator.did;
  const isLoggedIn = !!currentUserDid;
  const description = (gallery.record as Gallery).description;
  return (
    <div class="px-4">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-4 mb-2">
        <div class="flex flex-col space-y-2 mb-4 max-w-[500px]">
          <h1 class="font-bold text-2xl">
            {(gallery.record as Gallery).title}
          </h1>
          <ActorInfo profile={gallery.creator} />
          {description ? <p>{description}</p> : null}
        </div>
        {isLoggedIn && isCreator
          ? (
            <div class="flex self-start gap-2 w-full sm:w-fit flex-col sm:flex-row sm:flex-wrap sm:justify-end">
              <Button
                variant="primary"
                class="self-start w-full sm:w-fit whitespace-nowrap"
                hx-get={`/dialogs/gallery/${new AtUri(gallery.uri).rkey}`}
                hx-target="#layout"
                hx-swap="afterbegin"
              >
                Edit
              </Button>
              <Button
                hx-get={`/dialogs/photo-select/${new AtUri(gallery.uri).rkey}`}
                hx-target="#layout"
                hx-swap="afterbegin"
                variant="primary"
                class="self-start w-full sm:w-fit whitespace-nowrap"
              >
                Add photos
              </Button>
              <Button
                variant="primary"
                class="self-start w-full sm:w-fit whitespace-nowrap"
                hx-get={`/dialogs/gallery/${new AtUri(gallery.uri).rkey}/sort`}
                hx-target="#layout"
                hx-swap="afterbegin"
              >
                Sort order
              </Button>
              <ShareGalleryButton gallery={gallery} />
              <FavoriteButton
                currentUserDid={currentUserDid}
                favs={favs}
                galleryUri={gallery.uri}
              />
            </div>
          )
          : null}
        {!isCreator
          ? (
            <div class="flex self-start gap-2 w-full sm:w-fit flex-col sm:flex-row">
              <ShareGalleryButton gallery={gallery} />
              <FavoriteButton
                currentUserDid={currentUserDid}
                favs={favs}
                galleryUri={gallery.uri}
              />
            </div>
          )
          : null}
      </div>
      <div class="flex justify-end mb-2">
        <Button
          id="justified-button"
          title="Justified layout"
          variant="primary"
          class="flex justify-center w-full sm:w-fit bg-zinc-100 dark:bg-zinc-800 border-zinc-100 dark:border-zinc-800 data-[selected=false]:bg-transparent data-[selected=false]:border-transparent text-zinc-950 dark:text-zinc-50"
          _="on click call Grain.toggleLayout('justified')
            set @data-selected to 'true'
            set #masonry-button's @data-selected to 'false'"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect x="2" y="2" width="8" height="6" fill="currentColor" rx="1" />
            <rect
              x="12"
              y="2"
              width="10"
              height="6"
              fill="currentColor"
              rx="1"
            />
            <rect
              x="2"
              y="10"
              width="6"
              height="6"
              fill="currentColor"
              rx="1"
            />
            <rect
              x="10"
              y="10"
              width="12"
              height="6"
              fill="currentColor"
              rx="1"
            />
            <rect
              x="2"
              y="18"
              width="20"
              height="4"
              fill="currentColor"
              rx="1"
            />
          </svg>
        </Button>
        <Button
          id="masonry-button"
          title="Masonry layout"
          variant="primary"
          data-selected="false"
          class="flex justify-center w-full sm:w-fit bg-zinc-100 dark:bg-zinc-800 border-zinc-100 dark:border-zinc-800 data-[selected=false]:bg-transparent data-[selected=false]:border-transparent text-zinc-950 dark:text-zinc-50"
          _="on click call Grain.toggleLayout('masonry')
            set @data-selected to 'true'
            set #justified-button's @data-selected to 'false'"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect x="2" y="2" width="8" height="8" fill="currentColor" rx="1" />
            <rect
              x="12"
              y="2"
              width="8"
              height="4"
              fill="currentColor"
              rx="1"
            />
            <rect
              x="12"
              y="8"
              width="8"
              height="6"
              fill="currentColor"
              rx="1"
            />
            <rect
              x="2"
              y="12"
              width="8"
              height="8"
              fill="currentColor"
              rx="1"
            />
            <rect
              x="12"
              y="16"
              width="8"
              height="4"
              fill="currentColor"
              rx="1"
            />
          </svg>
        </Button>
      </div>
      <div
        id="masonry-container"
        class="h-0 overflow-hidden relative mx-auto w-full"
        _="on load or htmx:afterSettle call Grain.computeLayout()"
      >
        {gallery.items?.filter(isPhotoView)?.length
          ? gallery?.items
            ?.filter(isPhotoView)
            ?.map((photo) => (
              <PhotoButton
                key={photo.cid}
                photo={photo}
                gallery={gallery}
              />
            ))
          : null}
      </div>
    </div>
  );
}
