import { Record as Favorite } from "$lexicon/types/social/grain/favorite.ts";
import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { isPhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { AtUri } from "@atproto/syntax";
import { WithBffMeta } from "@bigmoves/bff";
import { Button } from "@bigmoves/bff/components";
import { ModerationDecsion } from "../lib/moderation.ts";
import { uploadPageLink } from "../utils.ts";
import { FavoriteButton } from "./FavoriteButton.tsx";
import { GalleryInfo } from "./GalleryInfo.tsx";
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
  const galleryItems = gallery.items?.filter(isPhotoView) ?? [];
  const atUri = new AtUri(gallery.uri);
  const rkey = atUri.rkey;
  return (
    <div class="px-4" id="gallery-page">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-4 mb-2">
        <GalleryInfo gallery={gallery} />
        {isLoggedIn && isCreator
          ? (
            <div class="flex self-start gap-2 w-full sm:w-fit flex-col sm:flex-row sm:flex-wrap sm:justify-end">
              <Button
                variant="primary"
                class="self-start w-full sm:w-fit whitespace-nowrap"
                hx-get={`/dialogs/gallery/${rkey}`}
                hx-target="#layout"
                hx-swap="afterbegin"
              >
                Edit
              </Button>
              <Button
                variant="primary"
                class="self-start w-full sm:w-fit whitespace-nowrap"
                asChild
              >
                <a href={uploadPageLink(rkey)}>Upload</a>
              </Button>
              <Button
                variant="primary"
                class="self-start w-full sm:w-fit whitespace-nowrap"
                hx-get={`/dialogs/gallery/${rkey}/sort`}
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
