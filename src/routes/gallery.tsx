import { Record as Favorite } from "$lexicon/types/social/grain/favorite.ts";
import { Record as Gallery } from "$lexicon/types/social/grain/gallery.ts";
import { BffContext, RouteHandler, WithBffMeta } from "@bigmoves/bff";
import { GalleryPage } from "../components/GalleryPage.tsx";
import { getGallery, getGalleryFavs } from "../gallery.ts";
import { getGalleryMeta, getPageMeta } from "../meta.ts";
import type { State } from "../state.ts";
import { galleryLink } from "../utils.ts";

export const handler: RouteHandler = (
  _req,
  params,
  ctx: BffContext<State>,
) => {
  const did = ctx.currentUser?.did;
  let favs: WithBffMeta<Favorite>[] = [];
  const handle = params.handle;
  const rkey = params.rkey;
  const gallery = getGallery(handle, rkey, ctx);
  if (!gallery) return ctx.next();
  favs = getGalleryFavs(gallery.uri, ctx);
  ctx.state.meta = [
    { title: `${(gallery.record as Gallery).title} — Grain` },
    ...getPageMeta(galleryLink(handle, rkey)),
    ...getGalleryMeta(gallery),
  ];
  ctx.state.scripts = ["photo_dialog.js", "masonry.js", "sortable.js"];
  return ctx.render(
    <GalleryPage favs={favs} gallery={gallery} currentUserDid={did} />,
  );
};
