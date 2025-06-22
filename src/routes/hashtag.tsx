import { Record as Gallery } from "$lexicon/types/social/grain/gallery.ts";
import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { BffContext, RouteHandler } from "@bigmoves/bff";
import { ActorInfo } from "../components/ActorInfo.tsx";
import { Breadcrumb } from "../components/Breadcrumb.tsx";
import { GalleryPreviewLink } from "../components/GalleryPreviewLink.tsx";
import { Header } from "../components/Header.tsx";
import { RenderFacetedText } from "../components/RenderFacetedText.tsx";
import {
  getGalleriesBulk,
  getGalleryUrisByCommentFacet,
  getGalleryUrisByFacet,
} from "../lib/gallery.ts";
import { State } from "../state.ts";

export const handler: RouteHandler = (
  _req,
  params,
  ctx: BffContext<State>,
) => {
  const tag = params.tag;

  const galleryUris = getGalleryUrisByFacet(
    "tag",
    tag,
    ctx,
  );

  const galleriesUrisInComments = getGalleryUrisByCommentFacet(
    "tag",
    tag,
    ctx,
  );

  const uniqueGalleryUris = Array.from(
    new Set([...galleryUris, ...galleriesUrisInComments]),
  );
  const galleries = getGalleriesBulk(
    uniqueGalleryUris,
    ctx,
  );

  ctx.state.meta = [{ title: `Hashtag — Grain` }];

  return ctx.render(
    <div class="p-4 flex flex-col gap-4">
      <Breadcrumb
        class="m-0"
        items={[{ label: "home", href: "/" }, {
          label: tag,
        }]}
      />
      <Header>#{tag}</Header>

      {galleries.length > 0
        ? (
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {galleries.map((gallery) => (
              <HashtagGalleryItem gallery={gallery} key={gallery.uri} />
            ))}
          </div>
        )
        : <div>No galleries found.</div>}
    </div>,
  );
};

function HashtagGalleryItem(
  { gallery }: Readonly<{
    gallery: GalleryView;
  }>,
) {
  const title = (gallery.record as Gallery).title;
  const description = (gallery.record as Gallery).description;
  const facets = (gallery.record as Gallery).facets || [];
  return (
    <div class="flex flex-col gap-2" key={gallery.uri}>
      <ActorInfo profile={gallery.creator} />
      <GalleryPreviewLink gallery={gallery} />
      <div class="font-semibold">
        {title}
      </div>
      {description && (
        <p class="text-sm text-zinc-600 dark:text-zinc-500">
          {facets && Array.isArray(facets) &&
              facets.length > 0
            ? (
              <RenderFacetedText
                text={description}
                facets={facets}
              />
            )
            : description}
        </p>
      )}
    </div>
  );
}
