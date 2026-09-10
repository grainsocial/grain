import { browser } from "$app/environment";
import { galleryQuery, actorFeedQuery } from "$lib/queries";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params, parent, fetch }) => {
  const did = decodeURIComponent(params.did);
  const rkey = params.rkey;
  const galleryUri = `at://${did}/social.grain.gallery/${rkey}`;
  const { queryClient } = await parent();
  const prefetch = Promise.all([
    queryClient.prefetchQuery(galleryQuery(galleryUri, fetch)),
    // The "more galleries" strip below the detail; the profile page keys the
    // same query, so a visit either way warms the other.
    queryClient.prefetchInfiniteQuery(actorFeedQuery(did, fetch)),
  ]);
  if (!browser) await prefetch;
  return { did, rkey, galleryUri, wide: true };
};
