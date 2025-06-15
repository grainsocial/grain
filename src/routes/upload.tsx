import { BffContext, RouteHandler } from "@bigmoves/bff";
import { UploadPage } from "../components/UploadPage.tsx";
import { getActorPhotos } from "../lib/actor.ts";
import { getGallery, getGalleryPhotos } from "../lib/gallery.ts";
import { getPageMeta } from "../meta.ts";
import type { State } from "../state.ts";
import { galleryLink } from "../utils.ts";

export const handler: RouteHandler = (
  req,
  _params,
  ctx: BffContext<State>,
) => {
  const { did, handle } = ctx.requireAuth();
  const url = new URL(req.url);
  const selectedGalleryRkey = url.searchParams.get("gallery") ?? "";
  const selectedGalleryUri =
    `at://${did}/social.grain.gallery/${selectedGalleryRkey}`;
  const galleryRkey = url.searchParams.get("returnTo");
  const photos = selectedGalleryRkey
    ? getGalleryPhotos(selectedGalleryUri, ctx)
    : getActorPhotos(did, ctx);
  const selectedGallery = getGallery(did, selectedGalleryRkey, ctx);
  ctx.state.meta = [{ title: "Upload — Grain" }, ...getPageMeta("/upload")];
  return ctx.render(
    <UploadPage
      userDid={did}
      userHandle={handle}
      photos={photos}
      returnTo={galleryRkey ? galleryLink(handle, galleryRkey) : undefined}
      selectedGallery={selectedGallery ?? undefined}
    />,
  );
};
