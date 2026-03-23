import { browser } from "$app/environment";
import { recentFeedQuery } from "$lib/queries";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ parent, fetch }) => {
  const { queryClient } = await parent();
  const prefetch = queryClient.prefetchQuery(recentFeedQuery(50, fetch));
  if (!browser) await prefetch;
};
