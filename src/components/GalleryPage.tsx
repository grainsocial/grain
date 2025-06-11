import { Record as Favorite } from "$lexicon/types/social/grain/favorite.ts";
import { Record as Gallery } from "$lexicon/types/social/grain/gallery.ts";
import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { isPhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { AtUri } from "@atproto/syntax";
import { WithBffMeta } from "@bigmoves/bff";
import { Button } from "@bigmoves/bff/components";
import { ModerationDecsion } from "../lib/moderation.ts";
import { ActorInfo } from "./ActorInfo.tsx";
import { FavoriteButton } from "./FavoriteButton.tsx";
import { GalleryLayout } from "./GalleryLayout.tsx";
import { ModerationWrapper } from "./ModerationWrapper.tsx";
import { ShareGalleryButton } from "./ShareGalleryButton.tsx";

export function GalleryPage({
  gallery,
  favs = [],
  currentUserDid,
  modDecision,
}: Readonly<{
  gallery: GalleryView;
  favs: WithBffMeta<Favorite>[];
  currentUserDid?: string;
  modDecision?: ModerationDecsion;
}>) {
  const isCreator = currentUserDid === gallery.creator.did;
  const isLoggedIn = !!currentUserDid;
  const description = (gallery.record as Gallery).description;
  const galleryItems = gallery.items?.filter(isPhotoView) ?? [];
  return (
    <div class="px-4" id="gallery-page">
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
      {
        <ModerationWrapper moderationDecision={modDecision} class="mb-2">
          <GalleryLayout
            layoutButtons={
              <>
                <GalleryLayout.ModeButton mode="justified" />
                <GalleryLayout.ModeButton mode="masonry" />
              </>
            }
          >
            <GalleryLayout.Container>
              {galleryItems?.length
                ? galleryItems.map((photo) => (
                  <GalleryLayout.Item
                    key={photo.cid}
                    photo={photo}
                    gallery={gallery}
                  />
                ))
                : null}
            </GalleryLayout.Container>
          </GalleryLayout>
        </ModerationWrapper>
      }
    </div>
  );
}
