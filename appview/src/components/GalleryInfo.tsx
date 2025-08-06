import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { ActorInfo } from "./ActorInfo.tsx";
import { CameraBadges } from "./CameraBadges.tsx";
import { RenderFacetedText } from "./RenderFacetedText.tsx";

export function GalleryInfo(
  { gallery }: Readonly<{ gallery: GalleryView }>,
) {
  const description = gallery.description;
  const facets = gallery.facets;
  return (
    <div
      class="flex flex-col space-y-2 mb-4 max-w-[500px]"
      id="gallery-info"
    >
      <h1 class="font-bold text-2xl">
        {gallery.title}
      </h1>
      <ActorInfo profile={gallery.creator} />
      {description
        ? (
          <p>
            <RenderFacetedText text={description} facets={facets} />
          </p>
        )
        : null}
      <CameraBadges class="my-1" cameras={gallery.cameras ?? []} />
    </div>
  );
}
