import { BffContext, RouteHandler } from "@bigmoves/bff";
import { UploadPage } from "../components/UploadPage.tsx";
import { getActorPhotos } from "../lib/actor.ts";
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
  const galleryRkey = url.searchParams.get("returnTo");
  const photos = getActorPhotos(did, ctx);
  ctx.state.meta = [{ title: "Upload — Grain" }, ...getPageMeta("/upload")];
  ctx.state.scripts = ["photo_manip.js", "upload_page.js"];
  return ctx.render(
    <UploadPage
      handle={handle}
      photos={photos}
      returnTo={galleryRkey ? galleryLink(handle, galleryRkey) : undefined}
    />,
  );
};
