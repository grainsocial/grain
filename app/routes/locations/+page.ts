import { browser } from "$app/environment";
import { locationsQuery } from "$lib/queries";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ parent, fetch }) => {
  const { queryClient } = await parent();
  const prefetch = queryClient.prefetchQuery(locationsQuery(fetch));
  if (!browser) await prefetch;
  return {};
};
