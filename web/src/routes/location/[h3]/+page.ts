import { browser } from "$app/environment";
import { locationFeedInfiniteQuery, locationsQuery } from "$lib/queries";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ url, params, parent, fetch }) => {
  const h3Index = decodeURIComponent(params.h3);
  const nameParam = url.searchParams.get("name");
  const name = nameParam ?? h3Index;
  const { queryClient } = await parent();
  const prefetch = Promise.all([
    queryClient.prefetchInfiniteQuery(
      locationFeedInfiniteQuery(h3Index, nameParam ?? undefined, fetch),
    ),
    // Prefetch locations so the map banner can render the full cell set.
    queryClient.prefetchQuery(locationsQuery(fetch)),
  ]);
  if (!browser) await prefetch;
  return { h3Index, name, nameParam, wide: true };
};

// Start the map's chunks downloading while the route is still loading. They are
// dynamic imports inside the components, so nothing else preloads them, and on
// a client-side navigation they would otherwise begin only after first paint.
// Module cache means the components' own imports then resolve instantly.
if (browser) {
  void import("maplibre-gl");
  void import("protomaps-themes-base");
}
