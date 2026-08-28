import { browser } from "$app/environment";
import { groupQuery, groupFeedQuery } from "$lib/queries";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params, parent, fetch }) => {
  const did = decodeURIComponent(params.did);
  const { queryClient, viewer } = await parent();
  const prefetch = Promise.all([
    queryClient.prefetchQuery(groupQuery(did, fetch)),
    queryClient.prefetchInfiniteQuery(groupFeedQuery(did, fetch)),
  ]);
  if (!browser) await prefetch;
  // Same shell as a profile: the wide column, and the public top bar when
  // nobody is signed in.
  return { did, wide: true, full: !viewer };
};
