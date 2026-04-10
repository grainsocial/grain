import { browser } from "$app/environment";
import { actorProfileQuery, actorFeedQuery } from "$lib/queries";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params, parent, fetch }) => {
  const did = decodeURIComponent(params.did);
  const { queryClient, viewer } = await parent();
  const prefetch = Promise.all([
    queryClient.prefetchQuery(actorProfileQuery(did, viewer?.did, fetch)),
    queryClient.prefetchInfiniteQuery(actorFeedQuery(did, fetch)),
  ]);
  if (!browser) await prefetch;
  return { did };
};
