import { browser } from "$app/environment";
import { galleryQuery, actorFeedQuery } from "$lib/queries";
import type { PageLoad } from "./$types";

// The actor stays as written in the URL, handle or DID: getGallery and the
// actor feed accept either, and nothing on the page needs the DID before the
// gallery arrives (the comment thread and favorites key off `gallery.uri`,
// which the server answers in DID form).
export const load: PageLoad = async ({ params, parent, fetch, url }) => {
  const actor = decodeURIComponent(params.actor);
  const rkey = params.rkey;
  const galleryUri = `at://${actor}/social.grain.gallery/${rkey}`;
  const { queryClient } = await parent();
  // `?group=` means the gallery lives in that group's pool rather than the
  // public repo: there is nothing in the index to warm, and the read it needs
  // is the viewer's own credentialed one, made in the browser.
  if (url.searchParams.has("group")) return { actor, rkey, galleryUri, wide: true };
  const prefetch = Promise.all([
    queryClient.prefetchQuery(galleryQuery(galleryUri, fetch)),
    queryClient.prefetchInfiniteQuery(actorFeedQuery(actor, fetch)),
  ]);
  if (!browser) await prefetch;
  return { actor, rkey, galleryUri, wide: true };
};
