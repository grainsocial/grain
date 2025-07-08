import { BffContext, RouteHandler } from "@bigmoves/bff";
import { GalleryPage } from "../components/GalleryPage.tsx";
import { getGallery } from "../lib/gallery.ts";
import { moderateGallery, ModerationDecsion } from "../lib/moderation.ts";
import { getGalleryMeta, getPageMeta } from "../meta.ts";
import type { State } from "../state.ts";
import { galleryLink } from "../utils.ts";

export const handler: RouteHandler = async (
  _req,
  params,
  ctx: BffContext<State>,
) => {
  const did = ctx.currentUser?.did;
  const handle = params.handle;
  const rkey = params.rkey;
  const gallery = getGallery(handle, rkey, ctx);

  if (!gallery) return ctx.next();

  ctx.state.meta = [
    { title: `${gallery.title} — Grain` },
    ...getPageMeta(galleryLink(handle, rkey)),
    ...getGalleryMeta(gallery),
  ];

  let modDecision: ModerationDecsion | undefined = undefined;
  if (gallery.labels?.length) {
    modDecision = await moderateGallery(gallery.labels ?? [], ctx);
  }

  return ctx.render(
    <GalleryPage
      gallery={gallery}
      currentUserDid={did}
      modDecision={modDecision}
    />,
  );
};
