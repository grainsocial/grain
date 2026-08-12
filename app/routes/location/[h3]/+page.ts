import { browser } from "$app/environment";
import { FEED_PAGE_SIZE, locationFeedQuery, locationsQuery } from "$lib/queries";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ url, params, parent, fetch }) => {
  const h3Index = decodeURIComponent(params.h3);
  const nameParam = url.searchParams.get("name");
  const name = nameParam ?? h3Index;
  const { queryClient } = await parent();
  const prefetch = Promise.all([
    queryClient.prefetchQuery(
      locationFeedQuery(h3Index, nameParam ?? undefined, FEED_PAGE_SIZE, fetch),
    ),
    // Prefetch locations so the map banner can render the full cell set.
    queryClient.prefetchQuery(locationsQuery(fetch)),
  ]);
  if (!browser) await prefetch;
  return { h3Index, name, nameParam };
};
