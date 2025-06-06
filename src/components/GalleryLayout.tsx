import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { PhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { AtUri } from "@atproto/syntax";
import { Button } from "@bigmoves/bff/components";
import { ComponentChildren } from "preact";
import { photoDialogLink } from "../utils.ts";
import { JustifiedSvg } from "./JustifiedSvg.tsx";
import { MasonrySvg } from "./MasonrySvg.tsx";

interface GalleryLayoutProps {
  children: ComponentChildren;
  layoutButtons?: ComponentChildren;
}

function GalleryLayout({ children, layoutButtons }: GalleryLayoutProps) {
  return (
    <>
      {layoutButtons
        ? (
          <div class="mb-2 flex justify-end">
            {layoutButtons}
          </div>
        )
        : null}
      {children}
    </>
  );
}

function GalleryContainer({ children }: { children: ComponentChildren }) {
  return (
    <div
      id="gallery-container"
      class="h-0 overflow-hidden relative mx-auto w-full"
    >
      {children}
    </div>
  );
}

function GalleryLayoutModeButton({
  mode,
}: Readonly<{
  mode: "justified" | "masonry";
}>) {
  return (
    <Button
      id={`${mode}-button`}
      title={`${mode.charAt(0).toUpperCase() + mode.slice(1)} layout`}
      variant="primary"
      data-selected={mode === "justified" ? "true" : "false"}
      class="flex justify-center w-full sm:w-fit bg-zinc-100 dark:bg-zinc-800 border-zinc-100 dark:border-zinc-800 data-[selected=false]:bg-transparent data-[selected=false]:border-transparent text-zinc-950 dark:text-zinc-50"
      _={`on click call Grain.galleryLayout.setLayoutMode('${mode}')
        set @data-selected to 'true'
        set #${
        mode === "justified" ? "masonry" : "justified"
      }-button's @data-selected to 'false'`}
    >
      {mode === "masonry" ? <MasonrySvg /> : <JustifiedSvg />}
    </Button>
  );
}

function GalleryLayoutItem({
  photo,
  gallery,
}: Readonly<{
  photo: PhotoView;
  gallery: GalleryView;
}>) {
  return (
    <button
      id={`photo-${new AtUri(photo.uri).rkey}`}
      type="button"
      hx-get={photoDialogLink(gallery, photo)}
      hx-trigger="click"
      hx-target="#layout"
      hx-swap="afterbegin"
      class="gallery-item absolute cursor-pointer"
      data-width={photo.aspectRatio?.width}
      data-height={photo.aspectRatio?.height}
    >
      <img
        src={photo.fullsize}
        alt={photo.alt}
        class="w-full h-full object-cover"
      />
      {photo.alt
        ? (
          <div class="absolute bg-zinc-950 dark:bg-zinc-900 bottom-1 right-1 sm:bottom-1 sm:right-1 text-xs text-white font-semibold py-[1px] px-[3px]">
            ALT
          </div>
        )
        : null}
    </button>
  );
}

GalleryLayout.Container = GalleryContainer;
GalleryLayout.ModeButton = GalleryLayoutModeButton;
GalleryLayout.Item = GalleryLayoutItem;

export { GalleryLayout };
