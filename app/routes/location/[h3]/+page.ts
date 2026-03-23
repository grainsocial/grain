import { browser } from "$app/environment";
import { locationFeedQuery } from "$lib/queries";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ url, params, parent, fetch }) => {
  const h3Index = decodeURIComponent(params.h3);
  const name = url.searchParams.get("name") ?? h3Index;
  const { queryClient } = await parent();
  const prefetch = queryClient.prefetchQuery(locationFeedQuery(h3Index, 50, fetch));
  if (!browser) await prefetch;
  return { h3Index, name };
};
