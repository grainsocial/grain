import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { isPhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { AtUri } from "@atproto/syntax";
import { ModerationDecsion } from "../lib/moderation.ts";
import { EditGalleryButton } from "./EditGalleryDialog.tsx";
import { FavoriteButton } from "./FavoriteButton.tsx";
import { GalleryInfo } from "./GalleryInfo.tsx";
import { GalleryLayout } from "./GalleryLayout.tsx";
import { ModerationWrapper } from "./ModerationWrapper.tsx";
import { ShareGalleryDialogButton } from "./ShareGalleryDialog.tsx";

export function GalleryPage({
  gallery,
  currentUserDid,
  modDecision,
}: Readonly<{
  gallery: GalleryView;
  currentUserDid?: string;
  modDecision?: ModerationDecsion;
}>) {
  const isCreator = currentUserDid === gallery.creator.did;
  const isLoggedIn = !!currentUserDid;
  const galleryItems = gallery.items?.filter(isPhotoView) ?? [];
  return (
    <div class="px-4" id="gallery-page">
      <div id="dialog-target" />
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-4 mb-2">
        <GalleryInfo gallery={gallery} />
        {isLoggedIn && isCreator
          ? (
            <div class="flex self-start gap-2 w-full sm:w-fit flex-col sm:flex-row sm:flex-wrap sm:justify-end">
              <EditGalleryButton gallery={gallery} />
              <ShareGalleryDialogButton gallery={gallery} />
              <FavoriteButton gallery={gallery} />
            </div>
          )
          : null}
        {!isCreator
          ? (
            <div class="flex self-start gap-2 w-full sm:w-fit flex-col sm:flex-row">
              <ShareGalleryDialogButton gallery={gallery} />
              <FavoriteButton gallery={gallery} />
            </div>
          )
          : null}
      </div>
      {isLoggedIn && isCreator && gallery.items?.length === 0
        ? (
          <div
            hx-get={`/dialogs/gallery/${new AtUri(gallery.uri).rkey}/photos`}
            hx-trigger="load"
            hx-target="#dialog-target"
            hx-swap="innerHTML"
          />
        )
        : null}
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
