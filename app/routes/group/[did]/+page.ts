import { browser } from "$app/environment";
import { groupQuery, groupFeedQuery } from "$lib/queries";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params, parent, fetch }) => {
  const did = decodeURIComponent(params.did);
  const { queryClient } = await parent();
  const prefetch = Promise.all([
    queryClient.prefetchQuery(groupQuery(did, fetch)),
    queryClient.prefetchInfiniteQuery(groupFeedQuery(did, fetch)),
  ]);
  if (!browser) await prefetch;
  return { did };
};
