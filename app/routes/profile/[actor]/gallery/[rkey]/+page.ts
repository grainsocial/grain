import { browser } from "$app/environment";
import { galleryQuery, actorFeedQuery } from "$lib/queries";
import type { PageLoad } from "./$types";

// The actor stays as written in the URL, handle or DID: getGallery and the
// actor feed accept either, and nothing on the page needs the DID before the
// gallery arrives (the comment thread and favorites key off `gallery.uri`,
// which the server answers in DID form).
export const load: PageLoad = async ({ params, parent, fetch }) => {
  const actor = decodeURIComponent(params.actor);
  const rkey = params.rkey;
  const galleryUri = `at://${actor}/social.grain.gallery/${rkey}`;
  const { queryClient } = await parent();
  const prefetch = Promise.all([
    queryClient.prefetchQuery(galleryQuery(galleryUri, fetch)),
    queryClient.prefetchInfiniteQuery(actorFeedQuery(actor, fetch)),
  ]);
  if (!browser) await prefetch;
  return { actor, rkey, galleryUri, wide: true };
};
