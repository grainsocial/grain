import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { AtUri } from "@atproto/syntax";
import { cn } from "@bigmoves/bff/components";
import { Button } from "./Button.tsx";

export type ButtonVariant = "button" | "icon-button";

export function FavoriteButton({
  class: classProp,
  variant,
  gallery,
}: Readonly<{
  class?: string;
  variant?: "button" | "icon-button";
  gallery: GalleryView;
}>) {
  const variantClass = variant === "icon-button"
    ? "flex w-fit items-center gap-2 m-0 p-0 mt-2"
    : "flex-1";
  const galleryRkey = new AtUri(gallery.uri).rkey;
  const favRrkey = gallery.viewer?.fav
    ? new AtUri(gallery.viewer.fav).rkey
    : undefined;
  return (
    <Button
      variant={variant === "icon-button" ? "ghost" : "secondary"}
      class={cn(
        "whitespace-nowrap",
        gallery.viewer?.fav ? "text-pink-500" : undefined,
        variantClass,
        classProp,
      )}
      type="button"
      {...gallery.viewer?.fav
        ? {
          "hx-delete":
            `/actions/${gallery.creator.did}/gallery/${galleryRkey}/favorite/${favRrkey}?variant=${variant}`,
        }
        : {
          "hx-post":
            `/actions/${gallery.creator.did}/gallery/${galleryRkey}/favorite?variant=${variant}`,
        }}
      hx-target="this"
      hx-swap="outerHTML"
    >
      <i
        class={cn(
          "fa-heart",
          variant === "icon-button" && gallery.viewer?.fav
            ? "text-pink-500"
            : undefined,
          gallery.viewer?.fav ? "fa-solid" : "fa-regular",
        )}
      >
      </i>{" "}
      {gallery.favCount}
    </Button>
  );
}
