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
