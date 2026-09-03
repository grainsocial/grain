import { browser } from "$app/environment";
import { locationPinsQuery, locationsQuery } from "$lib/queries";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ parent, fetch }) => {
  const { queryClient } = await parent();
  const prefetch = Promise.all([
    queryClient.prefetchQuery(locationsQuery(fetch)),
    queryClient.prefetchQuery(locationPinsQuery(fetch)),
  ]);
  if (!browser) await prefetch;
  return { wide: true };
};

// Start the map's chunks downloading while the route is still loading. They are
// dynamic imports inside the components, so nothing else preloads them, and on
// a client-side navigation they would otherwise begin only after first paint.
// Module cache means the components' own imports then resolve instantly.
if (browser) {
  void import("maplibre-gl");
  void import("protomaps-themes-base");
}
