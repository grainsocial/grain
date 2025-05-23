import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { Button } from "@bigmoves/bff/components";
import { publicGalleryLink } from "../utils.ts";

export function ShareGalleryButton(
  { gallery }: Readonly<{ gallery: GalleryView }>,
) {
  const intentLink = `https://bsky.app/intent/compose?text=${
    encodeURIComponent(
      "Check out this gallery on @grain.social \n" +
        publicGalleryLink(gallery.creator.handle, gallery.uri),
    )
  }`;
  return (
    <Button
      variant="primary"
      class="whitespace-nowrap"
      asChild
    >
      <a href={intentLink} target="_blank" rel="noopener noreferrer">
        <i class="fa-solid fa-arrow-up-from-bracket mr-2" />
        Share to Bluesky
      </a>
    </Button>
  );
}
