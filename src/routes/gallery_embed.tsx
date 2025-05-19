import { BffContext, RouteHandler } from "@bigmoves/bff";
import { GalleryPreviewLink } from "../components/GalleryPreviewLink.tsx";
import { getGallery } from "../gallery.ts";
import type { State } from "../state.ts";

export const handler: RouteHandler = (
  _req,
  params,
  ctx: BffContext<State>,
) => {
  const gallery = getGallery(params.did, params.rkey, ctx);
  if (!gallery) return ctx.next();
  return ctx.html(<GalleryPreviewLink gallery={gallery} size="small" />);
};
