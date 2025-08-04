import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { AtUri } from "@atproto/syntax";
import { MetaDescriptor } from "@bigmoves/bff/components";
import { PUBLIC_URL } from "./env.ts";
import { galleryLink } from "./utils.ts";

export function getPageMeta(pageUrl: string): MetaDescriptor[] {
  return [
    {
      tagName: "link",
      property: "canonical",
      href: `${PUBLIC_URL}${pageUrl}`,
    },
    { property: "og:site_name", content: "Grain Social" },
  ];
}

export function getGalleryMeta(gallery: GalleryView): MetaDescriptor[] {
  return [
    // { property: "og:type", content: "website" },
    {
      property: "og:url",
      content: `${PUBLIC_URL}${
        galleryLink(
          gallery.creator.handle,
          new AtUri(gallery.uri).rkey,
        )
      }`,
    },
    { property: "og:title", content: gallery.title },
    {
      property: "og:description",
      content: gallery.description,
    },
    {
      property: "og:image",
      content: `${
        Deno.env.get("DARKROOM_HOST_URL") || ""
      }/xrpc/social.grain.darkroom.getGalleryComposite?uri=${
        encodeURIComponent(gallery.uri)
      }&social=true`,
    },
  ];
}
