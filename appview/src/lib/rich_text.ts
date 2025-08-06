import { AppBskyRichtextFacet, Facet, RichText } from "@atproto/api";
import { BffContext } from "@bigmoves/bff";

export function parseFacetedText(
  text: string,
  ctx: BffContext,
): { text: string; facets: RichText["facets"] } {
  const rt = new RichText({ text });
  rt.detectFacetsWithoutResolution();
  if (rt.facets) {
    for (const facet of rt.facets) {
      for (const feature of facet.features) {
        if (AppBskyRichtextFacet.isMention(feature)) {
          const actor = ctx.indexService.getActorByHandle(feature.did);
          if (actor) {
            feature.did = actor.did;
          } else {
            rt.delete(facet.index.byteStart, facet.index.byteEnd);
          }
        }
      }
    }
  }
  return { text: rt.text, facets: rt.facets?.sort(facetSort) };
}

const facetSort = (a: Facet, b: Facet) => a.index.byteStart - b.index.byteStart;
