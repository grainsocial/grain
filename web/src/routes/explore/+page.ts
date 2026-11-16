import { browser } from "$app/environment";
import { camerasQuery, locationsQuery, recentFeedQuery } from "$lib/queries";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ parent, fetch }) => {
  const { queryClient } = await parent();
  const prefetch = Promise.all([
    queryClient.prefetchQuery(camerasQuery(fetch)),
    queryClient.prefetchQuery(locationsQuery(fetch)),
    queryClient.prefetchQuery(recentFeedQuery(undefined, fetch)),
  ]);
  if (!browser) await prefetch;
  return { wide: true };
};
