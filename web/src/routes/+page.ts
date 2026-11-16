import { browser } from "$app/environment";
import { FEED_PAGE_SIZE, recentFeedQuery } from "$lib/queries";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ parent, fetch }) => {
  const { queryClient } = await parent();
  const prefetch = queryClient.prefetchQuery(recentFeedQuery(FEED_PAGE_SIZE, fetch));
  if (!browser) await prefetch;
};
